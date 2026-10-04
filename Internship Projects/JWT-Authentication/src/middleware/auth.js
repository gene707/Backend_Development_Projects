import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from '../config/jwt.js';
import * as userStore from '../models/userStore.js';

// Authenticate JWT Token middleware
export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Authorization header is required (Format: Bearer <token>)'
    });
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Malformed authorization header. Expected format: Bearer <token>'
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(token, JWT_CONFIG.secret);

    // Verify user still exists in database
    const user = await userStore.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: User associated with this token no longer exists'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Token has expired',
        expiredAt: err.expiredAt
      });
    }

    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid token signature'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Token verification failed'
    });
  }
}
