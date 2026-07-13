import Link from 'next/link';
import { ArrowRight, BriefcaseBusiness, ShieldCheck } from 'lucide-react';

const accountOptions = [
  {
    title: 'Dành cho quản trị',
    subtitle: 'Owner/Admin',
    description:
      'Truy cập dashboard quản trị, tài chính, nhân sự, cấu hình và toàn bộ dự án theo quyền.',
    href: '/admin/dashboard',
    icon: ShieldCheck,
    accent: 'text-blue-400',
    border: 'hover:border-blue-500/60',
  },
  {
    title: 'Dành cho nhân viên',
    subtitle: 'Tài khoản riêng',
    description:
      'Xem công việc, dự án được giao, lịch làm, chấm công, thông báo và hồ sơ cá nhân.',
    href: '/staff',
    icon: BriefcaseBusiness,
    accent: 'text-emerald-400',
    border: 'hover:border-emerald-500/60',
  },
];

export default function GatewayPage() {
  return (
    <main className="min-h-screen bg-slate-950 px-5 py-8 font-sans text-slate-100">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl flex-col justify-center gap-8">
        <header className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
            Luminal Factory ERP
          </p>
          <h1 className="text-3xl font-black tracking-tight text-white md:text-4xl">
            Chọn khu vực đăng nhập
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-400">
            Sử dụng tài khoản được cấp riêng cho từng vai trò. Không dùng chung tài khoản hoặc đường dẫn bí mật.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          {accountOptions.map((option) => {
            const Icon = option.icon;

            return (
              <Link
                key={option.href}
                href={option.href}
                className={`group flex min-h-56 flex-col justify-between rounded-lg border border-slate-800 bg-slate-900 p-6 transition ${option.border}`}
              >
                <div className="space-y-4">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-md bg-slate-950 ${option.accent}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-slate-500">
                      {option.subtitle}
                    </p>
                    <h2 className="text-xl font-bold text-white">{option.title}</h2>
                  </div>
                  <p className="text-sm leading-6 text-slate-400">{option.description}</p>
                </div>

                <div className="mt-6 flex items-center gap-2 text-xs font-bold text-slate-300">
                  Tiếp tục
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </div>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}
