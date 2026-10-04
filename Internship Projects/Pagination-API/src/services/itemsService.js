import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.join(__dirname, '../../data/items.json');

let cachedItems = null;

// Load items from disk
export async function loadItems() {
  if (cachedItems) return cachedItems;
  try {
    const data = await fs.readFile(DATA_FILE, 'utf-8');
    cachedItems = JSON.parse(data);
    return cachedItems;
  } catch (err) {
    console.error('Error reading items.json:', err);
    return [];
  }
}

// Get paginated, filtered, sorted results with metadata
export async function getPaginatedItems(options) {
  const items = await loadItems();

  const {
    page = 1,
    limit = 10,
    category,
    search,
    minPrice,
    maxPrice,
    minRating,
    sortBy = 'id',
    sortOrder = 'asc'
  } = options;

  // 1. Filtering
  let filtered = [...items];

  if (category) {
    filtered = filtered.filter(item => item.category.toLowerCase() === category.toLowerCase().trim());
  }

  if (search) {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      item =>
        item.title.toLowerCase().includes(q) ||
        item.author.toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)
    );
  }

  if (minPrice !== undefined && !isNaN(minPrice)) {
    filtered = filtered.filter(item => item.price >= minPrice);
  }

  if (maxPrice !== undefined && !isNaN(maxPrice)) {
    filtered = filtered.filter(item => item.price <= maxPrice);
  }

  if (minRating !== undefined && !isNaN(minRating)) {
    filtered = filtered.filter(item => item.rating >= minRating);
  }

  // 2. Sorting
  const isAsc = sortOrder.toLowerCase() === 'asc';
  filtered.sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (typeof valA === 'string') {
      valA = valA.toLowerCase();
      valB = valB.toLowerCase();
      return isAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }

    return isAsc ? valA - valB : valB - valA;
  });

  // 3. Pagination Calculations
  const totalItems = filtered.length;
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  // Edge Case: Out-of-range page handling
  const isOutOfRange = page > totalPages && totalPages > 0;
  const paginatedData = isOutOfRange ? [] : filtered.slice(startIndex, endIndex);

  const hasNextPage = page < totalPages;
  const hasPrevPage = page > 1 && (page <= totalPages + 1);

  return {
    success: true,
    pagination: {
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: limit,
      itemCountOnPage: paginatedData.length,
      hasNextPage: hasNextPage,
      hasPrevPage: hasPrevPage,
      nextPage: hasNextPage ? page + 1 : null,
      prevPage: hasPrevPage ? page - 1 : null,
      isOutOfRange: isOutOfRange
    },
    filtersApplied: {
      category: category || null,
      search: search || null,
      minPrice: minPrice !== undefined ? minPrice : null,
      maxPrice: maxPrice !== undefined ? maxPrice : null,
      minRating: minRating !== undefined ? minRating : null,
      sortBy,
      sortOrder
    },
    message: isOutOfRange
      ? `Requested page (${page}) is out of range. Total available pages for this query is ${totalPages}.`
      : undefined,
    data: paginatedData
  };
}

// Get single item by ID
export async function getItemById(id) {
  const items = await loadItems();
  return items.find(i => i.id === Number(id)) || null;
}

// Get distinct categories with counts
export async function getCategorySummary() {
  const items = await loadItems();
  const summary = {};
  items.forEach(i => {
    summary[i.category] = (summary[i.category] || 0) + 1;
  });
  return summary;
}
