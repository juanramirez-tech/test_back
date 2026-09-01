import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize(
    process.env.DB_NAME as string,
    process.env.DB_USER as string,
    process.env.DB_PASSWORD as string,
    {
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT || '3306', 10),
        dialect: 'mysql',
        timezone: '+00:00',
        logging: false
    }
);

export default sequelize;

export async function waitForDatabase(attempts = 20, delayMs = 2000): Promise<void> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
        try {
            await sequelize.authenticate();
            return;
        } catch (error) {
            lastError = error;
            console.log(`Esperando MySQL (${attempt}/${attempts})...`);
            await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
    }
    throw lastError;
}