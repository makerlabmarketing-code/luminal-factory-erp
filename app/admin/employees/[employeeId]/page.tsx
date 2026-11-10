import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AuthFlowError, requireSystemOwner } from '@/services/server/auth';
import { getAdminEmployeeDetailData } from '@/services/server/adminEmployeeData';
import AdminEmployeeDetailClient from './AdminEmployeeDetailClient';
import EmployeeDetailErrorState from './EmployeeDetailErrorState';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminEmployeeDetailPage(
  props: {
    params: Promise<{ employeeId: string }>;
  }
) {
  const params = await props.params;
  try {
    const employee = await getAdminEmployeeDetailData(params.employeeId);

    const canReview = employee.assignedRole === 'STAFF' && employee.employmentStatus === 'ACTIVE' &&
      process.env.COMPETENCY_REVIEWS_ENABLED === 'true' &&
      await requireSystemOwner().then(() => true, () => false);
    return (
      <>
        {canReview && <div className="px-4 pt-3"><Link className="admin-button-secondary" href={`/admin/competency-reviews?employee=${encodeURIComponent(params.employeeId)}`}>Đánh giá năng lực</Link></div>}
        <AdminEmployeeDetailClient initialData={employee} />
      </>
    );
  } catch (error) {
    if (error instanceof AuthFlowError) {
      if (error.status === 404) notFound();
      if (error.status === 403) return <EmployeeDetailErrorState forbidden />;
      if (error.status === 400) return <EmployeeDetailErrorState invalid />;
    }

    return <EmployeeDetailErrorState />;
  }
}
