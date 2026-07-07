import { Suspense } from 'react';
import StaffPortalContent from './StaffPortalContent';

export default function WorkerPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-500 text-xs font-mono">Đang đồng bộ cổng Portal...</div>}>
      <StaffPortalContent />
    </Suspense>
  );
}
