import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config/index.js';
import { apiLimiter } from './middleware/rateLimiter.js';
import { requestLogger } from './middleware/logger.js';
import { enforceJsonContentType, sanitizePayload } from './middleware/security.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { get } from './db/connection.js';

import projectRoutes from './routes/projectRoutes.js';
import taskRoutes from './routes/taskRoutes.js';
import statsRoutes from './routes/statsRoutes.js';

const app = express();

// 1. Security HTTP Headers
app.use(helmet());

// 2. CORS Configuration
app.use(cors({ origin: config.corsOrigin }));

// 3. Request Body Parsing (Restricted payload size to 100kb to mitigate payload bombing)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// 4. Content-Type and Payload Sanitization Middleware
app.use(enforceJsonContentType);
app.use(sanitizePayload);

// 5. Terminal Request Logging Middleware
if (config.env !== 'test') {
  app.use(requestLogger);
}

// 6. Rate Limiting Middleware applied to /api/ routes
app.use('/api/', apiLimiter);

// 7. Health Check & Diagnostics Endpoint
app.get('/health', async (req, res) => {
  try {
    const dbCheck = await get('SELECT 1 as active;');
    const isDbActive = dbCheck && dbCheck.active === 1;

    res.status(200).json({
      status: 'UP',
      service: 'Secured Relational CRUD API Server',
      database: isDbActive ? 'CONNECTED (SQLite Relational)' : 'DISCONNECTED',
      environment: config.env,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    res.status(503).json({
      status: 'DOWN',
      service: 'Secured Relational CRUD API Server',
      database: 'ERROR',
      error: err.message,
    });
  }
});

// 8. API Resource Routing Engine
app.use('/api/v1/projects', projectRoutes);
app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/stats', statsRoutes);

// 9. Root Route
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Secured Relational CRUD API Server',
    version: '1.0.0',
    documentation: '/api/v1',
    endpoints: {
      health: 'GET /health',
      projects: 'GET /api/v1/projects',
      tasks: 'GET /api/v1/tasks',
      stats: 'GET /api/v1/stats',
    },
  });
});

// 10. 404 Handler & Centralized Error Handler
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
