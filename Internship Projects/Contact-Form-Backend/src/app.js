import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import contactRouter from './routes/contact.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static interactive demo form
app.use(express.static(path.join(__dirname, '../public')));

// Health check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Contact Form Backend',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/contact', contactRouter);

// 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `API endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    message: 'An unexpected internal server error occurred'
  });
});

export default app;
