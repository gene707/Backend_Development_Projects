import express from 'express';
import cors from 'cors';
import authRoutes from './api/routes/authRoutes.js';
import transactionRoutes from './api/routes/transactionRoutes.js';
import adminRoutes from './api/routes/adminRoutes.js';
import { messageBroker } from './broker/messageBroker.js';
import { get } from './db/connection.js';
import { config } from './config/index.js';

const app = express();

app.use(cors());
app.use(express.json());

// Diagnostics & Health Endpoint
app.get('/health', async (req, res) => {
  try {
    const dbTest = await get('SELECT 1 as active;');
    const isDbActive = dbTest && dbTest.active === 1;

    res.status(200).json({
      status: 'UP',
      service: 'Role-Based Microservice API Ecosystem with Message Brokers',
      database: isDbActive ? 'CONNECTED (SQLite Relational)' : 'DISCONNECTED',
      broker: messageBroker.getBrokerType(),
      queue: config.queueName,
      port: config.port,
      environment: config.env,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      error: err.message,
    });
  }
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/admin', adminRoutes);

// Root
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Role-Based Microservice API Ecosystem with Asynchronous Message Brokers',
    version: '1.0.0',
    rbacTiers: ['admin', 'manager', 'user'],
    endpoints: {
      health: 'GET /health',
      auth: '/api/v1/auth',
      transactions: '/api/v1/transactions',
      admin: '/api/v1/admin',
    },
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`,
  });
});

// Centralized Error Handler
app.use((err, req, res, next) => {
  console.error('[Ecosystem Error]', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
  });
});

export default app;
