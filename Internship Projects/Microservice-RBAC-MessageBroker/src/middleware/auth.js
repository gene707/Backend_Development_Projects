import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { run } from '../db/connection.js';

/**
 * Signs and generates a JSON Web Token (JWT) with user identity and RBAC role.
 */
export function generateToken(user) {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role, // 'admin', 'manager', 'user'
  };

  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}

/**
 * Middleware: Verifies incoming JWT Bearer token.
 */
export function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Missing or malformed Authorization header. Expected Bearer token.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: Invalid, expired, or tampered token',
      error: err.name,
    });
  }
}

/**
 * Middleware: Enforces Role-Based Access Control (RBAC) tiers.
 *
 * @param  {...string} allowedRoles Roles permitted to access the endpoint (e.g. 'admin', 'manager')
 */
export function authorizeRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden: Access restricted. Your role '${req.user.role}' does not have sufficient permissions. Required: [${allowedRoles.join(', ')}]`,
      });
    }

    next();
  };
}

/**
 * Records an audit log entry for security and regulatory compliance.
 */
export async function recordAudit(userId, username, role, action, resource, ip, statusCode) {
  try {
    await run(
      `INSERT INTO audit_logs (user_id, username, role, action, resource, ip, status_code)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [userId || null, username || 'Anonymous', role || 'none', action, resource, ip || 'unknown', statusCode || 200]
    );
  } catch (err) {
    console.error('[Audit Error] Failed to record audit log:', err.message);
  }
}
