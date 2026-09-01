import { Op } from 'sequelize';
import Booking, { BookingStatus } from '../models/booking';
import Court from '../models/court';
import ReservationSlot from '../models/reservationSlot';
import { toPublicCourt } from '../utils/courtSerializer';
import { addDaysYmd, toUtcIso, wallTimeToUtc } from '../utils/timezone';

export type SlotOccupancy = 'free' | 'held' | 'booked';

export interface AvailabilitySlot {
    start: string;
    end: string;
    status: SlotOccupancy;
}

function occupancyFromBooking(status: BookingStatus | undefined): SlotOccupancy {
    if (status === 'pending_payment') {
        return 'held';
    }
    if (status === 'paid' || status === 'confirmed') {
        return 'booked';
    }
    return 'free';
}

export function buildDaySlots(court: Court, dateYmd: string): { start: Date; end: Date }[] {
    const opens = wallTimeToUtc(dateYmd, court.opens_at, court.timezone);
    const closes = wallTimeToUtc(dateYmd, court.closes_at, court.timezone);
    const stepMs = court.slot_minutes * 60 * 1000;
    const slots: { start: Date; end: Date }[] = [];

    if (!(stepMs > 0) || closes.getTime() <= opens.getTime()) {
        return slots;
    }

    for (let startMs = opens.getTime(); startMs + stepMs <= closes.getTime(); startMs += stepMs) {
        slots.push({
            start: new Date(startMs),
            end: new Date(startMs + stepMs),
        });
    }

    return slots;
}

async function occupiedByStart(courtId: number, dateYmd: string, timeZone: string): Promise<Map<string, SlotOccupancy>> {
    const dayStart = wallTimeToUtc(dateYmd, '00:00:00', timeZone);
    const dayEnd = wallTimeToUtc(addDaysYmd(dateYmd, 1), '00:00:00', timeZone);

    const rows = await ReservationSlot.findAll({
        where: {
            court_id: courtId,
            starts_at: {
                [Op.gte]: dayStart,
                [Op.lt]: dayEnd,
            },
        },
        include: [{ model: Booking, as: 'booking', attributes: ['status'] }],
    });

    const occupied = new Map<string, SlotOccupancy>();
    for (const row of rows) {
        const booking = row.get('booking') as Booking | undefined;
        const status = occupancyFromBooking(booking?.status);
        if (status === 'free') {
            continue;
        }
        occupied.set(toUtcIso(row.starts_at), status);
    }
    return occupied;
}

export async function getCourtAvailability(court: Court, dateYmd: string) {
    const grid = buildDaySlots(court, dateYmd);
    const occupied = await occupiedByStart(Number(court.id), dateYmd, court.timezone);

    const slots: AvailabilitySlot[] = grid.map((slot) => ({
        start: toUtcIso(slot.start),
        end: toUtcIso(slot.end),
        status: occupied.get(toUtcIso(slot.start)) ?? 'free',
    }));

    return {
        date: dateYmd,
        court: toPublicCourt(court),
        slots,
    };
}

export async function getCourtsAvailability(courts: Court[], dateYmd: string) {
    const items = [];
    for (const court of courts) {
        items.push(await getCourtAvailability(court, dateYmd));
    }
    return {
        date: dateYmd,
        courts: items,
    };
}
