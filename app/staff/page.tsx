// app/staff/page.tsx
import { Suspense } from 'react';
import { AlertTriangle } from 'lucide-react';
import StaffPortalContent from './portal/StaffPortalContent';
import StaffPortalRecoveryActions from './StaffPortalRecoveryActions';
import { getStaffPortalLoadState } from '@/services/server/staffPortalData';

function StaffPortalStatusCard({
  code,
  message,
  retryable,
  correlationId,
  action,
}: {
  code: string;
  message: string;
  retryable: boolean;
  correlationId: string;
  action: 'login' | 'retry' | 'none';
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-base font-bold text-white">Không thể mở khu vực nhân viên</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">{message}</p>
        <p className="mt-3 text-[10px] font-mono text-slate-500">
          Mã hỗ trợ: {correlationId} · {code}
        </p>
        <StaffPortalRecoveryActions retryable={retryable} action={action} />
      </section>
    </main>
  );
}

export default async function StaffPage() {
  const portalState = await getStaffPortalLoadState();

  if (!portalState.ok) {
    return <StaffPortalStatusCard {...portalState.error} />;
  }

  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-500 text-xs font-mono">Đang đồng bộ cổng nhân viên...</div>}>
      {portalState.warnings.length > 0 && (
        <div className="mx-auto mt-4 max-w-6xl px-4">
          {portalState.warnings.map((warning) => (
            <div key={warning.correlationId} role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-100">
              {warning.message}
              <span className="mt-1 block font-mono text-[10px] text-amber-200/70">
                Mã hỗ trợ: {warning.correlationId}
              </span>
            </div>
          ))}
        </div>
      )}
      <StaffPortalContent
        workerData={portalState.employee}
        assignedBranchData={portalState.assignedBranch}
        capabilities={portalState.capabilities}
      />
    </Suspense>
  );
}
