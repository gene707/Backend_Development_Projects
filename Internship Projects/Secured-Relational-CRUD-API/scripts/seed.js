import { seedDatabase } from '../src/db/seed.js';
import { closeDatabase } from '../src/db/connection.js';

try {
  await seedDatabase();
  await closeDatabase();
  process.exit(0);
} catch (error) {
  console.error('\x1b[31m[Seed Failed]:\x1b[0m', error);
  await closeDatabase();
  process.exit(1);
}
