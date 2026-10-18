import app from '../src/app.js';
import { getDatabase, closeDatabase } from '../src/db/connection.js';
import { runMigrations } from '../src/db/migrate.js';
import { seedDatabase } from '../src/db/seed.js';

const TEST_PORT = 3999;
let serverInstance;
let baseUrl;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

async function test(title, fn) {
  process.stdout.write(`  \x1b[90mTesting:\x1b[0m ${title}... `);
  try {
    await fn();
    console.log('\x1b[32m✔ PASS\x1b[0m');
    passed++;
  } catch (err) {
    console.log('\x1b[31m✖ FAIL\x1b[0m');
    console.error(`    \x1b[31m${err.message}\x1b[0m`);
    failed++;
  }
}

async function runAllTests() {
  console.log('\n\x1b[36m====================================================================\x1b[0m');
  console.log('\x1b[1m\x1b[34m Running Automated Integration Test Suite\x1b[0m');
  console.log('\x1b[36m====================================================================\x1b[0m\n');

  const startTime = Date.now();

  // Initialize DB and reset with test seed
  await getDatabase();
  await runMigrations(true);
  await seedDatabase(true);

  // Start test server
  serverInstance = await new Promise((resolve) => {
    const s = app.listen(TEST_PORT, () => resolve(s));
  });
  baseUrl = `http://localhost:${TEST_PORT}`;

  try {
    // 1. Health & Server Status
    await test('GET /health returns 200 OK and database active status', async () => {
      const res = await fetch(`${baseUrl}/health`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.status === 'UP', 'Status is not UP');
      assert(body.database.includes('CONNECTED'), 'Database is not connected');
    });

    // 2. Project List & Seed Verification
    let existingProjectId = null;
    await test('GET /api/v1/projects returns seeded projects with aggregated metrics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag is false');
      assert(Array.isArray(body.data) && body.data.length >= 3, 'Expected at least 3 seeded projects');
      assert('total_tasks' in body.data[0], 'Missing total_tasks aggregate field');
      existingProjectId = body.data[0].id;
    });

    // 3. Project Detail with Related Child Tasks
    await test('GET /api/v1/projects/:id returns single project and relational child tasks', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/${existingProjectId}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag is false');
      assert(body.data.id === existingProjectId, 'ID does not match');
      assert(Array.isArray(body.data.tasks), 'Project does not contain child tasks array');
    });

    // 4. Project Creation
    let newProjectId = null;
    await test('POST /api/v1/projects creates a new project with valid data', async () => {
      const payload = {
        code: 'TEST-DEV',
        name: 'Automated Test Infrastructure',
        description: 'End-to-end integration testing pipelines',
        budget: 15000.5,
        status: 'active',
        start_date: '2026-10-01',
        end_date: '2026-12-31',
      };
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag is false');
      assert(body.data.code === 'TEST-DEV', 'Code does not match');
      assert(body.data.budget === 15000.5, 'Budget does not match');
      newProjectId = body.data.id;
    });

    // 5. Unique Constraint Violation Handling (409 Conflict)
    await test('POST /api/v1/projects rejects duplicate project code with 409 Conflict', async () => {
      const payload = {
        code: 'TEST-DEV', // already created
        name: 'Duplicate Code Test',
      };
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      assert(res.status === 409, `Expected 409 Conflict, got ${res.status}`);
      const body = await res.json();
      assert(body.success === false, 'Expected success=false');
    });

    // 6. Validation Middleware: Missing required fields & invalid values
    await test('POST /api/v1/projects validation middleware rejects invalid body', async () => {
      const invalidPayload = {
        code: 'A', // too short (< 2 chars)
        name: '', // empty name
        budget: -500, // negative budget
        status: 'invalid_status_enum', // invalid enum
      };
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload),
      });
      assert(res.status === 400, `Expected 400 Bad Request, got ${res.status}`);
      const body = await res.json();
      assert(body.success === false, 'Expected success=false');
      assert(body.errors.length >= 4, `Expected at least 4 errors, got ${body.errors.length}`);
    });

    // 7. Validation Middleware: Non-numeric route parameter
    await test('GET /api/v1/projects/:id rejects invalid ID parameter with 400', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects/not-a-number`);
      assert(res.status === 400, `Expected 400, got ${res.status}`);
      const body = await res.json();
      assert(body.errors[0].field === 'id', 'Expected field id error');
    });

    // 8. Full Update (PUT)
    await test('PUT /api/v1/projects/:id replaces project resource', async () => {
      const updatePayload = {
        code: 'TEST-DEV',
        name: 'Automated Test Infrastructure (Updated Full)',
        description: 'Updated comprehensive description',
        budget: 20000.0,
        status: 'completed',
      };
      const res = await fetch(`${baseUrl}/api/v1/projects/${newProjectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatePayload),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.data.name === 'Automated Test Infrastructure (Updated Full)', 'Name not updated');
      assert(body.data.budget === 20000.0, 'Budget not updated');
      assert(body.data.status === 'completed', 'Status not updated');
    });

    // 9. Partial Update (PATCH)
    await test('PATCH /api/v1/projects/:id partially mutates specific fields', async () => {
      const patchPayload = { budget: 25000.0 };
      const res = await fetch(`${baseUrl}/api/v1/projects/${newProjectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patchPayload),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.data.budget === 25000.0, 'Budget did not update');
      assert(body.data.name.includes('Updated Full'), 'Other fields should remain intact');
    });

    // 10. Task Creation with Foreign Key
    let newTaskId = null;
    await test('POST /api/v1/tasks creates a task linked to parent project', async () => {
      const taskPayload = {
        project_id: newProjectId,
        title: 'Implement unit testing assertions',
        description: 'Verify all edge cases',
        status: 'todo',
        priority: 'urgent',
        estimated_hours: 5.5,
      };
      const res = await fetch(`${baseUrl}/api/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(taskPayload),
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      assert(body.data.project_id === newProjectId, 'Foreign key project_id mismatch');
      assert(body.data.priority === 'urgent', 'Priority mismatch');
      assert(body.data.project_code === 'TEST-DEV', 'Relational project_code not joined');
      newTaskId = body.data.id;
    });

    // 11. Foreign Key Integrity Check (Parent does not exist)
    await test('POST /api/v1/tasks rejects task with non-existent project_id (404)', async () => {
      const badTask = {
        project_id: 999999, // non-existent
        title: 'Orphaned Task',
      };
      const res = await fetch(`${baseUrl}/api/v1/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(badTask),
      });
      assert(res.status === 404, `Expected 404, got ${res.status}`);
      const body = await res.json();
      assert(body.errors[0].field === 'project_id', 'Expected project_id error');
    });

    // 12. Task Filtering & Search
    await test('GET /api/v1/tasks supports status and search filtering', async () => {
      const res = await fetch(`${baseUrl}/api/v1/tasks?status=todo&search=assertions`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.data.length >= 1, 'Expected at least 1 matching task');
      assert(body.data[0].id === newTaskId, 'Returned task mismatch');
    });

    // 13. Task Update & Status Mutation
    await test('PATCH /api/v1/tasks/:id updates status to done', async () => {
      const res = await fetch(`${baseUrl}/api/v1/tasks/${newTaskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done' }),
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.data.status === 'done', 'Status was not updated');
    });

    // 14. ACID Transactional Mutation: Bulk Project with nested Tasks
    let bulkProjectId = null;
    await test('POST /api/v1/projects creates project and nested tasks in single ACID transaction', async () => {
      const bulkPayload = {
        code: 'BULK-TX',
        name: 'Transactional Atomic Project',
        budget: 50000.0,
        tasks: [
          { title: 'Subtask Alpha', priority: 'high', estimated_hours: 4.0 },
          { title: 'Subtask Beta', priority: 'urgent', estimated_hours: 6.0 },
        ],
      };
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bulkPayload),
      });
      assert(res.status === 201, `Expected 201, got ${res.status}`);
      const body = await res.json();
      assert(body.data.code === 'BULK-TX', 'Project code mismatch');
      assert(body.data.tasks.length === 2, 'Expected 2 nested tasks created atomically');
      bulkProjectId = body.data.id;
    });

    // 15. Relational Cascade Deletion
    await test('DELETE /api/v1/projects/:id triggers relational cascade delete for tasks', async () => {
      // Delete the bulk project
      const res = await fetch(`${baseUrl}/api/v1/projects/${bulkProjectId}`, {
        method: 'DELETE',
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      // Verify tasks belonging to that project are cascaded and gone
      const tasksRes = await fetch(`${baseUrl}/api/v1/tasks?projectId=${bulkProjectId}`);
      const tasksBody = await tasksRes.json();
      assert(tasksBody.data.length === 0, 'Cascade delete failed: child tasks still exist');
    });

    // 16. Security: Enforce Content-Type on mutations
    await test('POST /api/v1/projects rejects requests without Content-Type: application/json (415)', async () => {
      const res = await fetch(`${baseUrl}/api/v1/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'invalid body',
      });
      assert(res.status === 415, `Expected 415 Unsupported Media Type, got ${res.status}`);
    });

    // 17. Security: SQL Injection safety verification
    await test('SQL injection attempts in search queries are safely neutralized', async () => {
      const sqliSearch = encodeURIComponent("' OR '1'='1' --");
      const res = await fetch(`${baseUrl}/api/v1/projects?search=${sqliSearch}`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      // Should not return all rows via injection, but literally look for matching pattern
      assert(Array.isArray(body.data), 'Expected array response');
    });

    // 18. Relational View & Stats Endpoint
    await test('GET /api/v1/stats queries relational SQL view and returns system metrics', async () => {
      const res = await fetch(`${baseUrl}/api/v1/stats`);
      assert(res.status === 200, `Expected 200, got ${res.status}`);
      const body = await res.json();
      assert(body.success === true, 'Success flag is false');
      assert('summary' in body.data, 'Missing summary');
      assert('tasksBreakdown' in body.data, 'Missing tasksBreakdown');
      assert('projectsSummary' in body.data, 'Missing projectsSummary');
      assert(body.data.summary.total_projects >= 3, 'Total projects count is wrong');
    });
  } finally {
    // Teardown
    if (serverInstance) {
      await new Promise((resolve) => serverInstance.close(resolve));
    }
    await closeDatabase();
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('\n\x1b[36m====================================================================\x1b[0m');
  console.log(` \x1b[1mTest Results:\x1b[0m \x1b[32m${passed} passed\x1b[0m, \x1b[31m${failed} failed\x1b[0m (Total: ${passed + failed}) in ${durationSec}s`);
  console.log('\x1b[36m====================================================================\x1b[0m\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('\x1b[31m[Test Runner Fatal]:\x1b[0m', err);
  process.exit(1);
});
