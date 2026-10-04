import * as userStore from '../models/userStore.js';

// GET /api/admin/dashboard (Admin-only Protected Endpoint)
export async function getAdminDashboard(req, res) {
  try {
    const allUsers = await userStore.getAllUsers();
    const safeUsers = allUsers.map(({ passwordHash: _hash, ...safe }) => safe);

    res.status(200).json({
      success: true,
      message: 'Welcome to the Protected Admin Control Panel',
      accessGrantedTo: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      },
      systemStats: {
        totalRegisteredUsers: safeUsers.length,
        adminCount: safeUsers.filter(u => u.role === 'admin').length,
        regularCount: safeUsers.filter(u => u.role === 'user').length,
        serverUptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
      },
      users: safeUsers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve admin dashboard data'
    });
  }
}
