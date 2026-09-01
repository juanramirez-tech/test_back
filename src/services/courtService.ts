import { UniqueConstraintError } from 'sequelize';
import Court, { COURT_SLOT_MINUTES, COURT_STATUSES, CourtSlotMinutes, CourtStatus } from '../models/court';
import ReservationSlot from '../models/reservationSlot';
import { toPublicCourt } from '../utils/courtSerializer';
import { HttpError } from '../utils/httpError';
import { normalizeTime, utcToYmd, wallTimeToUtc } from '../utils/timezone';

function parsePositiveId(value: unknown): number | null {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
}

function parseName(value: unknown): string | null {
    if (typeof value !== 'string') {
        return null;
    }
    const name = value.trim();
    if (!name || name.length > 128) {
        return null;
    }
    return name;
}

function parseDescription(value: unknown): string {
    if (value === undefined || value === null) {
        return '';
    }
    if (typeof value !== 'string') {
        throw new HttpError(400, 'description inválida');
    }
    return value.trim().slice(0, 512);
}

function parseSlotMinutes(value: unknown): CourtSlotMinutes {
    const minutes = Number(value);
    if (!(COURT_SLOT_MINUTES as readonly number[]).includes(minutes)) {
        throw new HttpError(400, 'slot_minutes debe ser 30 o 60');
    }
    return minutes as CourtSlotMinutes;
}

function parsePrice(value: unknown): string {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
        throw new HttpError(400, 'price_per_hour inválido');
    }
    return amount.toFixed(2);
}

function parseTime(value: unknown, field: string): string {
    if (typeof value !== 'string') {
        throw new HttpError(400, `${field} inválido`);
    }
    try {
        return normalizeTime(value);
    } catch {
        throw new HttpError(400, `${field} debe tener formato HH:mm o HH:mm:ss`);
    }
}

function parseTimezone(value: unknown): string {
    const timezone = typeof value === 'string' && value.trim() ? value.trim() : 'America/Bogota';
    try {
        Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date());
    } catch {
        throw new HttpError(400, 'timezone inválido');
    }
    if (timezone.length > 64) {
        throw new HttpError(400, 'timezone inválido');
    }
    return timezone;
}

function parseStatus(value: unknown): CourtStatus {
    if (typeof value !== 'string' || !(COURT_STATUSES as readonly string[]).includes(value)) {
        throw new HttpError(400, 'status debe ser active o inactive');
    }
    return value as CourtStatus;
}

function assertOpensBeforeCloses(opensAt: string, closesAt: string): void {
    if (opensAt >= closesAt) {
        throw new HttpError(400, 'opens_at debe ser anterior a closes_at');
    }
}

async function assertScheduleCompatible(
    court: Court,
    next: { slot_minutes: CourtSlotMinutes; opens_at: string; closes_at: string; timezone: string },
): Promise<void> {
    const slotMinutesChanged = next.slot_minutes !== court.slot_minutes;
    const timezoneChanged = next.timezone !== court.timezone;
    const hoursChanged =
        next.opens_at !== normalizeTime(court.opens_at)
        || next.closes_at !== normalizeTime(court.closes_at);

    if (!slotMinutesChanged && !timezoneChanged && !hoursChanged) {
        return;
    }

    const slots = await ReservationSlot.findAll({
        where: { court_id: court.id },
        attributes: ['starts_at'],
    });
    if (slots.length === 0) {
        return;
    }

    if (slotMinutesChanged) {
        throw new HttpError(422, 'No se puede cambiar slot_minutes mientras la cancha tiene reservas activas');
    }
    if (timezoneChanged) {
        throw new HttpError(422, 'No se puede cambiar timezone mientras la cancha tiene reservas activas');
    }

    const stepMs = next.slot_minutes * 60 * 1000;
    for (const slot of slots) {
        const start = new Date(slot.starts_at);
        const localDate = utcToYmd(start, next.timezone);
        const opens = wallTimeToUtc(localDate, next.opens_at, next.timezone);
        const closes = wallTimeToUtc(localDate, next.closes_at, next.timezone);
        const endMs = start.getTime() + stepMs;
        if (start.getTime() < opens.getTime() || endMs > closes.getTime()) {
            throw new HttpError(422, 'No se puede cambiar el horario: hay reservas fuera del nuevo rango');
        }
    }
}

function isUniqueName(error: unknown): boolean {
    if (error instanceof UniqueConstraintError) {
        return true;
    }
    return (error as { parent?: { code?: string } })?.parent?.code === 'ER_DUP_ENTRY';
}

async function loadCourt(id: number): Promise<Court> {
    const court = await Court.findByPk(id);
    if (!court) {
        throw new HttpError(404, 'Cancha no encontrada');
    }
    return court;
}

export async function listAdminCourts() {
    const courts = await Court.findAll({ order: [['name', 'ASC']] });
    return courts.map(toPublicCourt);
}

export async function getAdminCourt(idValue: unknown) {
    const id = parsePositiveId(idValue);
    if (!id) {
        throw new HttpError(400, 'ID de cancha inválido');
    }
    return toPublicCourt(await loadCourt(id));
}

export async function createCourt(body: Record<string, unknown>) {
    const name = parseName(body.name);
    if (!name) {
        throw new HttpError(400, 'name es requerido');
    }
    const payload = {
        name,
        description: parseDescription(body.description),
        slot_minutes: parseSlotMinutes(body.slot_minutes),
        price_per_hour: parsePrice(body.price_per_hour),
        opens_at: parseTime(body.opens_at, 'opens_at'),
        closes_at: parseTime(body.closes_at, 'closes_at'),
        timezone: parseTimezone(body.timezone),
        status: body.status === undefined ? 'active' as const : parseStatus(body.status),
    };
    assertOpensBeforeCloses(payload.opens_at, payload.closes_at);

    try {
        const court = await Court.create(payload);
        return toPublicCourt(court);
    } catch (error) {
        if (isUniqueName(error)) {
            throw new HttpError(409, 'Ya existe una cancha con ese nombre');
        }
        throw error;
    }
}

export async function updateCourt(idValue: unknown, body: Record<string, unknown>, partial: boolean) {
    const id = parsePositiveId(idValue);
    if (!id) {
        throw new HttpError(400, 'ID de cancha inválido');
    }
    const court = await loadCourt(id);

    const name = body.name !== undefined || !partial ? parseName(body.name) : court.name;
    if (!name) {
        throw new HttpError(400, 'name es requerido');
    }

    const next = {
        name,
        description: body.description !== undefined || !partial
            ? parseDescription(body.description)
            : court.description,
        slot_minutes: body.slot_minutes !== undefined || !partial
            ? parseSlotMinutes(body.slot_minutes)
            : court.slot_minutes,
        price_per_hour: body.price_per_hour !== undefined || !partial
            ? parsePrice(body.price_per_hour)
            : court.price_per_hour,
        opens_at: body.opens_at !== undefined || !partial
            ? parseTime(body.opens_at, 'opens_at')
            : normalizeTime(court.opens_at),
        closes_at: body.closes_at !== undefined || !partial
            ? parseTime(body.closes_at, 'closes_at')
            : normalizeTime(court.closes_at),
        timezone: body.timezone !== undefined || !partial
            ? parseTimezone(body.timezone)
            : court.timezone,
        status: body.status !== undefined || !partial
            ? parseStatus(body.status ?? 'active')
            : court.status,
    };
    assertOpensBeforeCloses(next.opens_at, next.closes_at);
    await assertScheduleCompatible(court, next);

    try {
        await court.update(next);
        return toPublicCourt(court);
    } catch (error) {
        if (isUniqueName(error)) {
            throw new HttpError(409, 'Ya existe una cancha con ese nombre');
        }
        throw error;
    }
}
