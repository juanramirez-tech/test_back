import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import Booking from '../models/booking';
import ReservationSlot from '../models/reservationSlot';
import { anonymizeStaleGuestPii } from './piiRetentionService';

const DEFAULT_INTERVAL_MS = 60 * 1000;

let timer: NodeJS.Timeout | null = null;
let running = false;
let stopped = false;

export async function expireStaleHolds(): Promise<number> {
    const stale = await Booking.findAll({
        where: {
            status: 'pending_payment',
            hold_expires_at: { [Op.lt]: new Date() },
        },
        attributes: ['id'],
    });

    let expired = 0;

    for (const row of stale) {
        const transaction = await sequelize.transaction();
        try {
            const booking = await Booking.findByPk(row.id, {
                lock: Transaction.LOCK.UPDATE,
                transaction,
            });

            const stillStale = booking
                && booking.status === 'pending_payment'
                && booking.hold_expires_at
                && booking.hold_expires_at.getTime() < Date.now();

            if (stillStale && booking) {
                await ReservationSlot.destroy({ where: { booking_id: booking.id }, transaction });
                await booking.update({
                    status: 'expired',
                    hold_expires_at: null,
                }, { transaction });
                expired += 1;
            }

            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            console.error('Error expirando hold de reserva', error);
        }
    }

    return expired;
}

async function tick(): Promise<void> {
    if (running || stopped) {
        return;
    }
    running = true;
    try {
        const expired = await expireStaleHolds();
        if (expired > 0) {
            console.log(`[Holds] Reservas expiradas: ${expired}`);
        }
        const redacted = await anonymizeStaleGuestPii();
        if (redacted > 0) {
            console.log(`[PII] Reservas anonimizadas: ${redacted}`);
        }
    } catch (error) {
        console.error('[Holds] Error en job de expiración', error);
    } finally {
        running = false;
    }
}

export function startHoldExpiryJob(intervalMs = DEFAULT_INTERVAL_MS): void {
    if (timer) {
        return;
    }
    stopped = false;
    void tick();
    timer = setInterval(() => {
        void tick();
    }, intervalMs);
}

export async function stopHoldExpiryJob(): Promise<void> {
    stopped = true;
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
    const started = Date.now();
    while (running && Date.now() - started < 8000) {
        await new Promise((resolve) => setTimeout(resolve, 50));
    }
}
