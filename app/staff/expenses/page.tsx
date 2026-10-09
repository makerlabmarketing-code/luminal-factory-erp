// app/staff/expenses/page.tsx
import { Suspense } from 'react';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { StaffExpensesContent } from './ExpensesView';
import { getAuthenticatedStaffPortalData } from '@/services/server/staffPortalData';

export default async function StaffExpensesPage() {
  const portalData = await getAuthenticatedStaffPortalData();

  return (
    <Suspense fallback={<CenteredPageLoading message="Đang tải dữ liệu chi tiêu..." />}>
      <div className="p-4 max-w-7xl mx-auto text-slate-100 bg-slate-950 min-h-screen pt-6">
        <StaffExpensesContent workerData={portalData.employee} />
      </div>
    </Suspense>
  );
}
