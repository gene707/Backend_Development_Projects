// Middleware to enforce role-based access control
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Authentication required before role check'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: Access denied. Required role(s): [${allowedRoles.join(', ')}], but current role is '${req.user.role}'`
      });
    }

    next();
  };
}
