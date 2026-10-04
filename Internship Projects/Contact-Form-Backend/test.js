// Automated test suite for Contact Form Backend
import app from './src/app.js';

let server;
const PORT = 3092;

async function runTests() {
  server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}...`);
  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    const healthJson = await healthRes.json();
    console.assert(healthRes.status === 200, 'Healthcheck status 200');
    console.assert(healthJson.status === 'UP', 'Healthcheck status UP');
    console.log('✔ Health check passed');

    // 2. Successful contact submission
    const validPayload = {
      name: 'Alice Johnson',
      email: 'alice.johnson@example.com',
      phone: '+1 555-0199',
      subject: 'Partnership Inquiry',
      message: 'Hello team, I would like to explore partnership opportunities with your platform.'
    };

    const submitRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(validPayload)
    });
    const submitJson = await submitRes.json();

    console.assert(submitRes.status === 201, 'Submit returns 201 Created');
    console.assert(submitJson.success === true, 'Success flag is true');
    console.assert(submitJson.submissionId !== undefined, 'Submission ID generated');
    console.assert(submitJson.proof.persisted === true, 'Proof shows persisted=true');
    const createdId = submitJson.submissionId;
    console.log(`✔ Contact submission passed (submissionId: ${createdId})`);

    // 3. Server-side validation: missing email and short message
    const invalidPayload = {
      name: 'A',
      email: 'invalid-email-address',
      message: 'Short'
    };

    const badRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(invalidPayload)
    });
    const badJson = await badRes.json();

    console.assert(badRes.status === 400, 'Validation failure returns 400');
    console.assert(badJson.success === false, 'Validation failure success=false');
    console.assert(badJson.errors.length >= 3, 'Returns validation errors for name, email, message');
    console.log('✔ Server-side validation error handling passed');

    // 4. Verification proof endpoint (get all submissions)
    const listRes = await fetch(`${baseUrl}/api/contact/submissions`);
    const listJson = await listRes.json();
    console.assert(listRes.status === 200, 'Submissions list returns 200');
    console.assert(listJson.count >= 1, 'Contains at least 1 stored submission');
    console.log(`✔ Storage proof verification endpoint passed (found ${listJson.count} submissions)`);

    // 5. Verification proof endpoint (get single submission)
    const singleRes = await fetch(`${baseUrl}/api/contact/submissions/${createdId}`);
    const singleJson = await singleRes.json();
    console.assert(singleRes.status === 200, 'Single submission lookup returns 200');
    console.assert(singleJson.submission.email === 'alice.johnson@example.com', 'Matches submitted email');
    console.log('✔ Single submission lookup passed');

    console.log('\nAll Contact Form Backend tests passed successfully! 🎉');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
