'use client';

import { ClipboardCheck, ShieldCheck, Users } from 'lucide-react';

const tabs = [
  { id: 'employees', title: 'Hồ sơ nhân sự', href: '/admin/employees', icon: Users },
  { id: 'permissions', title: 'Phân quyền', href: '/admin/employees?tab=permissions', icon: ShieldCheck },
  { id: 'reviews', title: 'Đánh giá năng lực', href: '/admin/employees?tab=reviews', icon: ClipboardCheck },
] as const;

export type PeopleTab = typeof tabs[number]['id'];

export function EmployeeAdminTabs({ active, showReviews }: { active: PeopleTab; showReviews: boolean }) {
  return (
    <nav aria-label="Khu vực nhân sự" className="flex flex-wrap gap-1 border-b border-slate-800">
      {tabs.filter(tab => tab.id !== 'reviews' || showReviews).map(({ id, title, href, icon: Icon }) => (
        <a
          key={id}
          href={href}
          aria-current={active === id ? 'page' : undefined}
          onClick={event => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            event.preventDefault();
            if (window.location.pathname + window.location.search !== href) window.history.pushState(null, '', href);
          }}
          className={`inline-flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-xs font-bold sm:px-4 ${active === id ? 'border-blue-500 text-blue-300' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {title}
        </a>
      ))}
    </nav>
  );
}
