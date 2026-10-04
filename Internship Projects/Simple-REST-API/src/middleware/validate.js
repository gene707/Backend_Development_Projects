// Middleware to validate product inputs for create and update
export function validateProduct(isPartial = false) {
  return (req, res, next) => {
    const { name, price, category, stock, description } = req.body;
    const errors = [];

    if (!isPartial || name !== undefined) {
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        errors.push({ field: 'name', message: 'Name is required and must be a non-empty string' });
      } else if (name.trim().length > 150) {
        errors.push({ field: 'name', message: 'Name must not exceed 150 characters' });
      }
    }

    if (!isPartial || price !== undefined) {
      const numPrice = Number(price);
      if (price === undefined || isNaN(numPrice) || numPrice <= 0) {
        errors.push({ field: 'price', message: 'Price is required and must be a positive number' });
      }
    }

    if (!isPartial || category !== undefined) {
      if (!category || typeof category !== 'string' || category.trim().length === 0) {
        errors.push({ field: 'category', message: 'Category is required and must be a non-empty string' });
      }
    }

    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock) || !Number.isInteger(numStock) || numStock < 0) {
        errors.push({ field: 'stock', message: 'Stock must be a non-negative integer' });
      }
    }

    if (description !== undefined && typeof description !== 'string') {
      errors.push({ field: 'description', message: 'Description must be a string' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors
      });
    }

    next();
  };
}
