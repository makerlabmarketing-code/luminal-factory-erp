// app/staff/tasks/page.tsx
import { Suspense } from 'react';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { StaffTasksContent } from './TasksView';
import { getAuthenticatedStaffPortalData } from '@/services/server/staffPortalData';

export default async function StaffTasksPage() {
  const portalData = await getAuthenticatedStaffPortalData();

  return (
    <Suspense fallback={<CenteredPageLoading message="Đang tải công việc của bạn..." />}>
      <div className="p-4 max-w-7xl mx-auto text-slate-100 bg-slate-950 min-h-screen pt-6">
        <StaffTasksContent workerData={portalData.employee} />
      </div>
    </Suspense>
  );
}
