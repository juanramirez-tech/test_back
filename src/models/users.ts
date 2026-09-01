import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface UserAttributes {
    id: number;
    name: string;
    email: string;
    password: string;
    phone: string;
    role: string;
    status: string;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> { }

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
    public id!: number;
    public name!: string;
    public email!: string;
    public password!: string;
    public phone!: string;
    public role!: string;
    public status!: string;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
}

User.init(
    {
        id: {
            type: DataTypes.BIGINT,
            autoIncrement: true,
            primaryKey: true,
            unique: true,
        },
        name: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        email: {
            type: DataTypes.STRING(128),
            allowNull: false,
            unique: true,
            validate: {
                isEmail: true,
            },
        },
        password: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        phone: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        role: {
            type: DataTypes.STRING(128),
            allowNull: false,
        },
        status: {
            type: DataTypes.STRING(128),
            allowNull: false,
        }
    },
    {
        tableName: 'users',
        sequelize,
        defaultScope: {
            attributes: { exclude: ['password'] },
        },
    }
);


export default User;