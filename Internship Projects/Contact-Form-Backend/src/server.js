import 'dotenv/config';
import app from './app.js';

const PORT = process.env.PORT || 3002;

app.listen(PORT, () => {
  console.log(`Contact Form Backend running on port ${PORT}`);
  console.log(`Interactive form: http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
  console.log(`Submissions endpoint: http://localhost:${PORT}/api/contact/submissions`);
});
