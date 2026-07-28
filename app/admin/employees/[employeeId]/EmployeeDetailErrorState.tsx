'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { RefreshCcw } from 'lucide-react';

export default function EmployeeDetailErrorState({ forbidden = false, invalid = false }: { forbidden?: boolean; invalid?: boolean }) {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();
  const title = forbidden ? 'Không có quyền truy cập' : invalid ? 'Mã nhân sự không hợp lệ' : 'Không thể tải hồ sơ';

  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className={`text-base font-bold ${forbidden ? 'text-red-300' : 'text-amber-300'}`}>{title}</h1>
        <p className="mt-2 text-xs text-slate-400">{forbidden ? 'Bạn không có quyền xem hồ sơ nhân sự này.' : invalid ? 'Đường dẫn hồ sơ không chứa mã nhân sự hợp lệ.' : 'Hệ thống gặp lỗi khi tải dữ liệu chính. Vui lòng thử lại.'}</p>
        {!forbidden && !invalid && (
          <button type="button" disabled={isRetrying} onClick={() => startTransition(() => router.refresh())} className="mt-4 inline-flex items-center gap-2 rounded-lg border border-blue-500/40 px-3 py-2 text-xs font-bold text-blue-300 disabled:opacity-60">
            <RefreshCcw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />{isRetrying ? 'Đang thử lại...' : 'Thử lại'}
          </button>
        )}
      </section>
    </main>
  );
}
