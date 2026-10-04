const ALLOWED_SORT_FIELDS = ['id', 'title', 'author', 'category', 'price', 'rating', 'year'];
const ALLOWED_SORT_ORDERS = ['asc', 'desc'];

// Middleware to validate and sanitize pagination, filter, and sort parameters
export function validatePaginationQuery(req, res, next) {
  const errors = [];
  const parsed = {};

  // 1. Page validation
  if (req.query.page !== undefined) {
    const pageNum = Number(req.query.page);
    if (!Number.isInteger(pageNum) || pageNum < 1) {
      errors.push({ parameter: 'page', message: 'Parameter "page" must be a positive integer greater than or equal to 1' });
    } else {
      parsed.page = pageNum;
    }
  } else {
    parsed.page = 1;
  }

  // 2. Limit validation
  if (req.query.limit !== undefined) {
    const limitNum = Number(req.query.limit);
    if (!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 50) {
      errors.push({ parameter: 'limit', message: 'Parameter "limit" must be an integer between 1 and 50' });
    } else {
      parsed.limit = limitNum;
    }
  } else {
    parsed.limit = 10;
  }

  // 3. Offset parameter support (alternative to page)
  if (req.query.offset !== undefined) {
    const offsetNum = Number(req.query.offset);
    if (!Number.isInteger(offsetNum) || offsetNum < 0) {
      errors.push({ parameter: 'offset', message: 'Parameter "offset" must be a non-negative integer' });
    } else {
      // Calculate equivalent page from offset and limit
      parsed.page = Math.floor(offsetNum / parsed.limit) + 1;
    }
  }

  // 4. SortBy validation
  if (req.query.sortBy !== undefined) {
    const field = req.query.sortBy.trim();
    if (!ALLOWED_SORT_FIELDS.includes(field)) {
      errors.push({
        parameter: 'sortBy',
        message: `Invalid sortBy field '${field}'. Allowed fields are: ${ALLOWED_SORT_FIELDS.join(', ')}`
      });
    } else {
      parsed.sortBy = field;
    }
  } else {
    parsed.sortBy = 'id';
  }

  // 5. SortOrder validation
  if (req.query.sortOrder !== undefined) {
    const order = req.query.sortOrder.trim().toLowerCase();
    if (!ALLOWED_SORT_ORDERS.includes(order)) {
      errors.push({
        parameter: 'sortOrder',
        message: 'Invalid sortOrder. Allowed values are "asc" or "desc"'
      });
    } else {
      parsed.sortOrder = order;
    }
  } else {
    parsed.sortOrder = 'asc';
  }

  // 6. Price filters validation
  if (req.query.minPrice !== undefined) {
    const minP = Number(req.query.minPrice);
    if (isNaN(minP) || minP < 0) {
      errors.push({ parameter: 'minPrice', message: 'Parameter "minPrice" must be a non-negative number' });
    } else {
      parsed.minPrice = minP;
    }
  }

  if (req.query.maxPrice !== undefined) {
    const maxP = Number(req.query.maxPrice);
    if (isNaN(maxP) || maxP < 0) {
      errors.push({ parameter: 'maxPrice', message: 'Parameter "maxPrice" must be a non-negative number' });
    } else {
      parsed.maxPrice = maxP;
    }
  }

  if (parsed.minPrice !== undefined && parsed.maxPrice !== undefined && parsed.minPrice > parsed.maxPrice) {
    errors.push({ parameter: 'minPrice/maxPrice', message: 'minPrice cannot be greater than maxPrice' });
  }

  // 7. Rating validation
  if (req.query.minRating !== undefined) {
    const r = Number(req.query.minRating);
    if (isNaN(r) || r < 0 || r > 5) {
      errors.push({ parameter: 'minRating', message: 'Parameter "minRating" must be a number between 0 and 5' });
    } else {
      parsed.minRating = r;
    }
  }

  // Attach search and category strings
  if (req.query.category) parsed.category = req.query.category.trim();
  if (req.query.search) parsed.search = req.query.search.trim();
  if (req.query.q) parsed.search = req.query.q.trim();

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid pagination or filter query parameters',
      errors
    });
  }

  req.validatedOptions = parsed;
  next();
}
