import { notFound } from 'next/navigation';
import { AuthFlowError } from '@/services/server/auth';
import { getAdminEmployeeDetailData } from '@/services/server/adminEmployeeData';
import AdminEmployeeDetailClient from './AdminEmployeeDetailClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function EmployeeDetailAccessDenied() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-base font-bold text-red-300">Không có quyền truy cập</h1>
        <p className="mt-2 text-xs text-slate-400">
          Bạn không có quyền xem hồ sơ nhân sự này.
        </p>
      </section>
    </main>
  );
}

function EmployeeDetailTechnicalError() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-base font-bold text-amber-300">Không thể tải hồ sơ</h1>
        <p className="mt-2 text-xs text-slate-400">
          Hệ thống gặp lỗi khi tải dữ liệu. Vui lòng thử lại sau.
        </p>
      </section>
    </main>
  );
}

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
      if (error.status === 403) return <EmployeeDetailAccessDenied />;
    }

    return <EmployeeDetailTechnicalError />;
  }
}
