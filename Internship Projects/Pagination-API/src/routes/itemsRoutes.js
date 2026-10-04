import { Router } from 'express';
import * as itemsController from '../controllers/itemsController.js';
import { validatePaginationQuery } from '../middleware/validatePagination.js';

const router = Router();

// Endpoints
router.get('/', validatePaginationQuery, itemsController.getItems);
router.get('/categories', itemsController.getCategories);
router.get('/:id', itemsController.getItemById);

export default router;
