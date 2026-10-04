import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3004;

app.listen(PORT, () => {
  console.log(`Pagination API running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Paginated items: http://localhost:${PORT}/api/items?page=1&limit=10`);
});
