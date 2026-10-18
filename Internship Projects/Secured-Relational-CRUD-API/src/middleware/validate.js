const VALID_PROJECT_STATUSES = ['planning', 'active', 'completed', 'archived'];
const VALID_TASK_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked'];
const VALID_TASK_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PROJECT_CODE_REGEX = /^[A-Za-z0-9_-]{2,20}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}(?:[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?)?$/;

/**
 * Helper to validate positive integer route parameters (e.g. :id).
 */
export function validateIdParam(paramName = 'id') {
  return (req, res, next) => {
    const rawVal = req.params[paramName];
    const parsed = parseInt(rawVal, 10);
    if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== rawVal.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid parameter',
        errors: [{ field: paramName, message: `The '${paramName}' parameter must be a positive integer` }],
      });
    }
    req.params[paramName] = parsed;
    next();
  };
}

/**
 * Validates pagination and sorting query parameters.
 */
export function validateQueryPagination(allowedSortBy = ['id', 'created_at']) {
  return (req, res, next) => {
    const errors = [];
    const { limit, offset, sortBy, sortOrder } = req.query;

    if (limit !== undefined) {
      const parsedLimit = parseInt(limit, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
        errors.push({ field: 'limit', message: 'Query parameter "limit" must be an integer between 1 and 100' });
      } else {
        req.query.limit = parsedLimit;
      }
    }

    if (offset !== undefined) {
      const parsedOffset = parseInt(offset, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        errors.push({ field: 'offset', message: 'Query parameter "offset" must be a non-negative integer' });
      } else {
        req.query.offset = parsedOffset;
      }
    }

    if (sortBy !== undefined && !allowedSortBy.includes(sortBy.toLowerCase())) {
      errors.push({ field: 'sortBy', message: `Query parameter "sortBy" must be one of: ${allowedSortBy.join(', ')}` });
    }

    if (sortOrder !== undefined && !['ASC', 'DESC'].includes(sortOrder.toUpperCase())) {
      errors.push({ field: 'sortOrder', message: 'Query parameter "sortOrder" must be either ASC or DESC' });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors,
      });
    }

    next();
  };
}

/**
 * Middleware: Validates payload for creating a Project (POST /api/v1/projects).
 */
export function validateCreateProject(req, res, next) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a valid JSON object',
      errors: [{ field: 'body', message: 'Payload is empty or not an object' }],
    });
  }

  // code (required, string, 2-20 alphanumeric/hyphens)
  if (!body.code || typeof body.code !== 'string' || !PROJECT_CODE_REGEX.test(body.code.trim())) {
    errors.push({
      field: 'code',
      message: 'Code is required, must be 2-20 characters long, and contain only letters, numbers, hyphens, and underscores (e.g. PROJ-01)',
    });
  }

  // name (required, string, 3-150 chars)
  if (!body.name || typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 150) {
    errors.push({
      field: 'name',
      message: 'Name is required and must be between 3 and 150 characters',
    });
  }

  // description (optional, string, max 1000 chars)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description must be a string up to 1000 characters' });
    }
  }

  // budget (optional, non-negative number)
  if (body.budget !== undefined && body.budget !== null) {
    const num = Number(body.budget);
    if (typeof body.budget !== 'number' || isNaN(num) || num < 0) {
      errors.push({ field: 'budget', message: 'Budget must be a non-negative number' });
    }
  }

  // status (optional, enum)
  if (body.status !== undefined && body.status !== null) {
    if (!VALID_PROJECT_STATUSES.includes(body.status)) {
      errors.push({
        field: 'status',
        message: `Status must be one of: ${VALID_PROJECT_STATUSES.join(', ')}`,
      });
    }
  }

  // start_date & end_date (optional, date format)
  if (body.start_date !== undefined && body.start_date !== null && !DATE_REGEX.test(body.start_date)) {
    errors.push({ field: 'start_date', message: 'Start date must be in YYYY-MM-DD or ISO 8601 format' });
  }

  if (body.end_date !== undefined && body.end_date !== null && !DATE_REGEX.test(body.end_date)) {
    errors.push({ field: 'end_date', message: 'End date must be in YYYY-MM-DD or ISO 8601 format' });
  }

  // tasks array (optional for transactional creation)
  if (body.tasks !== undefined && body.tasks !== null) {
    if (!Array.isArray(body.tasks)) {
      errors.push({ field: 'tasks', message: 'Tasks must be an array of task objects' });
    } else {
      body.tasks.forEach((task, idx) => {
        if (!task.title || typeof task.title !== 'string' || task.title.trim().length < 3) {
          errors.push({ field: `tasks[${idx}].title`, message: 'Each nested task must have a title of at least 3 characters' });
        }
        if (task.status && !VALID_TASK_STATUSES.includes(task.status)) {
          errors.push({ field: `tasks[${idx}].status`, message: `Task status must be one of: ${VALID_TASK_STATUSES.join(', ')}` });
        }
      });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  // Normalize sanitized body
  req.body = {
    code: body.code.trim().toUpperCase(),
    name: body.name.trim(),
    description: body.description ? body.description.trim() : null,
    budget: body.budget !== undefined ? Number(body.budget) : 0.0,
    status: body.status || 'planning',
    start_date: body.start_date || null,
    end_date: body.end_date || null,
    tasks: body.tasks || undefined,
  };

  next();
}

/**
 * Middleware: Validates payload for full Project replacement (PUT /api/v1/projects/:id).
 */
export function validateUpdateProject(req, res, next) {
  // A PUT requires all mandatory resource fields
  return validateCreateProject(req, res, next);
}

/**
 * Middleware: Validates payload for partial Project update (PATCH /api/v1/projects/:id).
 */
export function validatePatchProject(req, res, next) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'body', message: 'PATCH payload must contain at least one field to update' }],
    });
  }

  const allowedFields = ['code', 'name', 'description', 'budget', 'status', 'start_date', 'end_date'];
  const providedFields = Object.keys(body);

  const invalidFields = providedFields.filter((f) => !allowedFields.includes(f));
  if (invalidFields.length > 0) {
    errors.push({
      field: 'unknown_fields',
      message: `Unknown or non-updatable fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
    });
  }

  if (body.code !== undefined) {
    if (typeof body.code !== 'string' || !PROJECT_CODE_REGEX.test(body.code.trim())) {
      errors.push({ field: 'code', message: 'Code must be 2-20 characters long and alphanumeric with hyphens' });
    }
  }

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 3 || body.name.trim().length > 150) {
      errors.push({ field: 'name', message: 'Name must be between 3 and 150 characters' });
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 1000) {
      errors.push({ field: 'description', message: 'Description must be a string up to 1000 characters' });
    }
  }

  if (body.budget !== undefined && body.budget !== null) {
    const num = Number(body.budget);
    if (typeof body.budget !== 'number' || isNaN(num) || num < 0) {
      errors.push({ field: 'budget', message: 'Budget must be a non-negative number' });
    }
  }

  if (body.status !== undefined) {
    if (!VALID_PROJECT_STATUSES.includes(body.status)) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_PROJECT_STATUSES.join(', ')}` });
    }
  }

  if (body.start_date !== undefined && body.start_date !== null && !DATE_REGEX.test(body.start_date)) {
    errors.push({ field: 'start_date', message: 'Start date must be in YYYY-MM-DD or ISO 8601 format' });
  }

  if (body.end_date !== undefined && body.end_date !== null && !DATE_REGEX.test(body.end_date)) {
    errors.push({ field: 'end_date', message: 'End date must be in YYYY-MM-DD or ISO 8601 format' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
}

/**
 * Middleware: Validates payload for creating a Task (POST /api/v1/tasks).
 */
export function validateCreateTask(req, res, next) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({
      success: false,
      message: 'Request body must be a valid JSON object',
      errors: [{ field: 'body', message: 'Payload is empty or not an object' }],
    });
  }

  // project_id (required positive integer)
  const parsedProjectId = parseInt(body.project_id, 10);
  if (!Number.isInteger(parsedProjectId) || parsedProjectId <= 0) {
    errors.push({ field: 'project_id', message: 'project_id is required and must be a positive integer referencing an existing project' });
  }

  // title (required, string, 3-200 chars)
  if (!body.title || typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 200) {
    errors.push({ field: 'title', message: 'Title is required and must be between 3 and 200 characters' });
  }

  // description (optional, string, max 2000 chars)
  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be a string up to 2000 characters' });
    }
  }

  // status (optional, enum)
  if (body.status !== undefined && body.status !== null) {
    if (!VALID_TASK_STATUSES.includes(body.status)) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_TASK_STATUSES.join(', ')}` });
    }
  }

  // priority (optional, enum)
  if (body.priority !== undefined && body.priority !== null) {
    if (!VALID_TASK_PRIORITIES.includes(body.priority)) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_TASK_PRIORITIES.join(', ')}` });
    }
  }

  // estimated_hours (optional, non-negative number)
  if (body.estimated_hours !== undefined && body.estimated_hours !== null) {
    const hours = Number(body.estimated_hours);
    if (typeof body.estimated_hours !== 'number' || isNaN(hours) || hours < 0) {
      errors.push({ field: 'estimated_hours', message: 'Estimated hours must be a non-negative number' });
    }
  }

  // due_date (optional, date format)
  if (body.due_date !== undefined && body.due_date !== null && !DATE_REGEX.test(body.due_date)) {
    errors.push({ field: 'due_date', message: 'Due date must be in YYYY-MM-DD or ISO 8601 format' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  req.body = {
    project_id: parsedProjectId,
    title: body.title.trim(),
    description: body.description ? body.description.trim() : null,
    status: body.status || 'todo',
    priority: body.priority || 'medium',
    estimated_hours: body.estimated_hours !== undefined ? Number(body.estimated_hours) : 1.0,
    due_date: body.due_date || null,
  };

  next();
}

/**
 * Middleware: Validates payload for full Task update (PUT /api/v1/tasks/:id).
 */
export function validateUpdateTask(req, res, next) {
  return validateCreateTask(req, res, next);
}

/**
 * Middleware: Validates payload for partial Task update (PATCH /api/v1/tasks/:id).
 */
export function validatePatchTask(req, res, next) {
  const errors = [];
  const body = req.body;

  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: [{ field: 'body', message: 'PATCH payload must contain at least one field to update' }],
    });
  }

  const allowedFields = ['project_id', 'title', 'description', 'status', 'priority', 'estimated_hours', 'due_date'];
  const providedFields = Object.keys(body);

  const invalidFields = providedFields.filter((f) => !allowedFields.includes(f));
  if (invalidFields.length > 0) {
    errors.push({
      field: 'unknown_fields',
      message: `Unknown or non-updatable fields: ${invalidFields.join(', ')}. Allowed: ${allowedFields.join(', ')}`,
    });
  }

  if (body.project_id !== undefined) {
    const pid = parseInt(body.project_id, 10);
    if (!Number.isInteger(pid) || pid <= 0) {
      errors.push({ field: 'project_id', message: 'project_id must be a positive integer' });
    }
  }

  if (body.title !== undefined) {
    if (typeof body.title !== 'string' || body.title.trim().length < 3 || body.title.trim().length > 200) {
      errors.push({ field: 'title', message: 'Title must be between 3 and 200 characters' });
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 2000) {
      errors.push({ field: 'description', message: 'Description must be a string up to 2000 characters' });
    }
  }

  if (body.status !== undefined) {
    if (!VALID_TASK_STATUSES.includes(body.status)) {
      errors.push({ field: 'status', message: `Status must be one of: ${VALID_TASK_STATUSES.join(', ')}` });
    }
  }

  if (body.priority !== undefined) {
    if (!VALID_TASK_PRIORITIES.includes(body.priority)) {
      errors.push({ field: 'priority', message: `Priority must be one of: ${VALID_TASK_PRIORITIES.join(', ')}` });
    }
  }

  if (body.estimated_hours !== undefined && body.estimated_hours !== null) {
    const hours = Number(body.estimated_hours);
    if (typeof body.estimated_hours !== 'number' || isNaN(hours) || hours < 0) {
      errors.push({ field: 'estimated_hours', message: 'Estimated hours must be a non-negative number' });
    }
  }

  if (body.due_date !== undefined && body.due_date !== null && !DATE_REGEX.test(body.due_date)) {
    errors.push({ field: 'due_date', message: 'Due date must be in YYYY-MM-DD or ISO 8601 format' });
  }

  if (errors.length > 0) {
    return res.status(400).json({ success: false, message: 'Validation failed', errors });
  }

  next();
}
