import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export const BOOKING_STATUSES = [
    'pending_payment',
    'paid',
    'confirmed',
    'cancelled',
    'expired',
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export interface BookingAttributes {
    id: number;
    guest_name: string;
    guest_email: string;
    guest_phone: string;
    access_code: string;
    status: BookingStatus;
    total_amount: string;
    penalty_amount: string;
    refund_amount: string;
    paid_at: Date | null;
    confirmed_at: Date | null;
    cancelled_at: Date | null;
    hold_expires_at: Date | null;
}

interface BookingCreationAttributes extends Optional<
    BookingAttributes,
    | 'id'
    | 'penalty_amount'
    | 'refund_amount'
    | 'paid_at'
    | 'confirmed_at'
    | 'cancelled_at'
    | 'hold_expires_at'
> { }

class Booking extends Model<BookingAttributes, BookingCreationAttributes> implements BookingAttributes {
    public id!: number;
    public guest_name!: string;
    public guest_email!: string;
    public guest_phone!: string;
    public access_code!: string;
    public status!: BookingStatus;
    public total_amount!: string;
    public penalty_amount!: string;
    public refund_amount!: string;
    public paid_at!: Date | null;
    public confirmed_at!: Date | null;
    public cancelled_at!: Date | null;
    public hold_expires_at!: Date | null;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Booking.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        guest_name: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        guest_email: {
            type: DataTypes.STRING(128),
            allowNull: false,
            validate: {
                isEmail: true,
            },
        },
        guest_phone: {
            type: DataTypes.STRING(32),
            allowNull: false,
        },
        access_code: {
            type: DataTypes.STRING(64),
            allowNull: false,
            unique: true,
        },
        status: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'pending_payment',
            validate: {
                isIn: [BOOKING_STATUSES],
            },
        },
        total_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: '0.00',
        },
        penalty_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: '0.00',
        },
        refund_amount: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            defaultValue: '0.00',
        },
        paid_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        confirmed_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        cancelled_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        hold_expires_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    },
    {
        tableName: 'bookings',
        sequelize,
        indexes: [
            { fields: ['status'] },
            { fields: ['guest_email'] },
            { fields: ['hold_expires_at'] },
        ],
    }
);

export default Booking;
