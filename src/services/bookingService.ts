import crypto from 'crypto';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import sequelize from '../config/database';
import Booking, { BOOKING_STATUSES, BookingStatus } from '../models/booking';
import Court from '../models/court';
import ReservationSlot from '../models/reservationSlot';
import { buildDaySlots } from './availabilityService';
import { toPublicBooking } from '../utils/bookingSerializer';
import { HttpError } from '../utils/httpError';
import { addDaysYmd, parseUtcInstant, utcToYmd, wallTimeToUtc } from '../utils/timezone';

export const HOLD_MINUTES = 15;
export const MIN_DURATION_MINUTES = 60;
export const MAX_ADVANCE_DAYS = 30;
export const CANCEL_PENALTY_RATE = 0.3;

export interface BookingItemInput {
    court_id: number;
    starts_at: Date;
    ends_at: Date;
}

interface ExpandedSlot {
    court_id: number;
    starts_at: Date;
    minutes: number;
    price_cents: number;
}

function toCents(amount: string | number): number {
    return Math.round(Number(amount) * 100);
}

function fromCents(cents: number): string {
    return (cents / 100).toFixed(2);
}

function isUniqueConflict(error: unknown): boolean {
    if (error instanceof UniqueConstraintError) {
        return true;
    }
    const code = (error as { parent?: { code?: string } })?.parent?.code;
    return code === 'ER_DUP_ENTRY';
}

function parseBoolean(value: unknown, defaultValue: boolean): boolean {
    if (value === undefined || value === null || value === '') {
        return defaultValue;
    }
    if (value === true || value === 'true' || value === 1 || value === '1') {
        return true;
    }
    if (value === false || value === 'false' || value === 0 || value === '0') {
        return false;
    }
    return defaultValue;
}

function parsePositiveId(value: unknown): number | null {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
}

function normalizeEmail(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const email = value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 128) {
        return null;
    }
    return email;
}

function normalizeGuestField(value: unknown, max: number): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > max) {
        return null;
    }
    return trimmed;
}

function parseItems(raw: unknown): BookingItemInput[] {
    if (!Array.isArray(raw) || raw.length === 0) {
        throw new HttpError(400, 'items debe ser un arreglo con al menos un rango');
    }

    return raw.map((item, index) => {
        if (!item || typeof item !== 'object') {
            throw new HttpError(400, `items[${index}] es inválido`);
        }
        const row = item as Record<string, unknown>;
        const courtId = parsePositiveId(row.court_id);
        const startsAt = parseUtcInstant(row.starts_at);
        const endsAt = parseUtcInstant(row.ends_at);
        if (!courtId || !startsAt || !endsAt) {
            throw new HttpError(400, `items[${index}] requiere court_id, starts_at y ends_at en UTC (ISO-8601)`);
        }
        if (endsAt.getTime() <= startsAt.getTime()) {
            throw new HttpError(400, `items[${index}]: ends_at debe ser posterior a starts_at`);
        }
        return { court_id: courtId, starts_at: startsAt, ends_at: endsAt };
    });
}

function expandItem(court: Court, item: BookingItemInput, nowMs: number): ExpandedSlot[] {
    const startMs = item.starts_at.getTime();
    const endMs = item.ends_at.getTime();
    const durationMinutes = (endMs - startMs) / 60000;

    if (durationMinutes < MIN_DURATION_MINUTES) {
        throw new HttpError(400, `La reserva mínima es de ${MIN_DURATION_MINUTES} minutos`);
    }

    if (startMs < nowMs - 60_000) {
        throw new HttpError(400, 'No se puede reservar un horario en el pasado');
    }

    const maxAdvanceMs = MAX_ADVANCE_DAYS * 24 * 60 * 60 * 1000;
    if (startMs > nowMs + maxAdvanceMs) {
        throw new HttpError(400, `No se puede reservar con más de ${MAX_ADVANCE_DAYS} días de anticipación`);
    }

    const day = utcToYmd(item.starts_at, court.timezone);
    const endDay = utcToYmd(new Date(endMs - 1000), court.timezone);
    if (day !== endDay) {
        throw new HttpError(400, 'La reserva debe terminar el mismo día, antes del cierre de la cancha');
    }

    const grid = buildDaySlots(court, day);
    const selected = grid.filter((slot) => slot.start.getTime() >= startMs && slot.end.getTime() <= endMs);
    if (
        selected.length === 0
        || selected[0].start.getTime() !== startMs
        || selected[selected.length - 1].end.getTime() !== endMs
    ) {
        throw new HttpError(400, 'El horario no está alineado a la grilla de la cancha');
    }

    const centsPerHour = toCents(court.price_per_hour);
    const slotMinutes = court.slot_minutes;
    const pricePerSlot = Math.round((centsPerHour * slotMinutes) / 60);

    return selected.map((slot) => ({
        court_id: Number(court.id),
        starts_at: slot.start,
        minutes: slotMinutes,
        price_cents: pricePerSlot,
    }));
}

const bookingInclude = [{
    model: ReservationSlot,
    as: 'slots',
    include: [{ model: Court, as: 'court' }],
}];

async function loadByAccessCode(accessCode: string, transaction?: Transaction): Promise<Booking> {
    const booking = await Booking.findOne({
        where: { access_code: accessCode },
        include: bookingInclude,
        transaction,
    });
    if (!booking) {
        throw new HttpError(404, 'Reserva no encontrada');
    }
    return booking;
}

async function loadById(id: number, transaction?: Transaction): Promise<Booking> {
    const booking = await Booking.findByPk(id, {
        include: bookingInclude,
        transaction,
    });
    if (!booking) {
        throw new HttpError(404, 'Reserva no encontrada');
    }
    return booking;
}

/** Bloquea la fila del booking (SELECT … FOR UPDATE) y luego carga relaciones. */
async function lockByAccessCode(accessCode: string, transaction: Transaction): Promise<Booking> {
    const locked = await Booking.findOne({
        where: { access_code: accessCode },
        lock: Transaction.LOCK.UPDATE,
        transaction,
    });
    if (!locked) {
        throw new HttpError(404, 'Reserva no encontrada');
    }
    return loadByAccessCode(accessCode, transaction);
}

async function lockById(id: number, transaction: Transaction): Promise<Booking> {
    const locked = await Booking.findByPk(id, {
        lock: Transaction.LOCK.UPDATE,
        transaction,
    });
    if (!locked) {
        throw new HttpError(404, 'Reserva no encontrada');
    }
    return loadById(id, transaction);
}

async function expireIfNeeded(booking: Booking, transaction?: Transaction): Promise<Booking> {
    const expiredHold = booking.status === 'pending_payment'
        && booking.hold_expires_at
        && booking.hold_expires_at.getTime() < Date.now();

    if (!expiredHold) {
        return booking;
    }

    await ReservationSlot.destroy({ where: { booking_id: booking.id }, transaction });
    await booking.update({
        status: 'expired',
        hold_expires_at: null,
    }, { transaction });
    return loadByAccessCode(booking.access_code, transaction);
}

async function withLockedBooking<T>(
    loadLocked: (transaction: Transaction) => Promise<Booking>,
    work: (booking: Booking, transaction: Transaction) => Promise<T>
): Promise<T> {
    const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });
    try {
        let booking = await loadLocked(transaction);
        booking = await expireIfNeeded(booking, transaction);
        const result = await work(booking, transaction);
        await transaction.commit();
        return result;
    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

export async function createBooking(body: Record<string, unknown>) {
    const guestName = normalizeGuestField(body.guest_name, 128);
    const guestEmail = normalizeEmail(body.guest_email);
    const guestPhone = normalizeGuestField(body.guest_phone, 32);
    if (!guestName || !guestEmail || !guestPhone) {
        throw new HttpError(400, 'guest_name, guest_email y guest_phone son requeridos y válidos');
    }

    const items = parseItems(body.items);
    const courtIds = [...new Set(items.map((item) => item.court_id))].sort((a, b) => a - b);
    const nowMs = Date.now();

    const transaction = await sequelize.transaction({
        isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    });

    try {
        const courts = await Court.findAll({
            where: { id: courtIds },
            lock: Transaction.LOCK.UPDATE,
            transaction,
            order: [['id', 'ASC']],
        });

        const courtsById = new Map(courts.map((court) => [Number(court.id), court]));
        if (courtsById.size !== courtIds.length) {
            throw new HttpError(400, 'Una o más canchas no existen');
        }
        for (const court of courts) {
            if (court.status !== 'active') {
                throw new HttpError(400, `La cancha ${court.name} no está disponible`);
            }
        }

        const expanded: ExpandedSlot[] = [];
        const seen = new Set<string>();
        for (const item of items) {
            const court = courtsById.get(item.court_id);
            if (!court) {
                throw new HttpError(400, 'Cancha no encontrada');
            }
            for (const slot of expandItem(court, item, nowMs)) {
                const key = `${slot.court_id}:${slot.starts_at.toISOString()}`;
                if (seen.has(key)) {
                    throw new HttpError(400, 'Hay horarios duplicados en la misma solicitud');
                }
                seen.add(key);
                expanded.push(slot);
            }
        }

        const conflict = await ReservationSlot.findOne({
            where: {
                [Op.or]: expanded.map((slot) => ({
                    court_id: slot.court_id,
                    starts_at: slot.starts_at,
                })),
            },
            transaction,
        });
        if (conflict) {
            throw new HttpError(409, 'Uno o más horarios ya están ocupados', { code: 'SLOT_TAKEN' });
        }

        const totalCents = expanded.reduce((sum, slot) => sum + slot.price_cents, 0);
        const accessCode = crypto.randomUUID().replace(/-/g, '');
        const simulatePayment = parseBoolean(body.simulate_payment, true);
        const paidAt = simulatePayment ? new Date(nowMs) : null;
        const holdExpiresAt = simulatePayment ? null : new Date(nowMs + HOLD_MINUTES * 60 * 1000);

        const booking = await Booking.create({
            guest_name: guestName,
            guest_email: guestEmail,
            guest_phone: guestPhone,
            access_code: accessCode,
            status: simulatePayment ? 'paid' : 'pending_payment',
            total_amount: fromCents(totalCents),
            paid_at: paidAt,
            hold_expires_at: holdExpiresAt,
        }, { transaction });

        await ReservationSlot.bulkCreate(
            expanded.map((slot) => ({
                booking_id: booking.id,
                court_id: slot.court_id,
                starts_at: slot.starts_at,
            })),
            { transaction }
        );

        await transaction.commit();
        const created = await loadByAccessCode(accessCode);
        return toPublicBooking(created);
    } catch (error) {
        await transaction.rollback();
        if (error instanceof HttpError) {
            throw error;
        }
        if (isUniqueConflict(error)) {
            throw new HttpError(409, 'Uno o más horarios ya están ocupados', { code: 'SLOT_TAKEN' });
        }
        throw error;
    }
}

async function applyCancel(booking: Booking, transaction: Transaction): Promise<Booking> {
    if (booking.status === 'cancelled') {
        throw new HttpError(422, 'La reserva ya está cancelada');
    }
    if (booking.status === 'expired') {
        throw new HttpError(422, 'La reserva expiró y no se puede cancelar');
    }

    const applyPenalty = booking.status === 'paid' || booking.status === 'confirmed';
    const totalCents = toCents(booking.total_amount);
    const penaltyCents = applyPenalty ? Math.round(totalCents * CANCEL_PENALTY_RATE) : 0;
    const refundCents = applyPenalty ? totalCents - penaltyCents : 0;

    await ReservationSlot.destroy({ where: { booking_id: booking.id }, transaction });
    await booking.update({
        status: 'cancelled',
        cancelled_at: new Date(),
        penalty_amount: fromCents(penaltyCents),
        refund_amount: fromCents(refundCents),
        hold_expires_at: null,
    }, { transaction });

    return booking;
}

export async function getBookingByAccessCode(accessCode: string) {
    const booking = await withLockedBooking(
        (transaction) => lockByAccessCode(accessCode, transaction),
        async (current) => current
    );
    return toPublicBooking(booking);
}

export async function getBookingById(id: number) {
    const booking = await withLockedBooking(
        (transaction) => lockById(id, transaction),
        async (current) => current
    );
    return toPublicBooking(booking);
}

export async function listBookings(query: Record<string, unknown>) {
    const where: Record<string, unknown> = {};
    const status = typeof query.status === 'string' ? query.status : undefined;
    if (status) {
        if (!(BOOKING_STATUSES as readonly string[]).includes(status)) {
            throw new HttpError(400, 'status inválido');
        }
        where.status = status as BookingStatus;
    }

    const email = typeof query.guest_email === 'string' ? query.guest_email.trim().toLowerCase() : '';
    if (email) {
        where.guest_email = email;
    }

    const courtId = query.court_id !== undefined ? parsePositiveId(query.court_id) : null;
    if (query.court_id !== undefined && query.court_id !== '' && !courtId) {
        throw new HttpError(400, 'court_id inválido');
    }

    const date = typeof query.date === 'string' ? query.date : '';
    const slotWhere: Record<string, unknown> = {};
    if (courtId) {
        slotWhere.court_id = courtId;
    }
    if (date) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            throw new HttpError(400, 'date debe ser YYYY-MM-DD');
        }
        slotWhere.starts_at = {
            [Op.gte]: wallTimeToUtc(date, '00:00:00', 'America/Bogota'),
            [Op.lt]: wallTimeToUtc(addDaysYmd(date, 1), '00:00:00', 'America/Bogota'),
        };
    }

    if (Object.keys(slotWhere).length > 0) {
        const slotRows = await ReservationSlot.findAll({
            where: slotWhere,
            attributes: ['booking_id'],
        });
        const ids = [...new Set(slotRows.map((row) => Number(row.booking_id)))];
        if (ids.length === 0) {
            return { total: 0, bookings: [] };
        }
        where.id = { [Op.in]: ids };
    }

    const limitRaw = Number(query.limit ?? 50);
    const offsetRaw = Number(query.offset ?? 0);
    const limit = Number.isInteger(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 50;
    const offset = Number.isInteger(offsetRaw) && offsetRaw >= 0 ? offsetRaw : 0;

    const { rows, count } = await Booking.findAndCountAll({
        where,
        include: bookingInclude,
        distinct: true,
        limit,
        offset,
        order: [['createdAt', 'DESC']],
    });

    return {
        total: count,
        bookings: rows.map((booking) => toPublicBooking(booking)),
    };
}

export async function payBooking(accessCode: string) {
    await withLockedBooking(
        (transaction) => lockByAccessCode(accessCode, transaction),
        async (booking, transaction) => {
            if (booking.status === 'paid' || booking.status === 'confirmed') {
                throw new HttpError(422, 'La reserva ya está pagada');
            }
            if (booking.status !== 'pending_payment') {
                throw new HttpError(422, 'La reserva no se puede pagar en su estado actual');
            }

            await booking.update({
                status: 'paid',
                paid_at: new Date(),
                hold_expires_at: null,
            }, { transaction });
        }
    );
    return toPublicBooking(await loadByAccessCode(accessCode));
}

export async function cancelBooking(accessCode: string) {
    await withLockedBooking(
        (transaction) => lockByAccessCode(accessCode, transaction),
        async (booking, transaction) => {
            await applyCancel(booking, transaction);
        }
    );
    return toPublicBooking(await loadByAccessCode(accessCode));
}

export async function cancelBookingById(id: number) {
    await withLockedBooking(
        (transaction) => lockById(id, transaction),
        async (booking, transaction) => {
            await applyCancel(booking, transaction);
        }
    );
    return toPublicBooking(await loadById(id));
}

export async function confirmBookingById(id: number) {
    await withLockedBooking(
        (transaction) => lockById(id, transaction),
        async (booking, transaction) => {
            if (booking.status === 'confirmed') {
                throw new HttpError(422, 'La reserva ya está confirmada');
            }
            if (booking.status !== 'paid') {
                throw new HttpError(422, 'Solo se confirman reservas pagadas');
            }

            await booking.update({
                status: 'confirmed',
                confirmed_at: new Date(),
            }, { transaction });
        }
    );
    return toPublicBooking(await loadById(id));
}
