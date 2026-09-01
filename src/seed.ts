import bcrypt from 'bcrypt';
import { isProduction } from './config/security';
import Court from './models/court';
import User from './models/users';

const DEFAULT_COURTS = [
    {
        name: 'Cancha de fútbol 1',
        description: 'Cancha de fútbol 11 con césped sintético',
        slot_minutes: 60 as const,
        price_per_hour: '80000.00',
        opens_at: '08:00:00',
        closes_at: '22:00:00',
        timezone: 'America/Bogota',
        status: 'active' as const,
    },
    {
        name: 'Cancha de tenis 1',
        description: 'Cancha de tenis dura, iluminación nocturna',
        slot_minutes: 30 as const,
        price_per_hour: '45000.00',
        opens_at: '08:00:00',
        closes_at: '22:00:00',
        timezone: 'America/Bogota',
        status: 'active' as const,
    },
    {
        name: 'Cancha múltiple',
        description: 'Baloncesto / voleibol, cubierto',
        slot_minutes: 60 as const,
        price_per_hour: '50000.00',
        opens_at: '08:00:00',
        closes_at: '22:00:00',
        timezone: 'America/Bogota',
        status: 'active' as const,
    },
];

async function seedAdmin(): Promise<void> {
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;

    if (!adminEmail || !adminPassword || adminPassword.length < 8) {
        console.warn('Seed admin omitido: configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD');
        return;
    }

    const encryptedAdminPassword = await bcrypt.hash(adminPassword, 12);
    const [admin] = await User.unscoped().findOrCreate({
        where: { email: adminEmail },
        defaults: {
            name: 'admin',
            email: adminEmail,
            password: encryptedAdminPassword,
            phone: '1234567890',
            role: 'admin',
            status: 'active',
        }
    });
    await admin.update({
        password: encryptedAdminPassword,
        role: 'admin',
        status: 'active',
    });
}

async function seedCourts(): Promise<void> {
    for (const court of DEFAULT_COURTS) {
        await Court.findOrCreate({
            where: { name: court.name },
            defaults: court,
        });
    }
}

async function seed(): Promise<void> {
    if (isProduction()) {
        return;
    }

    await seedAdmin();
    await seedCourts();
}

export default seed;
