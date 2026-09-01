import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export const COURT_SLOT_MINUTES = [30, 60] as const;
export type CourtSlotMinutes = (typeof COURT_SLOT_MINUTES)[number];

export const COURT_STATUSES = ['active', 'inactive'] as const;
export type CourtStatus = (typeof COURT_STATUSES)[number];

export interface CourtAttributes {
    id: number;
    name: string;
    description: string;
    slot_minutes: CourtSlotMinutes;
    price_per_hour: string;
    opens_at: string;
    closes_at: string;
    timezone: string;
    status: CourtStatus;
}

interface CourtCreationAttributes extends Optional<CourtAttributes, 'id' | 'description' | 'timezone' | 'status'> { }

class Court extends Model<CourtAttributes, CourtCreationAttributes> implements CourtAttributes {
    public id!: number;
    public name!: string;
    public description!: string;
    public slot_minutes!: CourtSlotMinutes;
    public price_per_hour!: string;
    public opens_at!: string;
    public closes_at!: string;
    public timezone!: string;
    public status!: CourtStatus;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

Court.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: false,
            unique: true,
        },
        description: {
            type: DataTypes.STRING(512),
            allowNull: false,
            defaultValue: '',
        },
        slot_minutes: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                isIn: [COURT_SLOT_MINUTES],
            },
        },
        price_per_hour: {
            type: DataTypes.DECIMAL(10, 2),
            allowNull: false,
            validate: {
                min: 0,
            },
        },
        opens_at: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        closes_at: {
            type: DataTypes.TIME,
            allowNull: false,
        },
        timezone: {
            type: DataTypes.STRING(64),
            allowNull: false,
            defaultValue: 'America/Bogota',
        },
        status: {
            type: DataTypes.STRING(32),
            allowNull: false,
            defaultValue: 'active',
            validate: {
                isIn: [COURT_STATUSES],
            },
        },
    },
    {
        tableName: 'courts',
        sequelize,
        indexes: [
            { fields: ['status'] },
        ],
    }
);

export default Court;
