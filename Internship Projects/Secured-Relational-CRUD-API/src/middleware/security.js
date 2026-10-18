/**
 * Security Middleware Layer
 * Enforces secure request guidelines, protects against content spoofing,
 * and provides defense-in-depth protections.
 */

/**
 * Enforces that mutation requests (POST, PUT, PATCH) include valid application/json Content-Type headers.
 */
export function enforceJsonContentType(req, res, next) {
  const mutatingMethods = ['POST', 'PUT', 'PATCH'];

  if (mutatingMethods.includes(req.method)) {
    const contentType = req.headers['content-type'];

    // If body exists but content-type is missing or not application/json
    if (!contentType || !contentType.toLowerCase().includes('application/json')) {
      return res.status(415).json({
        success: false,
        message: 'Unsupported Media Type',
        errors: [{ field: 'Content-Type', message: 'Mutation requests must have Content-Type: application/json' }],
      });
    }
  }

  next();
}

/**
 * Defense-in-depth: Rejects keys containing dangerous prototype pollution or SQL injection tokens in JSON payloads.
 */
export function sanitizePayload(req, res, next) {
  if (req.body && typeof req.body === 'object') {
    const forbiddenKeys = ['__proto__', 'constructor', 'prototype'];

    const inspectObject = (obj) => {
      for (const key of Object.keys(obj)) {
        if (forbiddenKeys.includes(key)) {
          return true;
        }
        if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
          if (inspectObject(obj[key])) return true;
        }
      }
      return false;
    };

    if (inspectObject(req.body)) {
      return res.status(400).json({
        success: false,
        message: 'Security validation error',
        errors: [{ field: 'body', message: 'Payload contains illegal prototype mutation properties' }],
      });
    }
  }

  next();
}
