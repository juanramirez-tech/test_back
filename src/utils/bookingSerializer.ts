import Booking from '../models/booking';
import Court from '../models/court';
import ReservationSlot from '../models/reservationSlot';
import { toPublicCourt } from './courtSerializer';
import { toUtcIso } from './timezone';

export interface PublicBookingItem {
    court_id: number;
    starts_at: string;
    ends_at: string;
    court: ReturnType<typeof toPublicCourt> | null;
}

function mergeRanges(slots: ReservationSlot[]): PublicBookingItem[] {
    const sorted = [...slots].sort((a, b) => {
        const courtDiff = Number(a.court_id) - Number(b.court_id);
        if (courtDiff !== 0) {
            return courtDiff;
        }
        return a.starts_at.getTime() - b.starts_at.getTime();
    });

    const items: PublicBookingItem[] = [];

    for (const slot of sorted) {
        const court = slot.get('court') as Court | undefined;
        const stepMs = (court?.slot_minutes ?? 60) * 60 * 1000;
        const last = items[items.length - 1];
        const startIso = toUtcIso(slot.starts_at);
        const endIso = toUtcIso(new Date(slot.starts_at.getTime() + stepMs));

        if (
            last
            && last.court_id === Number(slot.court_id)
            && last.ends_at === startIso
        ) {
            last.ends_at = endIso;
            continue;
        }

        items.push({
            court_id: Number(slot.court_id),
            starts_at: startIso,
            ends_at: endIso,
            court: court ? toPublicCourt(court) : null,
        });
    }

    return items;
}

export function toPublicBooking(booking: Booking) {
    const slots = (booking.get('slots') as ReservationSlot[] | undefined) ?? [];

    return {
        id: Number(booking.id),
        access_code: booking.access_code,
        status: booking.status,
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        guest_phone: booking.guest_phone,
        total_amount: booking.total_amount,
        penalty_amount: booking.penalty_amount,
        refund_amount: booking.refund_amount,
        paid_at: booking.paid_at ? toUtcIso(booking.paid_at) : null,
        confirmed_at: booking.confirmed_at ? toUtcIso(booking.confirmed_at) : null,
        cancelled_at: booking.cancelled_at ? toUtcIso(booking.cancelled_at) : null,
        hold_expires_at: booking.hold_expires_at ? toUtcIso(booking.hold_expires_at) : null,
        items: mergeRanges(slots),
        createdAt: toUtcIso(booking.createdAt),
        updatedAt: toUtcIso(booking.updatedAt),
    };
}
