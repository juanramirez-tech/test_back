import User from './models/users';
import bcrypt from 'bcrypt';
import { isProduction } from './config/security';

async function seed(): Promise<void> {
    if (isProduction()) {
        return;
    }

    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    const userEmail = process.env.SEED_USER_EMAIL;
    const userPassword = process.env.SEED_USER_PASSWORD;

    if (!adminEmail || !adminPassword || adminPassword.length < 8) {
        console.warn('Seed omitido: configura SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD');
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

    if (!userEmail || !userPassword || userPassword.length < 8) {
        return;
    }

    const encryptedUserPassword = await bcrypt.hash(userPassword, 12);
    const [user] = await User.unscoped().findOrCreate({
        where: { email: userEmail },
        defaults: {
            name: 'user',
            email: userEmail,
            password: encryptedUserPassword,
            phone: '1234567890',
            role: 'user',
            status: 'active',
        }
    });
    await user.update({
        password: encryptedUserPassword,
        role: 'user',
        status: 'active',
    });
}

export default seed;
