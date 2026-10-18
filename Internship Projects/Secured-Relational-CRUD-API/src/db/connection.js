import sqlite3 from 'sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config/index.js';

let dbInstance = null;

/**
 * Initializes and returns the active SQLite database connection.
 * Automatically ensures the database directory exists and configures
 * foreign key enforcement and WAL journal mode.
 *
 * @param {string} [customPath] Optional custom path (useful for testing e.g. ':memory:')
 * @returns {Promise<sqlite3.Database>}
 */
export async function getDatabase(customPath = null) {
  if (dbInstance) {
    return dbInstance;
  }

  const dbPath = customPath || config.dbPath;

  // Ensure parent directory exists for file-based databases
  if (dbPath !== ':memory:') {
    const dir = path.dirname(path.resolve(dbPath));
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error(`[DB Error] Failed to connect to database at ${dbPath}:`, err.message);
        return reject(err);
      }

      // Enforce relational foreign keys and enable write-ahead logging
      db.serialize(() => {
        db.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
          if (pragmaErr) {
            console.error('[DB Warning] Failed to enable foreign keys:', pragmaErr.message);
          }
        });

        if (dbPath !== ':memory:') {
          db.run('PRAGMA journal_mode = WAL;');
        }

        dbInstance = db;
        resolve(dbInstance);
      });
    });
  });
}

/**
 * Executes a SELECT query and returns all matching rows.
 * Uses parameterized queries to prevent SQL Injection.
 *
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<Array>}
 */
export async function query(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        return reject(err);
      }
      resolve(rows || []);
    });
  });
}

/**
 * Executes a SELECT query and returns a single matching row (or null).
 *
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<Object|null>}
 */
export async function get(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      resolve(row || null);
    });
  });
}

/**
 * Executes an INSERT, UPDATE, or DELETE query and returns execution metadata.
 *
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<{ lastID: number, changes: number }>}
 */
export async function run(sql, params = []) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        return reject(err);
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

/**
 * Executes multi-statement raw SQL (e.g. schema creation / migrations).
 *
 * @param {string} sql
 * @returns {Promise<void>}
 */
export async function exec(sql) {
  const db = await getDatabase();
  return new Promise((resolve, reject) => {
    db.exec(sql, (err) => {
      if (err) {
        return reject(err);
      }
      resolve();
    });
  });
}

/**
 * Executes multiple operations within an atomic ACID SQL Transaction.
 * Automatically rolls back on error and commits on success.
 *
 * @param {Function} callback Callback receiving the db helper methods
 * @returns {Promise<any>}
 */
export async function transaction(callback) {
  await run('BEGIN TRANSACTION;');
  try {
    const result = await callback({ query, get, run, exec });
    await run('COMMIT;');
    return result;
  } catch (error) {
    await run('ROLLBACK;');
    throw error;
  }
}

/**
 * Closes the active database connection.
 *
 * @returns {Promise<void>}
 */
export async function closeDatabase() {
  if (!dbInstance) return;
  return new Promise((resolve, reject) => {
    dbInstance.close((err) => {
      if (err) return reject(err);
      dbInstance = null;
      resolve();
    });
  });
}
