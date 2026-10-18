import { Router } from 'express';
import { TaskController } from '../controllers/taskController.js';
import {
  validateCreateTask,
  validateUpdateTask,
  validatePatchTask,
  validateIdParam,
  validateQueryPagination,
} from '../middleware/validate.js';

const router = Router();

const ALLOWED_SORT_COLUMNS = ['id', 'project_id', 'title', 'status', 'priority', 'estimated_hours', 'due_date', 'created_at', 'updated_at'];

router.get('/', validateQueryPagination(ALLOWED_SORT_COLUMNS), TaskController.getTasks);
router.post('/', validateCreateTask, TaskController.createTask);

router.get('/:id', validateIdParam('id'), TaskController.getTaskById);
router.put('/:id', validateIdParam('id'), validateUpdateTask, TaskController.updateTask);
router.patch('/:id', validateIdParam('id'), validatePatchTask, TaskController.patchTask);
router.delete('/:id', validateIdParam('id'), TaskController.deleteTask);

export default router;
