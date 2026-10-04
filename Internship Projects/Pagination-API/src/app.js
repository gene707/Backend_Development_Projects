import express from 'express';
import cors from 'cors';
import itemsRoutes from './routes/itemsRoutes.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Pagination API Service',
    timestamp: new Date().toISOString()
  });
});

// Root Overview
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'Pagination API',
    description: 'Paginated product/book library API with filtering and sorting capabilities',
    sampleEndpoints: [
      'GET /api/items?page=1&limit=10',
      'GET /api/items?page=2&limit=5&sortBy=price&sortOrder=desc',
      'GET /api/items?category=Technology&minRating=4.8',
      'GET /api/items?search=design',
      'GET /api/categories',
      'GET /api/items/1'
    ]
  });
});

// Mount Routes
app.use('/api/items', itemsRoutes);
app.get('/api/categories', (req, res, next) => {
  import('./controllers/itemsController.js').then(c => c.getCategories(req, res, next)).catch(next);
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`
  });
});

// Centralized Error Handler
app.use((err, _req, res, _next) => {
  console.error('Unhandled error in Pagination API:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
});

export default app;
