import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ReservationSlotAttributes {
    id: number;
    booking_id: number;
    court_id: number;
    starts_at: Date;
}

interface ReservationSlotCreationAttributes extends Optional<ReservationSlotAttributes, 'id'> { }

class ReservationSlot extends Model<ReservationSlotAttributes, ReservationSlotCreationAttributes>
    implements ReservationSlotAttributes {
    public id!: number;
    public booking_id!: number;
    public court_id!: number;
    public starts_at!: Date;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

ReservationSlot.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        booking_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'bookings',
                key: 'id',
            },
            onDelete: 'CASCADE',
            onUpdate: 'CASCADE',
        },
        court_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'courts',
                key: 'id',
            },
            onDelete: 'RESTRICT',
            onUpdate: 'CASCADE',
        },
        starts_at: {
            type: DataTypes.DATE,
            allowNull: false,
            comment: 'UTC',
        },
    },
    {
        tableName: 'reservation_slots',
        sequelize,
        indexes: [
            {
                unique: true,
                fields: ['court_id', 'starts_at'],
                name: 'reservation_slots_court_starts_unique',
            },
            {
                fields: ['booking_id'],
                name: 'reservation_slots_booking_id',
            },
        ],
    }
);

export default ReservationSlot;
