import express from 'express';
import {
    cancelBookingById,
    confirmBookingById,
    getBookingById,
    listBookings,
} from '../../../services/bookingService';
import { sendError } from '../../../utils/httpError';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const result = await listBookings(req.query as Record<string, unknown>);
        return res.status(200).json(result);
    } catch (error) {
        return sendError(res, error, 'Error al listar reservas');
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID de reserva inválido' });
        }
        return res.status(200).json(await getBookingById(id));
    } catch (error) {
        return sendError(res, error, 'Error al consultar la reserva');
    }
});

router.post('/:id/confirm', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID de reserva inválido' });
        }
        return res.status(200).json(await confirmBookingById(id));
    } catch (error) {
        return sendError(res, error, 'Error al confirmar la reserva');
    }
});

router.post('/:id/cancel', async (req, res) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ error: 'ID de reserva inválido' });
        }
        return res.status(200).json(await cancelBookingById(id));
    } catch (error) {
        return sendError(res, error, 'Error al cancelar la reserva');
    }
});

export default router;
