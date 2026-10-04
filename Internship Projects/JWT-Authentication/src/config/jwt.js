export const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || 'super-secure-jwt-secret-key-change-in-production-2026',
  expiresIn: process.env.JWT_EXPIRES_IN || '1h'
};
