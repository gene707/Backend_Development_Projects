// 404 Not Found handler for undefined routes
export function notFoundHandler(req, res, _next) {
  res.status(404).json({
    success: false,
    message: `Endpoint ${req.method} ${req.originalUrl} not found`
  });
}

// Global centralized error handling middleware
export function errorHandler(err, _req, res, _next) {
  console.error('Unhandled server error:', err);
  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}
