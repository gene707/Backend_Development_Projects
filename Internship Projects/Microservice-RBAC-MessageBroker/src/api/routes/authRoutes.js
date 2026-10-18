import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { run, get } from '../../db/connection.js';
import { generateToken, authenticateJWT, recordAudit } from '../../middleware/auth.js';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Registers a new user and issues a signed JWT token.
 */
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password, role = 'user' } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed: username, email, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long',
      });
    }

    // Role validation (Default: 'user'. Only 'admin', 'manager', 'user' permitted)
    const validRoles = ['admin', 'manager', 'user'];
    const assignedRole = validRoles.includes(role.toLowerCase()) ? role.toLowerCase() : 'user';

    // Check duplicate
    const existing = await get('SELECT id FROM users WHERE username = ? OR email = ?;', [username, email]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Username or email already registered',
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const result = await run(
      `INSERT INTO users (username, email, password_hash, role) VALUES (?, ?, ?, ?);`,
      [username.trim(), email.trim().toLowerCase(), passwordHash, assignedRole]
    );

    const newUser = { id: result.lastID, username: username.trim(), email: email.trim().toLowerCase(), role: assignedRole };
    const token = generateToken(newUser);

    await recordAudit(newUser.id, newUser.username, newUser.role, 'USER_REGISTER', '/api/v1/auth/register', req.ip, 201);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: newUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * Validates credentials and returns a signed JWT token.
 */
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    const user = await get('SELECT * FROM users WHERE username = ? COLLATE NOCASE;', [username]);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      await recordAudit(user.id, user.username, user.role, 'LOGIN_FAILED', '/api/v1/auth/login', req.ip, 401);
      return res.status(401).json({
        success: false,
        message: 'Invalid username or password',
      });
    }

    const safeUser = { id: user.id, username: user.username, email: user.email, role: user.role };
    const token = generateToken(safeUser);

    await recordAudit(safeUser.id, safeUser.username, safeUser.role, 'LOGIN_SUCCESS', '/api/v1/auth/login', req.ip, 200);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: safeUser,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/auth/me
 * Retrieves profile of currently authenticated user.
 */
router.get('/me', authenticateJWT, async (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

export default router;
