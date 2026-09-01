import Booking from './booking';
import Court from './court';
import ReservationSlot from './reservationSlot';
import User from './users';

Court.hasMany(ReservationSlot, {
    foreignKey: 'court_id',
    as: 'slots',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
});
ReservationSlot.belongsTo(Court, {
    foreignKey: 'court_id',
    as: 'court',
});

Booking.hasMany(ReservationSlot, {
    foreignKey: 'booking_id',
    as: 'slots',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
});
ReservationSlot.belongsTo(Booking, {
    foreignKey: 'booking_id',
    as: 'booking',
});

export { Booking, Court, ReservationSlot, User };
export { BOOKING_STATUSES } from './booking';
export type { BookingStatus } from './booking';
export { COURT_SLOT_MINUTES, COURT_STATUSES } from './court';
export type { CourtSlotMinutes, CourtStatus } from './court';
