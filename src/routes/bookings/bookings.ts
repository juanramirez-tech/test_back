import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    cancelBooking,
    createBooking,
    getBookingByAccessCode,
    payBooking,
} from '../../services/bookingService';
import { sendError } from '../../utils/httpError';
import validateRequired from '../../middlewares/validateRequired';
import { requireAccessCode } from '../../middlewares/requireAccessCode';

const router = express.Router();

const createBookingLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas reservas desde esta IP, intenta más tarde' },
});

router.post(
    '/',
    createBookingLimiter,
    validateRequired(['guest_name', 'guest_email', 'guest_phone', 'items']),
    async (req, res) => {
        try {
            const booking = await createBooking(req.body as Record<string, unknown>);
            return res.status(201).json(booking);
        } catch (error) {
            return sendError(res, error, 'Error al crear la reserva');
        }
    }
);

router.get('/mine', requireAccessCode, async (req, res) => {
    try {
        const booking = await getBookingByAccessCode(req.accessCode as string);
        return res.status(200).json(booking);
    } catch (error) {
        return sendError(res, error, 'Error al consultar la reserva');
    }
});

router.post('/pay', requireAccessCode, async (req, res) => {
    try {
        const booking = await payBooking(req.accessCode as string);
        return res.status(200).json(booking);
    } catch (error) {
        return sendError(res, error, 'Error al registrar el pago');
    }
});

router.post('/cancel', requireAccessCode, async (req, res) => {
    try {
        const booking = await cancelBooking(req.accessCode as string);
        return res.status(200).json(booking);
    } catch (error) {
        return sendError(res, error, 'Error al cancelar la reserva');
    }
});

export default router;
