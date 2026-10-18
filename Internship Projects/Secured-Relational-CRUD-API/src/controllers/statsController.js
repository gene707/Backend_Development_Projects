import { query } from '../db/connection.js';
import { TaskModel } from '../models/taskModel.js';

export const StatsController = {
  /**
   * GET /api/v1/stats
   * Retrieves overall system metrics, relational aggregates, and task breakdowns.
   */
  async getOverview(req, res, next) {
    try {
      const summaryRows = await query('SELECT * FROM project_summary_view ORDER BY project_id ASC;');
      const breakdown = await TaskModel.getStatusBreakdown();

      const totalProjects = summaryRows.length;
      const totalBudget = summaryRows.reduce((acc, row) => acc + (row.project_budget || 0), 0);
      const totalTasks = summaryRows.reduce((acc, row) => acc + (row.total_tasks || 0), 0);
      const completedTasks = summaryRows.reduce((acc, row) => acc + (row.completed_tasks || 0), 0);
      const totalEstimatedHours = summaryRows.reduce((acc, row) => acc + (row.total_estimated_hours || 0), 0);

      const overallProgress = totalTasks === 0 ? 0 : parseFloat(((completedTasks / totalTasks) * 100).toFixed(2));

      res.status(200).json({
        success: true,
        data: {
          summary: {
            total_projects: totalProjects,
            total_tasks: totalTasks,
            completed_tasks: completedTasks,
            open_tasks: totalTasks - completedTasks,
            overall_progress_percentage: overallProgress,
            total_budget: totalBudget,
            total_estimated_hours: totalEstimatedHours,
          },
          tasksBreakdown: breakdown,
          projectsSummary: summaryRows,
        },
      });
    } catch (error) {
      next(error);
    }
  },
};
