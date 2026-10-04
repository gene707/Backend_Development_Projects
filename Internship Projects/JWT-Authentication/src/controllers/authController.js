import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { JWT_CONFIG } from '../config/jwt.js';
import * as userStore from '../models/userStore.js';

// POST /api/auth/register
export async function register(req, res) {
  try {
    const { name, email, password, role } = req.body;

    // Check if user with email already exists
    const existing = await userStore.findByEmail(email);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered. Please sign in or use another email address.'
      });
    }

    const newUser = await userStore.createUser({ name, email, password, role });

    // Generate JWT token for immediate sign-in convenience
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: newUser
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, error: 'Registration failed due to an internal error' });
  }
}

// POST /api/auth/login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    const user = await userStore.findByEmail(email);
    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Verify hashed password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password'
      });
    }

    // Sign JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_CONFIG.secret,
      { expiresIn: JWT_CONFIG.expiresIn }
    );

    const { passwordHash: _hash, ...safeUser } = user;

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      tokenType: 'Bearer',
      expiresIn: JWT_CONFIG.expiresIn,
      user: safeUser
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Login failed due to an internal error' });
  }
}

// GET /api/auth/me (Protected Route for Authenticated Users)
export async function getCurrentUser(req, res) {
  res.status(200).json({
    success: true,
    message: 'Profile retrieved successfully',
    user: req.user
  });
}
