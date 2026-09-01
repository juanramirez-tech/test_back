import express, { Request, Response } from 'express';
import Profile from '../../models/profile';

const router = express.Router();

router.get('/', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const profile = await Profile.findOne({ where: { user_id: userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        return res.status(200).json({ profile });
    } catch (error) {
        console.error('Error fetching profile:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/', async (req: Request, res: Response) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'Usuario no autenticado' });
        }

        const { address, document, document_type, birth_date } = req.body;
        const profile = await Profile.findOne({ where: { user_id: userId } });
        if (!profile) {
            return res.status(404).json({ error: 'Perfil no encontrado' });
        }

        await profile.update({
            address,
            document,
            document_type,
            birth_date: birth_date ? new Date(birth_date) : profile.birth_date,
        });

        return res.status(200).json({
            message: 'Profile updated successfully',
            profile: {
                id: profile.id,
                user_id: profile.user_id,
                address: profile.address,
                document: profile.document,
                document_type: profile.document_type,
                birth_date: profile.birth_date,
                createdAt: profile.createdAt,
                updatedAt: profile.updatedAt,
            },
        });
    } catch (error) {
        console.error('Error updating profile:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
