import { Router } from 'express';
import * as authController from '../controllers/authController.js';
import { validateRegister, validateLogin } from '../middleware/validation.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);

// Protected route for any authenticated user
router.get('/me', authenticateToken, authController.getCurrentUser);
router.get('/profile', authenticateToken, authController.getCurrentUser);

export default router;
