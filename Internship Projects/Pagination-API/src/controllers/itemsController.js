import * as itemsService from '../services/itemsService.js';

// GET /api/items - Paginated list endpoint
export async function getItems(req, res, next) {
  try {
    const result = await itemsService.getPaginatedItems(req.validatedOptions);
    res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

// GET /api/items/:id - Single item retrieval
export async function getItemById(req, res, next) {
  try {
    const item = await itemsService.getItemById(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Item with ID ${req.params.id} not found`
      });
    }
    res.status(200).json({
      success: true,
      data: item
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/categories - Category list & distribution
export async function getCategories(_req, res, next) {
  try {
    const categories = await itemsService.getCategorySummary();
    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
}
