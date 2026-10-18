-- ====================================================================
-- Database Schema: Secured Relational CRUD API Server
-- Database Engine: SQLite Relational Database Engine
-- Enforces: Foreign Keys, Cascade Deletion, Type Constraints, Checks, Indexes
-- ====================================================================

PRAGMA foreign_keys = ON;

-- --------------------------------------------------------------------
-- Table: projects
-- Represents top-level projects / workstreams
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  description TEXT,
  budget REAL NOT NULL DEFAULT 0.0 CHECK (budget >= 0.0),
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'active', 'completed', 'archived')),
  start_date TEXT,
  end_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec'))
);

-- --------------------------------------------------------------------
-- Table: tasks
-- Represents tasks linked to parent projects via Foreign Key with Cascade
-- --------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'done', 'blocked')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_hours REAL NOT NULL DEFAULT 1.0 CHECK (estimated_hours >= 0.0),
  due_date TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now', 'subsec')),
  FOREIGN KEY (project_id) REFERENCES projects (id) ON DELETE CASCADE
);

-- --------------------------------------------------------------------
-- Indexes for Optimized Relational Lookups and Filtering
-- --------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_projects_status ON projects (status);
CREATE INDEX IF NOT EXISTS idx_projects_code ON projects (code);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks (project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority);

-- --------------------------------------------------------------------
-- Relational Summary View: Aggregated Project & Task Metrics
-- --------------------------------------------------------------------
CREATE VIEW IF NOT EXISTS project_summary_view AS
SELECT
  p.id AS project_id,
  p.code AS project_code,
  p.name AS project_name,
  p.status AS project_status,
  p.budget AS project_budget,
  COUNT(t.id) AS total_tasks,
  SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS completed_tasks,
  SUM(CASE WHEN t.status != 'done' THEN 1 ELSE 0 END) AS open_tasks,
  ROUND(
    CASE
      WHEN COUNT(t.id) = 0 THEN 0.0
      ELSE (CAST(SUM(CASE WHEN t.status = 'done' THEN 1 ELSE 0 END) AS REAL) / COUNT(t.id)) * 100.0
    END,
    2
  ) AS progress_percentage,
  COALESCE(SUM(t.estimated_hours), 0.0) AS total_estimated_hours,
  p.created_at,
  p.updated_at
FROM projects p
LEFT JOIN tasks t ON p.id = t.project_id
GROUP BY p.id;
