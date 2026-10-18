import { query, get, run, transaction } from '../db/connection.js';

// Whitelist of valid columns for ORDER BY clauses to prevent SQL injection
const ALLOWED_SORT_COLUMNS = ['id', 'code', 'name', 'budget', 'status', 'created_at', 'updated_at'];
const ALLOWED_SORT_ORDERS = ['ASC', 'DESC'];

export const ProjectModel = {
  /**
   * Retrieves all projects with optional filtering, searching, and pagination.
   * Parameterized queries prevent SQL injection.
   */
  async findAll({ status, search, limit = 50, offset = 0, sortBy = 'created_at', sortOrder = 'DESC' } = {}) {
    const conditions = [];
    const params = [];

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(p.name LIKE ? OR p.code LIKE ? OR p.description LIKE ?)');
      const wildcard = `%${search}%`;
      params.push(wildcard, wildcard, wildcard);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const safeSortBy = ALLOWED_SORT_COLUMNS.includes(sortBy.toLowerCase()) ? sortBy.toLowerCase() : 'created_at';
    const safeSortOrder = ALLOWED_SORT_ORDERS.includes(sortOrder.toUpperCase()) ? sortOrder.toUpperCase() : 'DESC';

    // Count total matching
    const countSql = `SELECT COUNT(*) as total FROM projects p ${whereClause};`;
    const countRow = await get(countSql, params);
    const total = countRow ? countRow.total : 0;

    // Fetch projects joined with summary aggregates
    const sql = `
      SELECT
        p.id,
        p.code,
        p.name,
        p.description,
        p.budget,
        p.status,
        p.start_date,
        p.end_date,
        p.created_at,
        p.updated_at,
        COUNT(t.id) AS total_tasks,
        SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
        ROUND(
          CASE
            WHEN COUNT(t.id) = 0 THEN 0.0
            ELSE (CAST(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS REAL) / COUNT(t.id)) * 100.0
          END,
          2
        ) AS progress_percentage
      FROM projects p
      LEFT JOIN tasks t ON p.id = t.project_id
      ${whereClause}
      GROUP BY p.id
      ORDER BY p.${safeSortBy} ${safeSortOrder}
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
   * Retrieves a single project by ID along with its related tasks.
   */
  async findById(id) {
    const projectSql = `
      SELECT
        p.id,
        p.code,
        p.name,
        p.description,
        p.budget,
        p.status,
        p.start_date,
        p.end_date,
        p.created_at,
        p.updated_at
      FROM projects p
      WHERE p.id = ?;
    `;
    const project = await get(projectSql, [id]);
    if (!project) return null;

    const tasksSql = `
      SELECT
        id,
        project_id,
        title,
        description,
        status,
        priority,
        estimated_hours,
        due_date,
        created_at,
        updated_at
      FROM tasks
      WHERE project_id = ?
      ORDER BY id ASC;
    `;
    const tasks = await query(tasksSql, [id]);

    return {
      ...project,
      tasks,
    };
  },

  /**
   * Retrieves a project by code (case-insensitive).
   */
  async findByCode(code) {
    const sql = `SELECT * FROM projects WHERE code = ? COLLATE NOCASE;`;
    return get(sql, [code]);
  },

  /**
   * Creates a new project.
   */
  async create({ code, name, description = null, budget = 0.0, status = 'planning', start_date = null, end_date = null }) {
    const sql = `
      INSERT INTO projects (code, name, description, budget, status, start_date, end_date)
      VALUES (?, ?, ?, ?, ?, ?, ?);
    `;
    const result = await run(sql, [code.toUpperCase(), name, description, budget, status, start_date, end_date]);
    return this.findById(result.lastID);
  },

  /**
   * Atomically creates a project and an initial list of related tasks inside an ACID transaction.
   */
  async createWithTasks({ projectData, tasks = [] }) {
    return transaction(async ({ run: runTx, get: getTx, query: queryTx }) => {
      const projResult = await runTx(
        `INSERT INTO projects (code, name, description, budget, status, start_date, end_date)
         VALUES (?, ?, ?, ?, ?, ?, ?);`,
        [
          projectData.code.toUpperCase(),
          projectData.name,
          projectData.description || null,
          projectData.budget || 0.0,
          projectData.status || 'planning',
          projectData.start_date || null,
          projectData.end_date || null,
        ]
      );

      const projectId = projResult.lastID;

      for (const task of tasks) {
        await runTx(
          `INSERT INTO tasks (project_id, title, description, status, priority, estimated_hours, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?);`,
          [
            projectId,
            task.title,
            task.description || null,
            task.status || 'todo',
            task.priority || 'medium',
            task.estimated_hours || 1.0,
            task.due_date || null,
          ]
        );
      }

      const project = await getTx(`SELECT * FROM projects WHERE id = ?;`, [projectId]);
      const createdTasks = await queryTx(`SELECT * FROM tasks WHERE project_id = ?;`, [projectId]);

      return {
        ...project,
        tasks: createdTasks,
      };
    });
  },

  /**
   * Full update of a project (PUT).
   */
  async update(id, { code, name, description = null, budget = 0.0, status = 'planning', start_date = null, end_date = null }) {
    const sql = `
      UPDATE projects
      SET
        code = ?,
        name = ?,
        description = ?,
        budget = ?,
        status = ?,
        start_date = ?,
        end_date = ?,
        updated_at = datetime('now', 'subsec')
      WHERE id = ?;
    `;
    const result = await run(sql, [code.toUpperCase(), name, description, budget, status, start_date, end_date, id]);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  /**
   * Partial update of a project (PATCH).
   * Validates columns against whitelist and applies dynamic parameterized SET clause.
   */
  async patch(id, fields) {
    const allowedFields = ['code', 'name', 'description', 'budget', 'status', 'start_date', 'end_date'];
    const updates = [];
    const params = [];

    for (const [key, value] of Object.entries(fields)) {
      if (allowedFields.includes(key)) {
        updates.push(`${key} = ?`);
        params.push(key === 'code' ? value.toUpperCase() : value);
      }
    }

    if (updates.length === 0) {
      return this.findById(id);
    }

    updates.push("updated_at = datetime('now', 'subsec')");
    params.push(id);

    const sql = `UPDATE projects SET ${updates.join(', ')} WHERE id = ?;`;
    const result = await run(sql, params);
    if (result.changes === 0) return null;
    return this.findById(id);
  },

  /**
   * Deletes a project by ID.
   * Relational foreign key constraint with ON DELETE CASCADE ensures all child tasks are removed.
   */
  async delete(id) {
    const existing = await this.findById(id);
    if (!existing) return null;

    const sql = `DELETE FROM projects WHERE id = ?;`;
    await run(sql, [id]);
    return existing;
  },

  /**
   * Retrieves all tasks belonging to a specific project.
   */
  async getTasks(projectId, { status, priority } = {}) {
    const conditions = ['project_id = ?'];
    const params = [projectId];

    if (status) {
      conditions.push('status = ?');
      params.push(status);
    }

    if (priority) {
      conditions.push('priority = ?');
      params.push(priority);
    }

    const sql = `
      SELECT *
      FROM tasks
      WHERE ${conditions.join(' AND ')}
      ORDER BY id ASC;
    `;
    return query(sql, params);
  },
};
