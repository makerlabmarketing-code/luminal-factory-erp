// app/page.tsx
'use client';
import Link from 'next/link';
import { ShieldCheck, Users, QrCode } from 'lucide-react';

export default function GatewayPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div>
          <div className="inline-block p-4 bg-blue-600/20 rounded-3xl mb-4 border border-blue-500/30">
            <QrCode className="w-12 h-12 text-blue-500" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-white">LUMINAL FACTORY</h1>
          <p className="text-slate-500 text-sm mt-2">Hệ thống điều hành xưởng & Đối soát tài chính</p>
        </div>

        <div className="grid gap-4">
          {/* Nút vào vai Admin */}
          <Link href="/admin/dashboard" className="group p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-blue-500/50 transition flex items-center gap-4 text-left shadow-xl">
            <div className="p-3 bg-blue-600/10 text-blue-500 rounded-xl group-hover:bg-blue-600 group-hover:text-white transition">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">Dành cho Admin</h3>
              <p className="text-xs text-slate-500">Quản lý lương, góp vốn, quy trình</p>
            </div>
          </Link>

          {/* Nút vào vai Nhân viên */}
          <Link href="/staff/tasks" className="group p-6 bg-slate-900 border border-slate-800 rounded-2xl hover:border-amber-500/50 transition flex items-center gap-4 text-left shadow-xl">
            <div className="p-3 bg-amber-600/10 text-amber-500 rounded-xl group-hover:bg-amber-600 group-hover:text-white transition">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-white">Dành cho Nhân sự</h3>
              <p className="text-xs text-slate-500">Chấm công, làm checklist, báo cáo QC</p>
            </div>
          </Link>
        </div>

        <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Version 1.0.0 Alpha - Secured by Supabase</p>
      </div>
    </div>
  );
}