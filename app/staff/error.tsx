'use client';

import { AlertTriangle, RefreshCcw } from 'lucide-react';

export default function StaffPortalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  console.error('[staff-portal-client-boundary]', {
    digest: error.digest || null,
    code: 'staff_portal_unhandled_failure',
  });

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-5 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-red-500/30 bg-slate-900 p-6 text-center shadow-xl">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <h1 className="mt-4 text-base font-bold text-white">Không thể mở khu vực nhân viên</h1>
        <p className="mt-2 text-sm leading-6 text-slate-300">
          Không thể tải khu vực nhân viên. Vui lòng thử lại.
        </p>
        {error.digest && (
          <p className="mt-3 text-[10px] font-mono text-slate-500">Mã hỗ trợ: {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/40 px-4 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/10"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Thử lại
        </button>
      </section>
    </main>
  );
}
