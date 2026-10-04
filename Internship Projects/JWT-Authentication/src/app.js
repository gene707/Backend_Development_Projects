import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { initStore } from './models/userStore.js';

const app = express();

// Initialize user storage with seed accounts
await initStore();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'JWT Authentication Service',
    timestamp: new Date().toISOString()
  });
});

// Root Overview
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'JWT Authentication API',
    endpoints: {
      register: 'POST /api/auth/register',
      login: 'POST /api/auth/login',
      currentUserProfile: 'GET /api/auth/me (Protected - Any user)',
      adminDashboard: 'GET /api/admin/dashboard (Protected - Admin only)'
    },
    demoAccounts: {
      admin: { email: 'admin@example.com', password: 'AdminPassword123!' },
      user: { email: 'user@example.com', password: 'UserPassword123!' }
    }
  });
});

// Mount Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: `Endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Centralized Error Handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

export default app;
