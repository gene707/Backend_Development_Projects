import { Router } from 'express';
import { query } from '../../db/connection.js';
import { messageBroker } from '../../broker/messageBroker.js';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.js';

const router = Router();

// Middleware: All admin routes require valid JWT and either 'admin' or 'manager' role
router.use(authenticateJWT);
router.use(authorizeRoles('admin', 'manager'));

/**
 * GET /api/v1/admin/audit-logs
 * Retrieves security and regulatory audit logs. Accessible by admin and manager.
 */
router.get('/audit-logs', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit || '50', 10);
    const rows = await query(
      `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT ?;`,
      [limit]
    );

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/admin/broker-stats
 * Telemetry endpoint for asynchronous message queue depth and worker throughput.
 */
router.get('/broker-stats', (req, res) => {
  const stats = messageBroker.getQueueStats();
  res.status(200).json({
    success: true,
    data: stats,
  });
});

/**
 * GET /api/v1/admin/users
 * Lists all registered users and roles. Restricted strictly to 'admin' tier.
 */
router.get('/users', authorizeRoles('admin'), async (req, res, next) => {
  try {
    const rows = await query('SELECT id, username, email, role, created_at FROM users ORDER BY id ASC;');
    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
