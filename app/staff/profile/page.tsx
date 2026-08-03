// app/staff/profile/page.tsx
import { Suspense } from 'react';
import { StaffProfileContent } from './ProfileView';
import { getAuthenticatedStaffPortalData } from '@/services/server/staffPortalData';

export default async function StaffProfilePage() {
  const portalData = await getAuthenticatedStaffPortalData();

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400 text-xs font-mono">Loading...</div>}>
      <div className="mx-auto min-h-screen max-w-2xl bg-slate-950 p-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-8 text-slate-100">
        <StaffProfileContent workerData={portalData.employee} assignedBranchData={portalData.assignedBranch} />
      </div>
    </Suspense>
  );
}
