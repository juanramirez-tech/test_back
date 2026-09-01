import express from 'express';
import User from '../../../models/users';
import Profile from '../../../models/profile';
import validateRequired from '../../../middlewares/validateRequired';
import bcrypt from 'bcrypt';
import {
    isAllowedRole,
    isAllowedStatus,
    toPublicUser,
    validatePassword,
} from '../../../config/security';

const router = express.Router();

router.post('/', validateRequired(['name', 'email', 'password', 'phone', 'role', 'status', 'address', 'document', 'document_type', 'birth_date']), async (req, res) => {
    try {
        const { name, email, password, phone, role, status, address, document, document_type, birth_date } = req.body;

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }
        if (!isAllowedRole(role) || !isAllowedStatus(status)) {
            return res.status(400).json({ error: 'Rol o estado no permitido' });
        }

        const existingUser = await User.unscoped().findOne({ where: { email } });
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists' });
        }

        const encryptedPassword = await bcrypt.hash(password, 12);
        const user = await User.create({ name, email, password: encryptedPassword, phone, role, status });

        const userId = user.id;
        if (!userId) {
            return res.status(500).json({ error: 'User creation failed' });
        }

        const profile = await Profile.create({
            user_id: userId,
            address,
            document,
            document_type,
            birth_date,
        });

        return res.status(201).json({ user: toPublicUser(user), profile });
    } catch (error) {
        console.error('Error creating user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/', async (req, res) => {
    try {
        const users = await User.findAll();
        return res.status(200).json(users.map((user) => toPublicUser(user)));
    } catch (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        if (!req.params.id) {
            return res.status(400).json({ error: 'User ID is required' });
        }

        const user = await User.findOne({ where: { id: req.params.id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        return res.status(200).json(toPublicUser(user));
    } catch (error) {
        console.error('Error fetching user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', validateRequired(['name', 'email', 'password', 'phone', 'role', 'status']), async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, password, phone, role, status } = req.body;

        const passwordError = validatePassword(password);
        if (passwordError) {
            return res.status(400).json({ error: passwordError });
        }
        if (!isAllowedRole(role) || !isAllowedStatus(status)) {
            return res.status(400).json({ error: 'Rol o estado no permitido' });
        }

        const user = await User.unscoped().findOne({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        const encryptedPassword = await bcrypt.hash(password, 12);
        await user.update({ name, email, password: encryptedPassword, phone, role, status });
        return res.status(200).json(toPublicUser(user));
    } catch (error) {
        console.error('Error updating user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const user = await User.findOne({ where: { id } });
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        await user.destroy();
        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Error deleting user:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
