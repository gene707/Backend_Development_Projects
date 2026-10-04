import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3003;

app.listen(PORT, () => {
  console.log(`JWT Authentication Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Auth endpoint: http://localhost:${PORT}/api/auth/login`);
});
