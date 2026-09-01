import express from 'express';

// Import midelwares
import auth from './middlewares/auth';
import jwt from './middlewares/jwt';
import verifyRoles from './middlewares/verifyRoles';

// Import routes
import login from './routes/auth/login';
import file from './routes/file/file';
import adminUsers from './routes/admin/users/users';
import userProfile from './routes/users/profile';

const router = express();

// Routes file
router.use('/file', jwt, verifyRoles(['admin']), file);

// Routes login
router.use('/login', auth, login);

// Routes admin
router.use('/admin/users', jwt, verifyRoles(['admin']), adminUsers);

// Routes public
router.use('/users/profile', jwt, verifyRoles(['user']), userProfile);

export default router;