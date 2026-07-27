// app/admin/employees/page.tsx
import { getAdminEmployeeListData } from '@/services/server/adminEmployeeData';
import AdminEmployeesClient from './AdminEmployeesClient';
import { AuthFlowError } from '@/services/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminEmployeesPage() {
  try {
    const employeeListData = await getAdminEmployeeListData();
    return <AdminEmployeesClient initialData={employeeListData} />;
  } catch (error) {
    return (
      <AdminEmployeesClient
        initialData={null}
        initialError={error instanceof AuthFlowError && error.status === 403 ? 'forbidden' : 'employee_list_load_failed'}
      />
    );
  }
}
