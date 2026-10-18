import { TaskModel } from '../models/taskModel.js';
import { ProjectModel } from '../models/projectModel.js';

export const TaskController = {
  /**
   * GET /api/v1/tasks
   * Retrieves list of tasks with relational project data, filters, and pagination.
   */
  async getTasks(req, res, next) {
    try {
      const { projectId, status, priority, search, limit, offset, sortBy, sortOrder } = req.query;
      const result = await TaskModel.findAll({
        projectId: projectId ? parseInt(projectId, 10) : undefined,
        status,
        priority,
        search,
        limit,
        offset,
        sortBy,
        sortOrder,
      });

      res.status(200).json({
        success: true,
        count: result.data.length,
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        data: result.data,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/tasks/:id
   * Retrieves a single task by ID with its parent project details.
   */
  async getTaskById(req, res, next) {
    try {
      const id = req.params.id;
      const task = await TaskModel.findById(id);

      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
          errors: [{ field: 'id', message: `No task found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        data: task,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/tasks
   * Creates a new task. Verifies that the foreign key project_id exists.
   */
  async createTask(req, res, next) {
    try {
      const { project_id } = req.body;

      // Verify that referenced parent project exists (Relational Integrity Check)
      const project = await ProjectModel.findById(project_id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Parent project not found',
          errors: [{ field: 'project_id', message: `No project exists with ID ${project_id}` }],
        });
      }

      const created = await TaskModel.create(req.body);

      res.status(201).json({
        success: true,
        message: 'Task created successfully',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/tasks/:id
   * Full replacement update of a task.
   */
  async updateTask(req, res, next) {
    try {
      const id = req.params.id;
      const { project_id } = req.body;

      // Verify parent project exists if changing project_id
      const project = await ProjectModel.findById(project_id);
      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Parent project not found',
          errors: [{ field: 'project_id', message: `No project exists with ID ${project_id}` }],
        });
      }

      const updated = await TaskModel.update(id, req.body);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
          errors: [{ field: 'id', message: `No task found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        message: 'Task updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/tasks/:id
   * Partial update of specific task fields.
   */
  async patchTask(req, res, next) {
    try {
      const id = req.params.id;

      if (req.body.project_id) {
        const project = await ProjectModel.findById(req.body.project_id);
        if (!project) {
          return res.status(404).json({
            success: false,
            message: 'Parent project not found',
            errors: [{ field: 'project_id', message: `No project exists with ID ${req.body.project_id}` }],
          });
        }
      }

      const patched = await TaskModel.patch(id, req.body);
      if (!patched) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
          errors: [{ field: 'id', message: `No task found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        message: 'Task partially updated successfully',
        data: patched,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/tasks/:id
   * Deletes a task by ID.
   */
  async deleteTask(req, res, next) {
    try {
      const id = req.params.id;
      const deleted = await TaskModel.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Task not found',
          errors: [{ field: 'id', message: `No task found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        message: 'Task deleted successfully',
        data: deleted,
      });
    } catch (error) {
      next(error);
    }
  },
};
