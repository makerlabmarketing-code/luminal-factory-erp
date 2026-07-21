export const defaultBaseUrl = 'http://127.0.0.1:3000';
export const defaultOutputDir = '.artifacts/screenshots';
export const defaultReadySelector = 'body';

export const screenshotViewports = [
  { name: 'desktop', width: 1440, height: 1100 },
  { name: 'mobile', width: 390, height: 844 },
];

export const screenshotRoutes = [
  { name: 'home', path: '/', requiresAuth: false },
  { name: 'no-workspace', path: '/auth/no-workspace', requiresAuth: false },
  { name: 'admin-projects', path: '/admin/projects', requiresAuth: true },
  { name: 'admin-project-detail-1', path: '/admin/projects/1', requiresAuth: true },
  { name: 'staff-tasks', path: '/staff/tasks', requiresAuth: true },
];
