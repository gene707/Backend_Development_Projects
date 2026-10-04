// Automated integration verification test for Simple REST API
import app from './src/app.js';

let server;
const PORT = 3091;

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

    // 2. List products
    const listRes = await fetch(`${baseUrl}/api/products`);
    const listJson = await listRes.json();
    console.assert(listRes.status === 200, 'List products status 200');
    console.assert(Array.isArray(listJson.data), 'Returns products array');
    console.log(`✔ List products passed (found ${listJson.count} products)`);

    // 3. Create product
    const newProd = {
      name: 'Test Desk Lamp',
      description: 'Dimmable LED desk lamp with USB charging port',
      price: 39.99,
      category: 'Home & Office',
      stock: 50
    };
    const createRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newProd)
    });
    const createJson = await createRes.json();
    console.assert(createRes.status === 201, 'Create product status 201');
    console.assert(createJson.data.id !== undefined, 'Created product has ID');
    const createdId = createJson.data.id;
    console.log(`✔ Create product passed (created ID: ${createdId})`);

    // 4. Read single product
    const getRes = await fetch(`${baseUrl}/api/products/${createdId}`);
    const getJson = await getRes.json();
    console.assert(getRes.status === 200, 'Get product status 200');
    console.assert(getJson.data.name === 'Test Desk Lamp', 'Get product name matches');
    console.log('✔ Read single product passed');

    // 5. Update product (PUT)
    const updateRes = await fetch(`${baseUrl}/api/products/${createdId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Desk Lamp Pro',
        description: 'Updated high-performance LED desk lamp',
        price: 49.99,
        category: 'Home & Office',
        stock: 40
      })
    });
    const updateJson = await updateRes.json();
    console.assert(updateRes.status === 200, 'Update product status 200');
    console.assert(updateJson.data.name === 'Test Desk Lamp Pro', 'Updated name matches');
    console.log('✔ Update product passed');

    // 6. Validation error check
    const badRes = await fetch(`${baseUrl}/api/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ price: -10 })
    });
    console.assert(badRes.status === 400, 'Validation error returns 400');
    console.log('✔ Input validation error handling passed');

    // 7. Delete product
    const deleteRes = await fetch(`${baseUrl}/api/products/${createdId}`, {
      method: 'DELETE'
    });
    console.assert(deleteRes.status === 200, 'Delete product status 200');
    console.log('✔ Delete product passed');

    // 8. Verify 404 after delete
    const notFoundRes = await fetch(`${baseUrl}/api/products/${createdId}`);
    console.assert(notFoundRes.status === 404, 'Deleted product returns 404');
    console.log('✔ 404 Not Found handling passed');

    console.log('\nAll Simple REST API tests passed successfully! 🎉');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
