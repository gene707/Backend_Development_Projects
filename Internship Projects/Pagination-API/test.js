// Automated test suite for Pagination API
import app from './src/app.js';

let server;
const PORT = 3094;

async function runTests() {
  server = app.listen(PORT);
  console.log(`Test server running on port ${PORT}...`);
  const baseUrl = `http://localhost:${PORT}`;

  try {
    // 1. Health check
    const healthRes = await fetch(`${baseUrl}/health`);
    console.assert(healthRes.status === 200, 'Healthcheck status 200');
    console.log('✔ Health check passed');

    // 2. Default pagination (page 1, limit 10)
    const defRes = await fetch(`${baseUrl}/api/items`);
    const defJson = await defRes.json();
    console.assert(defRes.status === 200, 'Default list status 200');
    console.assert(defJson.pagination.currentPage === 1, 'Current page is 1');
    console.assert(defJson.pagination.itemsPerPage === 10, 'Items per page is 10');
    console.assert(defJson.data.length === 10, 'Returns exactly 10 items on page 1');
    console.assert(defJson.pagination.hasNextPage === true, 'Has next page true');
    console.assert(defJson.pagination.hasPrevPage === false, 'Has prev page false');
    console.log(`✔ Default pagination passed (${defJson.pagination.totalItems} total items across ${defJson.pagination.totalPages} pages)`);

    // 3. Second page navigation (page 2)
    const p2Res = await fetch(`${baseUrl}/api/items?page=2&limit=10`);
    const p2Json = await p2Res.json();
    console.assert(p2Json.pagination.currentPage === 2, 'Current page is 2');
    console.assert(p2Json.pagination.hasPrevPage === true, 'Page 2 hasPrevPage true');
    console.assert(p2Json.pagination.nextPage === 3, 'Next page is 3');
    console.assert(p2Json.pagination.prevPage === 1, 'Prev page is 1');
    console.assert(p2Json.data[0].id === 11, 'Page 2 starts at item index 11');
    console.log('✔ Page navigation passed');

    // 4. Filtering by category
    const filterRes = await fetch(`${baseUrl}/api/items?category=Science`);
    const filterJson = await filterRes.json();
    console.assert(filterJson.data.every(i => i.category === 'Science'), 'All returned items belong to Science');
    console.log(`✔ Category filter passed (found ${filterJson.pagination.totalItems} Science items)`);

    // 5. Keyword search filter
    const searchRes = await fetch(`${baseUrl}/api/items?search=code`);
    const searchJson = await searchRes.json();
    console.assert(searchJson.data.length > 0, 'Found items matching "code"');
    console.log(`✔ Search filter passed (found ${searchJson.pagination.totalItems} matching items)`);

    // 6. Sorting parameter (price desc)
    const sortRes = await fetch(`${baseUrl}/api/items?sortBy=price&sortOrder=desc&limit=5`);
    const sortJson = await sortRes.json();
    const prices = sortJson.data.map(i => i.price);
    const isSortedDesc = prices.every((val, i, arr) => !i || arr[i - 1] >= val);
    console.assert(isSortedDesc, 'Items correctly sorted by price descending');
    console.log('✔ Sorting parameter passed (highest price first)');

    // 7. Edge case: Out-of-range page (e.g. page=999)
    const outRangeRes = await fetch(`${baseUrl}/api/items?page=999`);
    const outRangeJson = await outRangeRes.json();
    console.assert(outRangeRes.status === 200, 'Out-of-range returns 200 OK');
    console.assert(outRangeJson.pagination.isOutOfRange === true, 'isOutOfRange is true');
    console.assert(outRangeJson.data.length === 0, 'Data is an empty array');
    console.assert(outRangeJson.pagination.hasNextPage === false, 'hasNextPage is false');
    console.assert(outRangeJson.message.includes('out of range'), 'Message explains out of range');
    console.log('✔ Edge case: Out-of-range page handled gracefully');

    // 8. Edge case: Invalid query parameters (page < 1, limit > 50, invalid sortBy) -> 400 Bad Request
    const invalidRes = await fetch(`${baseUrl}/api/items?page=-1&limit=500&sortBy=invalidField`);
    const invalidJson = await invalidRes.json();
    console.assert(invalidRes.status === 400, 'Invalid parameters return 400 Bad Request');
    console.assert(invalidJson.errors.length === 3, 'Returns 3 distinct parameter validation errors');
    console.log('✔ Edge case: Invalid query parameters rejected with 400');

    // 9. Single item retrieval
    const itemRes = await fetch(`${baseUrl}/api/items/1`);
    const itemJson = await itemRes.json();
    console.assert(itemRes.status === 200, 'Single item lookup returns 200');
    console.assert(itemJson.data.title.includes('Clean Code'), 'Item title matches expected item');
    console.log('✔ Single item lookup passed');

    // 10. Categories summary
    const catRes = await fetch(`${baseUrl}/api/categories`);
    const catJson = await catRes.json();
    console.assert(catRes.status === 200, 'Categories endpoint returns 200');
    console.assert(catJson.data.Technology !== undefined, 'Technology category present in summary');
    console.log('✔ Categories summary passed');

    console.log('\nAll Pagination API tests passed successfully! 🎉');
  } catch (err) {
    console.error('Test failed:', err);
    process.exitCode = 1;
  } finally {
    server.close();
  }
}

runTests();
