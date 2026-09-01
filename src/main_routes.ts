import express from 'express';

import auth from './middlewares/auth';
import jwt from './middlewares/jwt';
import verifyRoles from './middlewares/verifyRoles';

import login from './routes/auth/login';
import adminCourts from './routes/admin/courts/courts';
import adminBookings from './routes/admin/bookings/bookings';
import courts from './routes/courts/courts';
import bookings from './routes/bookings/bookings';

const router = express();

router.use('/login', auth, login);

router.use('/api/v1/admin/courts', jwt, verifyRoles(['admin']), adminCourts);
router.use('/api/v1/admin/bookings', jwt, verifyRoles(['admin']), adminBookings);

router.use('/api/v1/courts', courts);
router.use('/api/v1/bookings', bookings);

export default router;
