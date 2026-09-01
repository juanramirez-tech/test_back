
import { Model, DataTypes, Optional } from 'sequelize';
import sequelize from '../config/database';

export interface ProfileAttributes {
    id: number;
    user_id: number;
    address: string;
    document: string;
    document_type: string;
    birth_date: Date;
}

interface ProfileCreationAttributes extends Optional<ProfileAttributes, 'id'> { }

class Profile extends Model<ProfileAttributes, ProfileCreationAttributes> implements ProfileAttributes {
    public id!: number;
    public user_id!: number;
    public address!: string;
    public document!: string;
    public document_type!: string;
    public birth_date!: Date;

    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;

}

Profile.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    address: {
        type: DataTypes.STRING,
        allowNull: false
    },
    document: {
        type: DataTypes.STRING,
        allowNull: false
    },
    document_type: {
        type: DataTypes.STRING,
        allowNull: false
    },
    birth_date: {
        type: DataTypes.DATE,
        allowNull: false
    }
}, {
    sequelize,
    tableName: 'profiles'
});

export default Profile;