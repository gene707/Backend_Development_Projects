import { ProjectModel } from '../models/projectModel.js';

export const ProjectController = {
  /**
   * GET /api/v1/projects
   * Retrieves paginated list of projects with task metrics.
   */
  async getProjects(req, res, next) {
    try {
      const { status, search, limit, offset, sortBy, sortOrder } = req.query;
      const result = await ProjectModel.findAll({
        status,
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
   * GET /api/v1/projects/:id
   * Retrieves single project by ID with its full list of related tasks.
   */
  async getProjectById(req, res, next) {
    try {
      const id = req.params.id;
      const project = await ProjectModel.findById(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
          errors: [{ field: 'id', message: `No project found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        data: project,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * POST /api/v1/projects
   * Creates a new project. Supports transactional bulk creation with initial tasks.
   */
  async createProject(req, res, next) {
    try {
      const { tasks, ...projectData } = req.body;

      // Check if project code already exists
      const existing = await ProjectModel.findByCode(projectData.code);
      if (existing) {
        return res.status(409).json({
          success: false,
          message: 'Conflict: Project code already exists',
          errors: [{ field: 'code', message: `A project with code '${projectData.code}' already exists` }],
        });
      }

      let created;
      if (tasks && Array.isArray(tasks) && tasks.length > 0) {
        // Execute atomic ACID transaction
        created = await ProjectModel.createWithTasks({ projectData, tasks });
      } else {
        created = await ProjectModel.create(projectData);
      }

      res.status(201).json({
        success: true,
        message: 'Project created successfully',
        data: created,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PUT /api/v1/projects/:id
   * Full replacement update of a project.
   */
  async updateProject(req, res, next) {
    try {
      const id = req.params.id;

      // Check for code uniqueness conflict with other projects
      if (req.body.code) {
        const existing = await ProjectModel.findByCode(req.body.code);
        if (existing && existing.id !== id) {
          return res.status(409).json({
            success: false,
            message: 'Conflict: Project code already in use',
            errors: [{ field: 'code', message: `The code '${req.body.code}' is already used by project ID ${existing.id}` }],
          });
        }
      }

      const updated = await ProjectModel.update(id, req.body);
      if (!updated) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
          errors: [{ field: 'id', message: `No project found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        message: 'Project updated successfully',
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * PATCH /api/v1/projects/:id
   * Partial update of specific project fields.
   */
  async patchProject(req, res, next) {
    try {
      const id = req.params.id;

      if (req.body.code) {
        const existing = await ProjectModel.findByCode(req.body.code);
        if (existing && existing.id !== id) {
          return res.status(409).json({
            success: false,
            message: 'Conflict: Project code already in use',
            errors: [{ field: 'code', message: `The code '${req.body.code}' is already used by project ID ${existing.id}` }],
          });
        }
      }

      const patched = await ProjectModel.patch(id, req.body);
      if (!patched) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
          errors: [{ field: 'id', message: `No project found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        message: 'Project partially updated successfully',
        data: patched,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * DELETE /api/v1/projects/:id
   * Deletes a project. Relational foreign key constraint cascades deletion to all child tasks.
   */
  async deleteProject(req, res, next) {
    try {
      const id = req.params.id;
      const deleted = await ProjectModel.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
          errors: [{ field: 'id', message: `No project found with ID ${id}` }],
        });
      }

      res.status(200).json({
        success: true,
        message: 'Project and all associated tasks deleted successfully',
        data: deleted,
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * GET /api/v1/projects/:id/tasks
   * Retrieves all tasks specifically belonging to this project.
   */
  async getProjectTasks(req, res, next) {
    try {
      const id = req.params.id;
      const project = await ProjectModel.findById(id);

      if (!project) {
        return res.status(404).json({
          success: false,
          message: 'Project not found',
          errors: [{ field: 'id', message: `No project found with ID ${id}` }],
        });
      }

      const { status, priority } = req.query;
      const tasks = await ProjectModel.getTasks(id, { status, priority });

      res.status(200).json({
        success: true,
        count: tasks.length,
        project_id: id,
        project_name: project.name,
        data: tasks,
      });
    } catch (error) {
      next(error);
    }
  },
};
