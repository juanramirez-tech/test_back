import Court from '../models/court';
import { normalizeTime } from './timezone';

export function toPublicCourt(court: Court) {
    return {
        id: Number(court.id),
        name: court.name,
        description: court.description,
        slot_minutes: court.slot_minutes,
        price_per_hour: court.price_per_hour,
        opens_at: normalizeTime(court.opens_at),
        closes_at: normalizeTime(court.closes_at),
        timezone: court.timezone,
        status: court.status,
    };
}
