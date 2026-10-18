import { run, transaction, closeDatabase } from './connection.js';
import { runMigrations } from './migrate.js';

export const initialProjects = [
  {
    code: 'CORE-API',
    name: 'Enterprise API Gateway & Routing Engine',
    description: 'High-throughput microservices gateway with rate limiting and authentication.',
    budget: 45000.0,
    status: 'active',
    start_date: '2026-01-10',
    end_date: '2026-11-30',
    tasks: [
      {
        title: 'Design schema & relational tables',
        description: 'Define SQLite tables with foreign keys and strict constraints',
        status: 'done',
        priority: 'urgent',
        estimated_hours: 12.0,
        due_date: '2026-02-01',
      },
      {
        title: 'Implement input validation middleware',
        description: 'Sanitize incoming mutation payloads and validate types/ranges',
        status: 'done',
        priority: 'high',
        estimated_hours: 16.5,
        due_date: '2026-02-15',
      },
      {
        title: 'Setup automated integration test suite',
        description: 'Comprehensive test coverage across all CRUD operations',
        status: 'in_progress',
        priority: 'medium',
        estimated_hours: 8.0,
        due_date: '2026-11-01',
      },
      {
        title: 'Load testing & rate limit tuning',
        description: 'Benchmark requests per second under peak concurrency load',
        status: 'todo',
        priority: 'low',
        estimated_hours: 20.0,
        due_date: '2026-11-20',
      },
    ],
  },
  {
    code: 'SEC-AUDIT',
    name: 'Zero-Trust Security & Access Hardening',
    description: 'Security audit, SQL injection hardening, and HTTP header protections.',
    budget: 30000.0,
    status: 'active',
    start_date: '2026-03-01',
    end_date: '2026-12-15',
    tasks: [
      {
        title: 'Integrate Helmet security headers',
        description: 'Configure HSTS, CSP, and X-Content-Type-Options',
        status: 'done',
        priority: 'high',
        estimated_hours: 6.0,
        due_date: '2026-03-10',
      },
      {
        title: 'Enforce parameterized SQL prepared statements',
        description: 'Eliminate string concatenation in database queries to prevent SQLi',
        status: 'done',
        priority: 'urgent',
        estimated_hours: 14.0,
        due_date: '2026-03-25',
      },
      {
        title: 'Implement centralized error mask middleware',
        description: 'Prevent internal database stack trace disclosure to clients',
        status: 'in_progress',
        priority: 'high',
        estimated_hours: 10.0,
        due_date: '2026-11-10',
      },
    ],
  },
  {
    code: 'INFRA-OPT',
    name: 'Database Query Optimization & Indexing',
    description: 'Optimize relational queries, composite indexes, and WAL journal modes.',
    budget: 18500.0,
    status: 'planning',
    start_date: '2026-11-01',
    end_date: '2026-12-31',
    tasks: [
      {
        title: 'Profile query execution plans using EXPLAIN QUERY PLAN',
        description: 'Identify unindexed table scans on foreign keys and filters',
        status: 'todo',
        priority: 'medium',
        estimated_hours: 15.0,
        due_date: '2026-11-15',
      },
      {
        title: 'Benchmark SQLite WAL mode under concurrent writes',
        description: 'Verify lock contention reduction during heavy CRUD mutations',
        status: 'todo',
        priority: 'low',
        estimated_hours: 8.5,
        due_date: '2026-11-25',
      },
    ],
  },
];

/**
 * Seeds the relational database with initial mock data.
 * Executes within an ACID transaction to guarantee atomic insertion.
 *
 * @param {boolean} [silent=false]
 * @returns {Promise<void>}
 */
export async function seedDatabase(silent = false) {
  // Ensure tables exist first
  await runMigrations(true);

  if (!silent) {
    console.log('\x1b[36m[Database]\x1b[0m Seeding sample relational records...');
  }

  await transaction(async ({ run: runTx }) => {
    // Clear existing records to ensure clean state
    await runTx('DELETE FROM tasks;');
    await runTx('DELETE FROM projects;');
    await runTx('DELETE FROM sqlite_sequence WHERE name IN ("projects", "tasks");');

    for (const proj of initialProjects) {
      const projResult = await runTx(
        `INSERT INTO projects (code, name, description, budget, status, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [proj.code, proj.name, proj.description, proj.budget, proj.status, proj.start_date, proj.end_date]
      );

      const projectId = projResult.lastID;

      for (const task of proj.tasks) {
        await runTx(
          `INSERT INTO tasks (project_id, title, description, status, priority, estimated_hours, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [projectId, task.title, task.description, task.status, task.priority, task.estimated_hours, task.due_date]
        );
      }
    }
  });

  if (!silent) {
    console.log('\x1b[32m[Database]\x1b[0m Successfully seeded 3 projects and 9 related tasks.');
  }
}
