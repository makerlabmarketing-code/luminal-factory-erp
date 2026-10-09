// app/staff/attendance/page.tsx
import { Suspense } from 'react';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { StaffAttendanceContent } from './AttendanceView';
import { getAuthenticatedStaffPortalData } from '@/services/server/staffPortalData';

export default async function StaffAttendancePage() {
  const portalData = await getAuthenticatedStaffPortalData();

  return (
    <Suspense fallback={<CenteredPageLoading message="Đang tải dữ liệu chấm công..." />}>
      <div className="p-4 max-w-md mx-auto text-slate-100 bg-slate-950 min-h-screen pt-8">
        <StaffAttendanceContent workerData={portalData.employee} assignedBranchData={portalData.assignedBranch} />
      </div>
    </Suspense>
  );
}
