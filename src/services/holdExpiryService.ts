import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import Booking from '../models/booking';
import ReservationSlot from '../models/reservationSlot';

const DEFAULT_INTERVAL_MS = 60 * 1000;

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

export function startHoldExpiryJob(intervalMs = DEFAULT_INTERVAL_MS): void {
    const run = async () => {
        try {
            const count = await expireStaleHolds();
            if (count > 0) {
                console.log(`[Holds] Reservas expiradas: ${count}`);
            }
        } catch (error) {
            console.error('[Holds] Error en job de expiración', error);
        }
    };

    void run();
    setInterval(run, intervalMs);
}
