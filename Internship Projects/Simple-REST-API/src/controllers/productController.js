import * as productStore from '../models/productStore.js';

// GET /api/products - List all products with optional filters
export async function getProducts(req, res, next) {
  try {
    let products = await productStore.getAllProducts();
    const { category, q } = req.query;

    if (category) {
      products = products.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }

    if (q) {
      const search = q.toLowerCase();
      products = products.filter(
        p => p.name.toLowerCase().includes(search) || (p.description && p.description.toLowerCase().includes(search))
      );
    }

    res.status(200).json({
      success: true,
      count: products.length,
      data: products
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/products/:id - Single product
export async function getProduct(req, res, next) {
  try {
    const { id } = req.params;
    const product = await productStore.getProductById(id);

    if (!product) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/products - Create a new product
export async function createProduct(req, res, next) {
  try {
    const created = await productStore.createProduct(req.body);
    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: created
    });
  } catch (error) {
    next(error);
  }
}

// PUT /api/products/:id - Full update
export async function updateProduct(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await productStore.updateProduct(id, req.body, false);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

// PATCH /api/products/:id - Partial update
export async function patchProduct(req, res, next) {
  try {
    const { id } = req.params;
    const updated = await productStore.updateProduct(id, req.body, true);

    if (!updated) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product partially updated successfully',
      data: updated
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/products/:id - Delete product
export async function deleteProduct(req, res, next) {
  try {
    const { id } = req.params;
    const deleted = await productStore.deleteProduct(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: `Product with ID '${id}' not found`
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deleted
    });
  } catch (error) {
    next(error);
  }
}
