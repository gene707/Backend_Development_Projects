import { Router } from 'express';
import { ProjectController } from '../controllers/projectController.js';
import {
  validateCreateProject,
  validateUpdateProject,
  validatePatchProject,
  validateIdParam,
  validateQueryPagination,
} from '../middleware/validate.js';

const router = Router();

const ALLOWED_SORT_COLUMNS = ['id', 'code', 'name', 'budget', 'status', 'created_at', 'updated_at'];

router.get('/', validateQueryPagination(ALLOWED_SORT_COLUMNS), ProjectController.getProjects);
router.post('/', validateCreateProject, ProjectController.createProject);

router.get('/:id', validateIdParam('id'), ProjectController.getProjectById);
router.put('/:id', validateIdParam('id'), validateUpdateProject, ProjectController.updateProject);
router.patch('/:id', validateIdParam('id'), validatePatchProject, ProjectController.patchProject);
router.delete('/:id', validateIdParam('id'), ProjectController.deleteProject);

router.get('/:id/tasks', validateIdParam('id'), ProjectController.getProjectTasks);

export default router;
