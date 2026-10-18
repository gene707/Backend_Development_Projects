import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

export const apiLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests',
    errors: [
      {
        field: 'rate_limit',
        message: `Too many requests from this client. Please retry after ${Math.ceil(config.rateLimitWindowMs / 60000)} minutes.`,
      },
    ],
  },
});
