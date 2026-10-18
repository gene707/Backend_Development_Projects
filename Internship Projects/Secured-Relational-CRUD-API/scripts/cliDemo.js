import app from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

const DEMO_PORT = 3998;
const baseUrl = `http://localhost:${DEMO_PORT}`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printSection(title) {
  console.log('\n\x1b[36m' + '='.repeat(68) + '\x1b[0m');
  console.log(`\x1b[1m\x1b[33m▶ ${title}\x1b[0m`);
  console.log('\x1b[36m' + '-'.repeat(68) + '\x1b[0m');
}

async function request(method, path, body = null, headers = {}) {
  console.log(`\x1b[34m[Request]\x1b[0m  \x1b[1m${method}\x1b[0m ${path}`);
  if (body) {
    console.log(`\x1b[90mPayload:  ${JSON.stringify(body, null, 2)}\x1b[0m`);
  }

  const reqOptions = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  };

  if (body) {
    reqOptions.body = JSON.stringify(body);
  }

  const res = await fetch(`${baseUrl}${path}`, reqOptions);
  const data = await res.json().catch(() => null);

  let statusColor = '\x1b[32m';
  if (res.status >= 400 && res.status < 500) statusColor = '\x1b[33m';
  if (res.status >= 500) statusColor = '\x1b[31m';

  console.log(`\x1b[34m[Response]\x1b[0m Status: ${statusColor}${res.status} ${res.statusText}\x1b[0m`);
  console.log(JSON.stringify(data, null, 2));
  await sleep(150);
  return { status: res.status, data };
}

async function runDemo() {
  console.log('\n\x1b[32m====================================================================\x1b[0m');
  console.log('\x1b[1m  SECURED RELATIONAL CRUD API SERVER - LIVE TERMINAL DEMO\x1b[0m');
  console.log('\x1b[32m====================================================================\x1b[0m');

  await getDatabase();
  await runMigrations(true);
  await seedDatabase(true);

  const server = await new Promise((resolve) => {
    const s = app.listen(DEMO_PORT, () => resolve(s));
  });

  try {
    // 1. Health Check
    printSection('1. HEALTH CHECK & DATABASE CONNECTIVITY');
    await request('GET', '/health');

    // 2. Relational Aggregation Stats
    printSection('2. RELATIONAL AGGREGATES & METRICS (SQL VIEW)');
    await request('GET', '/api/v1/stats');

    // 3. List All Projects with Task Aggregates
    printSection('3. LIST ALL PROJECTS (WITH COMPUTED METRICS)');
    await request('GET', '/api/v1/projects?limit=2');

    // 4. Create Project with Atomic ACID Transaction
    printSection('4. TRANSACTIONAL MUTATION: CREATE PROJECT WITH NESTED TASKS');
    const createRes = await request('POST', '/api/v1/projects', {
      code: 'CLOUD-MIG',
      name: 'Cloud Infrastructure Migration',
      description: 'Migrating legacy on-prem services to containerized cloud nodes',
      budget: 85000.0,
      status: 'active',
      start_date: '2026-11-01',
      tasks: [
        {
          title: 'Containerize microservices using Docker',
          priority: 'urgent',
          estimated_hours: 24.0,
          due_date: '2026-11-15',
        },
        {
          title: 'Provision secure Kubernetes cluster',
          priority: 'high',
          estimated_hours: 40.0,
          due_date: '2026-12-01',
        },
      ],
    });

    const newProjectId = createRes.data?.data?.id;

    // 5. Query Project with its Relational Child Tasks
    printSection('5. RETRIEVE CREATED PROJECT & LINKED RELATIONAL TASKS');
    await request('GET', `/api/v1/projects/${newProjectId}`);

    // 6. Validation Middleware Demonstration
    printSection('6. VALIDATION MIDDLEWARE: REJECTING INVALID MUTATION');
    await request('POST', '/api/v1/projects', {
      code: 'X', // invalid: too short (< 2 chars)
      name: 'No', // invalid: too short (< 3 chars)
      budget: -100, // invalid: negative
      status: 'invalid_status_enum', // invalid enum
    });

    // 7. Security: Unique Constraint Violation Handling (409 Conflict)
    printSection('7. SECURITY & INTEGRITY: DUPLICATE CODE CONFLICT (409)');
    await request('POST', '/api/v1/projects', {
      code: 'CLOUD-MIG',
      name: 'Duplicate Cloud Migration Project',
    });

    // 8. Relational Foreign Key Integrity Check
    printSection('8. RELATIONAL INTEGRITY: REJECTING ORPHANED TASK (404)');
    await request('POST', '/api/v1/tasks', {
      project_id: 99999, // Does not exist
      title: 'Orphaned Task without parent',
    });

    // 9. Cascade Deletion Demonstration
    printSection('9. RELATIONAL CASCADE: DELETING PROJECT AUTO-REMOVES TASKS');
    await request('DELETE', `/api/v1/projects/${newProjectId}`);

    console.log('\n\x1b[32m✔ Live terminal demonstration finished successfully!\x1b[0m\n');
  } finally {
    server.close();
    await closeDatabase();
  }
}

runDemo().catch((err) => {
  console.error('\x1b[31m[Demo Error]:\x1b[0m', err);
  process.exit(1);
});
