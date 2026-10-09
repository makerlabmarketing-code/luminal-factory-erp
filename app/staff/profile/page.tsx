// app/staff/profile/page.tsx
import { Suspense } from 'react';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { StaffProfileContent } from './ProfileView';
import { getAuthenticatedStaffProfileData } from '@/services/server/staffPortalData';

export default async function StaffProfilePage() {
  const portalData = await getAuthenticatedStaffProfileData();

  return (
    <Suspense fallback={<CenteredPageLoading message="Đang tải hồ sơ..." />}>
      <div className="mx-auto min-h-screen max-w-2xl bg-slate-950 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-slate-100">
        <StaffProfileContent
          workerData={portalData.employee}
          assignedBranchData={portalData.assignedBranch}
          bankOptions={portalData.bankOptions}
        />
      </div>
    </Suspense>
  );
}
