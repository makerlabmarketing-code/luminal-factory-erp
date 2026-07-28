import AdminDashboardCharts, { AdminDashboardError } from './AdminDashboardCharts';
import { AuthFlowError } from '@/services/server/auth';
import { DashboardDataError, getAdminDashboardDto } from '@/services/server/adminDashboardData';
import { AdminPage, AdminPageHeader } from '@/component/AdminUI';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminDashboardPage() {
  try {
    const dashboard = await getAdminDashboardDto();
    return <AdminPage>
      <AdminPageHeader title="Tổng quan vận hành" description="Theo dõi nhanh dòng tiền và tình hình vận hành hiện tại." />
      <AdminDashboardCharts dashboard={dashboard} />
    </AdminPage>;
  } catch (error) {
    logDashboardError(error);
    return <AdminDashboardError />;
  }
}

function logDashboardError(error: unknown): void {
  if (error instanceof DashboardDataError) {
    console.error('admin_dashboard_data_error', {
      failure_stage: error.failureStage,
      service_name: error.serviceName,
      supabase_error_code: error.supabaseErrorCode ?? 'unknown',
    });
    return;
  }

  if (error instanceof AuthFlowError) {
    console.error('admin_dashboard_auth_error', {
      failure_stage: error.failureStage,
      service_name: 'admin_authorization',
    });
    return;
  }

  console.error('admin_dashboard_unknown_error', {
    failure_stage: 'unknown',
    service_name: 'admin_dashboard',
  });
}
