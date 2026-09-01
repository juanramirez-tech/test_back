import express from 'express';

// Import midelwares
import auth from './middlewares/auth';
import jwt from './middlewares/jwt';
import verifyRoles from './middlewares/verifyRoles';

// Import routes
import login from './routes/auth/login';
import file from './routes/file/file';
import adminUsers from './routes/admin/users/users';
import adminCourts from './routes/admin/courts/courts';
import adminBookings from './routes/admin/bookings/bookings';
import userProfile from './routes/users/profile';
import courts from './routes/courts/courts';
import bookings from './routes/bookings/bookings';

const router = express();

// Routes file
router.use('/file', jwt, verifyRoles(['admin']), file);

// Routes login
router.use('/login', auth, login);

// Routes admin
router.use('/admin/users', jwt, verifyRoles(['admin']), adminUsers);
router.use('/api/v1/admin/courts', jwt, verifyRoles(['admin']), adminCourts);
router.use('/api/v1/admin/bookings', jwt, verifyRoles(['admin']), adminBookings);

// Routes public
router.use('/users/profile', jwt, verifyRoles(['user']), userProfile);
router.use('/api/v1/courts', courts);
router.use('/api/v1/bookings', bookings);

export default router;