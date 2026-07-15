import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function NoWorkspacePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
      <section className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-amber-500/20 bg-amber-500/10 text-amber-300">
          <ShieldAlert className="h-5 w-5" />
        </div>
        <div className="space-y-2">
          <h1 className="text-base font-bold">Chưa được cấp quyền</h1>
          <p className="text-xs leading-5 text-slate-400">
            Tài khoản đã xác thực nhưng chưa có khu vực làm việc phù hợp.
          </p>
        </div>
        <Link
          href="/admin/dashboard"
          className="block rounded-xl bg-blue-600 p-3 text-xs font-bold text-white hover:bg-blue-700"
        >
          Quay lại đăng nhập
        </Link>
      </section>
    </main>
  );
}
