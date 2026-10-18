import { query, get, run } from '../db/connection.js';

const ALLOWED_TASK_SORT_COLUMNS = ['id', 'project_id', 'title', 'status', 'priority', 'estimated_hours', 'due_date', 'created_at', 'updated_at'];
const ALLOWED_SORT_ORDERS = ['ASC', 'DESC'];

export const TaskModel = {
  /**
   * Retrieves tasks with optional filtering, searching, and pagination.
   * Joins with projects table to return relational context.
   */
  async findAll({ projectId, status, priority, search, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
    const conditions = [];
    const params = [];

    if (projectId !== undefined && projectId !== null) {
      conditions.push('t.project_id = ?');
      params.push(projectId);
    }

    if (status) {
      conditions.push('t.status = ?');
      params.push(status);
    }

    if (priority) {
      conditions.push('t.priority = ?');
      params.push(priority);
    }

    if (search) {
      conditions.push('(t.title LIKE ? OR t.description LIKE ?)');
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const safeSortBy = ALLOWED_TASK_SORT_COLUMNS.includes(sortBy.toLowerCase()) ? sortBy.toLowerCase() : 'created_at';
    const safeSortOrder = ALLOWED_SORT_ORDERS.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Count query
    const countSql = `SELECT COUNT(*) as total FROM tasks t ${whereClause};`;
    const countRow = await get(countSql, params);
    const total = countRow ? countRow.total : 0;

    // Relational SELECT joined with parent project
    const sql = `
      SELECT
        t.id,
        t.project_id,
        p.code AS project_code,
        p.name AS project_name,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.estimated_hours,
        t.due_date,
        t.created_at,
        t.updated_at
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      ${whereClause}
      ORDER BY t.${safeSortBy} ${safeSortOrder}
      LIMIT ? OFFSET ?;
    `;

    const rows = await query(sql, [...params, limit, offset]);

    return {
      total,
      limit,
      offset,
      data: rows,
    };
  },

  /**
   * Retrieves a single task by ID with its parent project details.
   */
  async findById(id) {
    const sql = `
      SELECT
        t.id,
        t.project_id,
        p.code AS project_code,
        p.name AS project_name,
        p.status AS project_status,
        t.title,
        t.description,
        t.status,
        t.priority,
        t.estimated_hours,
        t.due_date,
        t.created_at,
        t.updated_at
      FROM tasks t
      INNER JOIN projects p ON t.project_id = p.id
      WHERE t.id = ?;
    `;
    return get(sql, [id]);
  },

  /**
   * Creates a new task linked to a parent project.
   */
  async create({ project_id, title, description = null, status = 'todo', priority = 'medium', estimated_hours = 1.0, due_date = null }) {
    const sql = `
      INSERT INTO tasks (project_id, title, description, status, priority, estimated_hours, due_date)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const result = await run(sql, [project_id, title, description, status, priority, estimated_hours, due_date]);
    return this.findById(result.lastID);
  },

  /**
   * Full update of a task (PUT).
   */
  async update(id, { project_id, title, description = null, status = 'todo', priority = 'medium', estimated_hours = 1.0, due_date = null }) {
    const sql = `
      UPDATE tasks
      SET
        project_id = ?,
        title = ?,
        description = ?,
        status = ?,
        priority = ?,
        estimated_hours = ?,
        due_date = ?,
        updated_at = datetime('now', 'subsec')
      WHERE id = ?;
    `;
    const result = await run(sql, [project_id, title, description, status, priority, estimated_hours, due_date, id]);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  /**
   * Partial update of a task (PATCH).
   */
  async patch(id, fields) {
    const allowedFields = ['project_id', 'title', 'description', 'status', 'priority', 'estimated_hours', 'due_date'];
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push("updated_at = datetime('now', 'subsec')");
    params.push(id);

    const sql = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?;`;
    const result = await run(sql, params);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  /**
   * Deletes a task by ID.
   */
  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const sql = `DELETE FROM tasks WHERE id = ?;`;
    await run(sql, [id]);
    return existing;
  },

  /**
   * Retrieves summary counts of tasks grouped by status and priority.
   */
  async getStatusBreakdown() {
    const statusSql = `
      SELECT status, COUNT(*) AS count
      FROM tasks
      GROUP BY status;
    `;
    const prioritySql = `
      SELECT priority, COUNT(*) AS count
      FROM tasks
      GROUP BY priority;
    `;
    const [byStatus, byPriority] = await Promise.all([query(statusSql), query(prioritySql)]);

    return {
      byStatus: byStatus.reduce((acc, row) => ({ ...acc, [row.status]: row.count }), {}),
      byPriority: byPriority.reduce((acc, row) => ({ ...acc, [row.priority]: row.count }), {}),
    };
  },
};
