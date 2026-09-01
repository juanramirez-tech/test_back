import express from 'express';
import { Op } from 'sequelize';
import Court from '../../models/court';
import { getCourtAvailability, getCourtsAvailability } from '../../services/availabilityService';
import { toPublicCourt } from '../../utils/courtSerializer';
import { isDateYmd } from '../../utils/timezone';

const router = express.Router();

function parseId(raw: string | undefined): number | null {
    if (!raw) {
        return null;
    }
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    return id;
}

function parseCourtIds(raw: unknown): number[] | null {
    if (raw === undefined || raw === null || raw === '') {
        return null;
    }
    const values = String(raw).split(',').map((part) => Number(part.trim()));
    if (values.some((id) => !Number.isInteger(id) || id <= 0)) {
        return [];
    }
    return values;
}

router.get('/', async (_req, res) => {
    try {
        const courts = await Court.findAll({
            where: { status: 'active' },
            order: [['name', 'ASC']],
        });
        return res.status(200).json(courts.map(toPublicCourt));
    } catch (error) {
        console.error('Error listing courts:', error);
        return res.status(500).json({ error: 'Error al listar canchas' });
    }
});

router.get('/availability', async (req, res) => {
    try {
        const date = typeof req.query.date === 'string' ? req.query.date : '';
        if (!isDateYmd(date)) {
            return res.status(400).json({ error: 'Query date debe ser una fecha calendario válida (YYYY-MM-DD)' });
        }

        const parsedIds = parseCourtIds(req.query.court_ids);
        if (parsedIds && parsedIds.length === 0) {
            return res.status(400).json({ error: 'court_ids inválido' });
        }

        const where: { status: string; id?: { [Op.in]: number[] } } = { status: 'active' };
        if (parsedIds) {
            where.id = { [Op.in]: parsedIds };
        }

        const courts = await Court.findAll({
            where,
            order: [['name', 'ASC']],
        });

        const availability = await getCourtsAvailability(courts, date);
        return res.status(200).json(availability);
    } catch (error) {
        console.error('Error fetching availability:', error);
        return res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
});

router.get('/:id/availability', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        const date = typeof req.query.date === 'string' ? req.query.date : '';
        if (!id) {
            return res.status(400).json({ error: 'ID de cancha inválido' });
        }
        if (!isDateYmd(date)) {
            return res.status(400).json({ error: 'Query date debe ser una fecha calendario válida (YYYY-MM-DD)' });
        }

        const court = await Court.findOne({ where: { id, status: 'active' } });
        if (!court) {
            return res.status(404).json({ error: 'Cancha no encontrada' });
        }

        const availability = await getCourtAvailability(court, date);
        return res.status(200).json(availability);
    } catch (error) {
        console.error('Error fetching court availability:', error);
        return res.status(500).json({ error: 'Error al consultar disponibilidad' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = parseId(req.params.id);
        if (!id) {
            return res.status(400).json({ error: 'ID de cancha inválido' });
        }

        const court = await Court.findOne({ where: { id, status: 'active' } });
        if (!court) {
            return res.status(404).json({ error: 'Cancha no encontrada' });
        }

        return res.status(200).json(toPublicCourt(court));
    } catch (error) {
        console.error('Error fetching court:', error);
        return res.status(500).json({ error: 'Error al consultar la cancha' });
    }
});

export default router;
