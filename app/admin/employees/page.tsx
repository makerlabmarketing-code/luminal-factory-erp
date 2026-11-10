// app/admin/employees/page.tsx
import { getAdminEmployeeListData } from '@/services/server/adminEmployeeData';
import AdminEmployeesClient from './AdminEmployeesClient';
import { AuthFlowError, requireSystemOwner } from '@/services/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminEmployeesPage() {
  try {
    const employeeListData = await getAdminEmployeeListData();
    const canReview = process.env.COMPETENCY_REVIEWS_ENABLED === 'true' &&
      await requireSystemOwner().then(() => true, () => false);
    return <AdminEmployeesClient initialData={employeeListData} showReviews={canReview} />;
  } catch (error) {
    return (
      <AdminEmployeesClient
        initialData={null}
        initialError={error instanceof AuthFlowError && error.status === 403 ? 'forbidden' : 'employee_list_load_failed'}
      />
    );
  }
}
