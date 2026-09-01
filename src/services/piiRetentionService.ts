import { Op, WhereOptions } from 'sequelize';
import crypto from 'crypto';
import Booking from '../models/booking';

export const ANONYMIZED_GUEST_NAME = '[anónimo]';

function retentionDays(): number {
    const raw = Number(process.env.PII_RETENTION_DAYS ?? 90);
    if (!Number.isFinite(raw) || raw <= 0) {
        return 0;
    }
    return Math.min(Math.floor(raw), 3650);
}

/** Anonimiza invitados de reservas canceladas/expiradas más viejas que PII_RETENTION_DAYS. */
export async function anonymizeStaleGuestPii(batchSize = 50): Promise<number> {
    const days = retentionDays();
    if (days <= 0) {
        return 0;
    }

    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const where: WhereOptions = {
        status: { [Op.in]: ['cancelled', 'expired'] },
        guest_name: { [Op.ne]: ANONYMIZED_GUEST_NAME },
        updatedAt: { [Op.lt]: cutoff },
    };
    const rows = await Booking.findAll({
        where,
        limit: batchSize,
        order: [['updatedAt', 'ASC']],
    });

    let changed = 0;
    for (const booking of rows) {
        await booking.update({
            guest_name: ANONYMIZED_GUEST_NAME,
            guest_email: `redacted-${booking.id}@invalid.local`,
            guest_phone: '0000000000',
            access_code: crypto.randomUUID().replace(/-/g, ''),
        });
        changed += 1;
    }
    return changed;
}
