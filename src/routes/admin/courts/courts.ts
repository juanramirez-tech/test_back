import express from 'express';
import {
    createCourt,
    getAdminCourt,
    listAdminCourts,
    updateCourt,
} from '../../../services/courtService';
import validateRequired from '../../../middlewares/validateRequired';
import { sendError } from '../../../utils/httpError';

const router = express.Router();

router.get('/', async (_req, res) => {
    try {
        return res.status(200).json(await listAdminCourts());
    } catch (error) {
        return sendError(res, error, 'Error al listar canchas');
    }
});

router.post(
    '/',
    validateRequired(['name', 'slot_minutes', 'price_per_hour', 'opens_at', 'closes_at']),
    async (req, res) => {
        try {
            const court = await createCourt(req.body as Record<string, unknown>);
            return res.status(201).json(court);
        } catch (error) {
            return sendError(res, error, 'Error al crear la cancha');
        }
    }
);

router.get('/:id', async (req, res) => {
    try {
        return res.status(200).json(await getAdminCourt(req.params.id));
    } catch (error) {
        return sendError(res, error, 'Error al consultar la cancha');
    }
});

router.put('/:id', async (req, res) => {
    try {
        const court = await updateCourt(req.params.id, req.body as Record<string, unknown>, false);
        return res.status(200).json(court);
    } catch (error) {
        return sendError(res, error, 'Error al actualizar la cancha');
    }
});

router.patch('/:id', async (req, res) => {
    try {
        const court = await updateCourt(req.params.id, req.body as Record<string, unknown>, true);
        return res.status(200).json(court);
    } catch (error) {
        return sendError(res, error, 'Error al actualizar la cancha');
    }
});

export default router;
