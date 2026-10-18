import { runMigrations } from '../src/db/migrate.js';
import { closeDatabase } from '../src/db/connection.js';

try {
  await runMigrations();
  await closeDatabase();
  process.exit(0);
} catch (error) {
  console.error('\x1b[31m[Migration Failed]:\x1b[0m', error);
  await closeDatabase();
  process.exit(1);
}
