// Automated test suite for JWT Authentication Service
import app from './src/app.js';
import jwt from 'jsonwebtoken';
import { JWT_CONFIG } from './src/config/jwt.js';

let server;
const PORT = 3093;

async function runTests() {
  server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}...`);
  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    console.assert(healthRes.status === 200, 'Healthcheck status 200');
    console.log('✔ Health check passed');

    // 2. Register a new user
    const uniqueEmail = `testuser-${Date.now()}@example.com`;
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Candidate',
        email: uniqueEmail,
        password: 'Password123!',
        role: 'user'
      })
    });
    const regJson = await regRes.json();
    console.assert(regRes.status === 201, 'Register status 201');
    console.assert(regJson.token !== undefined, 'Register returns JWT token');
    console.assert(regJson.user.email === uniqueEmail, 'User email matches');
    console.log('✔ User registration passed');

    // 3. Duplicate registration check
    const dupRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Candidate',
        email: uniqueEmail,
        password: 'Password123!'
      })
    });
    console.assert(dupRes.status === 409, 'Duplicate register returns 409 Conflict');
    console.log('✔ Duplicate registration prevention passed');

    // 4. Login with registered user
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'Password123!'
      })
    });
    const loginJson = await loginRes.json();
    console.assert(loginRes.status === 200, 'Login status 200');
    console.assert(loginJson.token !== undefined, 'Login returns token');
    const userToken = loginJson.token;
    console.log('✔ User login passed');

    // 5. Login with invalid password
    const badLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'WrongPassword999'
      })
    });
    console.assert(badLoginRes.status === 401, 'Bad login returns 401');
    console.log('✔ Invalid credentials rejection passed');

    // 6. Access protected route with Bearer token
    const profileRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    const profileJson = await profileRes.json();
    console.assert(profileRes.status === 200, 'Protected profile status 200');
    console.assert(profileJson.user.email === uniqueEmail, 'Profile email matches');
    console.log('✔ Protected profile route passed');

    // 7. Access protected route without token
    const unauthRes = await fetch(`${baseUrl}/api/auth/me`);
    console.assert(unauthRes.status === 401, 'Missing token returns 401');
    console.log('✔ Unauthorized request rejection passed');

    // 8. Regular user accessing Admin route -> Expect 403 Forbidden
    const adminForbiddenRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${userToken}` }
    });
    console.assert(adminForbiddenRes.status === 403, 'Regular user accessing admin returns 403 Forbidden');
    console.log('✔ RBAC Forbidden check passed (user blocked from admin)');

    // 9. Admin login & access Admin route -> Expect 200 OK
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@example.com',
        password: 'AdminPassword123!'
      })
    });
    const adminLoginJson = await adminLoginRes.json();
    const adminToken = adminLoginJson.token;

    const adminAccessRes = await fetch(`${baseUrl}/api/admin/dashboard`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminAccessJson = await adminAccessRes.json();
    console.assert(adminAccessRes.status === 200, 'Admin accesses admin route status 200');
    console.assert(adminAccessJson.systemStats !== undefined, 'Admin stats returned');
    console.log('✔ Admin RBAC authorization passed');

    // 10. Handle Expired Token
    const expiredToken = jwt.sign(
      { id: 'usr-admin-1', email: 'admin@example.com', role: 'admin' },
      JWT_CONFIG.secret,
      { expiresIn: '-1s' } // already expired
    );
    const expiredRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${expiredToken}` }
    });
    const expiredJson = await expiredRes.json();
    console.assert(expiredRes.status === 401, 'Expired token returns 401');
    console.assert(expiredJson.error.includes('expired'), 'Error message indicates token expiration');
    console.log('✔ Token expiration handling passed');

    console.log('\nAll JWT Authentication tests passed successfully! 🎉');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
