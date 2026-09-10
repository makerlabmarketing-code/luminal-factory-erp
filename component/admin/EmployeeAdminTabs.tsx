import Link from 'next/link';

export function EmployeeAdminTabs({ active }: { active: 'employees' | 'permissions' }) {
  return (
    <nav aria-label="Khu vực nhân sự" className="flex gap-2 border-b border-slate-800">
      <Link href="/admin/employees" className={`border-b-2 px-3 py-2 text-xs font-bold ${active === 'employees' ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
        Hồ sơ nhân sự
      </Link>
      <Link href="/admin/accounts" className={`border-b-2 px-3 py-2 text-xs font-bold ${active === 'permissions' ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
        Phân quyền
      </Link>
    </nav>
  );
}
