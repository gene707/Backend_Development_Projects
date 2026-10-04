import express from 'express';
import cors from 'cors';
import productsRouter from './routes/products.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'Simple REST API (Product List)',
    timestamp: new Date().toISOString()
  });
});

// Root Info
app.get('/', (_req, res) => {
  res.status(200).json({
    message: 'Welcome to the Product List REST API',
    documentation: 'See README.md for complete endpoint documentation',
    endpoints: {
      health: 'GET /health',
      listProducts: 'GET /api/products',
      getProduct: 'GET /api/products/:id',
      createProduct: 'POST /api/products',
      updateProduct: 'PUT /api/products/:id',
      patchProduct: 'PATCH /api/products/:id',
      deleteProduct: 'DELETE /api/products/:id'
    }
  });
});

// API Routes
app.use('/api/products', productsRouter);

// Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
