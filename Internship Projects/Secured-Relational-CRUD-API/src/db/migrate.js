import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec, getDatabase } from './connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Runs relational database migrations by executing schema.sql.
 * Creates tables, foreign key constraints, indexes, and views.
 *
 * @param {boolean} [silent=false] Suppress console logs if true
 * @returns {Promise<void>}
 */
export async function runMigrations(silent = false) {
  const schemaPath = path.resolve(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf8');

  // Ensure database is initialized
  await getDatabase();

  if (!silent) {
    console.log('\x1b[36m[Database]\x1b[0m Executing relational schema migrations...');
  }

  await exec(schemaSql);

  if (!silent) {
    console.log('\x1b[32m[Database]\x1b[0m Schema tables, constraints, indexes & views created successfully.');
  }
}
