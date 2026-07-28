"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoadingLink } from "@/component/GlobalLoading";
import {
  ArrowLeftRight, BriefcaseBusiness, CalendarDays, Database, FolderKanban,
  LayoutDashboard, Mail, MapPin, Menu, PanelLeftClose, PiggyBank, ShieldCheck, WalletCards,
  Users, X,
} from "lucide-react";
import { useState } from "react";
import AdminLogoutButton from "./AdminLogoutButton";

interface AdminShellProps { children: React.ReactNode; canAccessAdmin: boolean; canAccessStaff: boolean; }

const menuGroups = [
  { groupTitle: "Tổng quan", items: [{ name: "Tổng quan vận hành", path: "/admin/dashboard", icon: LayoutDashboard }] },
  { groupTitle: "Dự án & sản xuất", items: [{ name: "Dự án & công việc", path: "/admin/projects", icon: FolderKanban }] },
  { groupTitle: "Nhân sự", items: [
    { name: "Hồ sơ nhân sự", path: "/admin/employees", icon: Users },
    { name: "Chấm công", path: "/admin/attendance", icon: CalendarDays },
    { name: "Cơ sở làm việc", path: "/admin/facilities", icon: MapPin },
    { name: "Tài khoản & quyền truy cập", path: "/admin/accounts", icon: ShieldCheck },
  ] },
  { groupTitle: "Tài chính", items: [{ name: "Sổ thu chi", path: "/admin/capital", icon: PiggyBank }, { name: "Quyết toán lương", path: "/admin/payroll", icon: WalletCards }] },
  { groupTitle: "Cấu hình hệ thống", items: [
    { name: "Danh mục hệ thống", path: "/admin/metadata", icon: Database },
    { name: "Mẫu email", path: "/admin/email-editor", icon: Mail },
  ] },
];

export default function AdminShell({ children, canAccessAdmin, canAccessStaff }: AdminShellProps) {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);
  const canSwitchWorkspace = canAccessAdmin && canAccessStaff;
  const currentItem = menuGroups.flatMap((group) => group.items).find(
    (item) => pathname === item.path || pathname.startsWith(`${item.path}/`),
  );

  const navigation = (
    <>
      <div className="flex h-16 items-center justify-between border-b border-slate-800/80 px-5">
        <div><p className="text-sm font-extrabold tracking-[0.12em] text-blue-400">LUMINAL HQ</p><p className="mt-0.5 text-[10px] font-medium text-slate-500">Vận hành xưởng</p></div>
        <button type="button" onClick={() => setMobileNavigationOpen(false)} className="admin-icon-button lg:hidden" aria-label="Đóng điều hướng"><X className="h-4 w-4" /></button>
      </div>
      <nav className="custom-scrollbar flex-1 space-y-6 overflow-y-auto px-3 py-5" aria-label="Điều hướng quản trị">
        {menuGroups.map((group) => <div key={group.groupTitle} className="space-y-1">
          <p className="px-3 pb-1.5 text-[10px] font-semibold tracking-wide text-slate-500">{group.groupTitle}</p>
          {group.items.map((item) => {
            const isActive = pathname === item.path || pathname.startsWith(`${item.path}/`);
            return <Link key={item.path} href={item.path} onClick={() => setMobileNavigationOpen(false)} aria-current={isActive ? "page" : undefined} className={`admin-nav-item ${isActive ? "admin-nav-item-active" : ""}`}><item.icon className="h-4 w-4 shrink-0" /><span>{item.name}</span></Link>;
          })}
        </div>)}
      </nav>
      <div className="space-y-2 border-t border-slate-800/80 p-3">
        {canSwitchWorkspace && <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-2">
          <p className="flex items-center gap-2 px-2 py-1.5 text-[10px] font-semibold text-slate-500"><ArrowLeftRight className="h-3.5 w-3.5" />Chuyển khu vực</p>
          <LoadingLink href="/staff" loadingMessage="Đang mở khu vực nhân viên..." className="admin-nav-item"><BriefcaseBusiness className="h-4 w-4" />Chuyển sang khu vực nhân viên</LoadingLink>
        </div>}
        <AdminLogoutButton />
      </div>
    </>
  );

  return <div className="admin-shell min-h-screen bg-slate-950 text-slate-100">
    {mobileNavigationOpen && <button className="fixed inset-0 z-40 bg-slate-950/80 backdrop-blur-sm lg:hidden" onClick={() => setMobileNavigationOpen(false)} aria-label="Đóng điều hướng" />}
    <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-slate-800/80 bg-slate-900 transition-transform duration-200 lg:translate-x-0 ${mobileNavigationOpen ? "translate-x-0" : "-translate-x-full"}`}>{navigation}</aside>
    <div className="min-w-0 lg:pl-64">
      <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 backdrop-blur-md sm:px-6 lg:px-8">
        <button type="button" onClick={() => setMobileNavigationOpen(true)} className="admin-icon-button lg:hidden" aria-label="Mở điều hướng"><Menu className="h-5 w-5" /></button>
        <PanelLeftClose className="hidden h-4 w-4 text-slate-600 lg:block" aria-hidden="true" />
        <div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-100">{currentItem?.name || "Khu vực quản trị"}</p><p className="hidden text-[11px] text-slate-500 sm:block">Luminal Factory ERP</p></div>
        <div className="ml-auto rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 text-[11px] font-medium text-slate-400">Quản trị</div>
      </header>
      <main className="admin-main min-w-0">{children}</main>
    </div>
  </div>;
}
