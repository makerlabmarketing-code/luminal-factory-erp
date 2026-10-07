/** One default-off gate for transactional record history and its readers. */
export function activityHistoryEnabled() { return process.env.ERP_ACTIVITY_HISTORY_ENABLED === 'true'; }
