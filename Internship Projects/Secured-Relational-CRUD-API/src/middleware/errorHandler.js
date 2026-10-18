/**
 * 404 Not Found handler for undefined route endpoints.
 */
export function notFoundHandler(req, res) {
  res.status(404).json({
    success: false,
    message: 'Resource not found',
    errors: [
      {
        field: 'path',
        message: `Endpoint ${req.method} ${req.originalUrl} does not exist on this server`,
      },
    ],
  });
}

/**
 * Centralized error handler middleware.
 * Intercepts uncaught exceptions and database constraint violations.
 */
export function errorHandler(err, req, res, next) {
  // Invalid JSON payload in body
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload',
      errors: [{ field: 'body', message: 'The request body could not be parsed as valid JSON' }],
    });
  }

  // SQLite constraint violations
  if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    // Unique constraint violation (e.g. duplicate project code)
    if (err.message.includes('UNIQUE')) {
      return res.status(409).json({
        success: false,
        message: 'Conflict: Unique constraint violation',
        errors: [{ field: 'conflict', message: err.message.replace('SQLITE_CONSTRAINT: ', '') }],
      });
    }

    // Foreign key constraint violation (e.g. non-existent project_id)
    if (err.message.includes('FOREIGN KEY')) {
      return res.status(400).json({
        success: false,
        message: 'Foreign key constraint violation',
        errors: [{ field: 'foreign_key', message: 'The referenced parent entity (e.g. project_id) does not exist' }],
      });
    }

    // Check constraint violation
    if (err.message.includes('CHECK')) {
      return res.status(400).json({
        success: false,
        message: 'Check constraint violation',
        errors: [{ field: 'constraint', message: 'One or more values violated database check rules' }],
      });
    }
  }

  // Log error on terminal for server administrator
  console.error('\x1b[31m[Unhandled Server Error]\x1b[0m', err);

  const isProduction = process.env.NODE_ENV === 'production';

  res.status(err.status || 500).json({
    success: false,
    message: isProduction ? 'Internal server error' : err.message || 'Internal server error',
    ...(isProduction ? {} : { stack: err.stack }),
  });
}
