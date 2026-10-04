import { Router } from 'express';
import * as controller from '../controllers/productController.js';
import { validateProduct } from '../middleware/validate.js';

const router = Router();

// Routes
router.get('/', controller.getProducts);
router.get('/:id', controller.getProduct);
router.post('/', validateProduct(false), controller.createProduct);
router.put('/:id', validateProduct(false), controller.updateProduct);
router.patch('/:id', validateProduct(true), controller.patchProduct);
router.delete('/:id', controller.deleteProduct);

export default router;
