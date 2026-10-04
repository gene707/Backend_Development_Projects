import { Router } from 'express';
import * as adminController from '../controllers/adminController.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';

const router = Router();

// Protected admin-only route: requires valid JWT token AND 'admin' role
router.get('/dashboard', authenticateToken, requireRole('admin'), adminController.getAdminDashboard);
router.get('/stats', authenticateToken, requireRole('admin'), adminController.getAdminDashboard);

export default router;
