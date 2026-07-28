import { notFound } from 'next/navigation';
import { AuthFlowError } from '@/services/server/auth';
import { getAdminEmployeeDetailData } from '@/services/server/adminEmployeeData';
import AdminEmployeeDetailClient from './AdminEmployeeDetailClient';
import EmployeeDetailErrorState from './EmployeeDetailErrorState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminEmployeeDetailPage({
  params,
}: {
  params: { employeeId: string };
}) {
  try {
    const employee = await getAdminEmployeeDetailData(params.employeeId);

    return <AdminEmployeeDetailClient initialData={employee} />;
  } catch (error) {
    if (error instanceof AuthFlowError) {
      if (error.status === 404) notFound();
      if (error.status === 403) return <EmployeeDetailErrorState forbidden />;
      if (error.status === 400) return <EmployeeDetailErrorState invalid />;
    }

    return <EmployeeDetailErrorState />;
  }
}
