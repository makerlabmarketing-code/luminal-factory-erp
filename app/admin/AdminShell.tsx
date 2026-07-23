"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LoadingLink } from "@/component/GlobalLoading";
import {
  ArrowLeftRight,
  BriefcaseBusiness,
  CalendarDays,
  ClipboardList,
  Database,
  FolderKanban,
  LayoutDashboard,
  Mail,
  MapPin,
  PiggyBank,
  ShieldCheck,
  Users,
} from "lucide-react";
import AdminLogoutButton from "./AdminLogoutButton";

interface AdminShellProps {
  children: React.ReactNode;
  canAccessAdmin: boolean;
  canAccessStaff: boolean;
}

export default function AdminShell({
  children,
  canAccessAdmin,
  canAccessStaff,
}: AdminShellProps) {
  const pathname = usePathname();
  const canSwitchWorkspace = canAccessAdmin && canAccessStaff;

  const menuGroups = [
    {
      groupTitle: "Tổng quan",
      items: [
        {
          name: "Tổng quan vận hành",
          path: "/admin/dashboard",
          icon: LayoutDashboard,
        },
      ],
    },
    {
      groupTitle: "Dự án & sản xuất",
      items: [
        { name: "Dự án", path: "/admin/projects", icon: FolderKanban },
        {
          name: "Công việc & tiến độ",
          path: "/admin/tasks",
          icon: ClipboardList,
        },
      ],
    },
    {
      groupTitle: "Nhân sự",
      items: [
        { name: "Hồ sơ nhân sự", path: "/admin/employees", icon: Users },
        { name: "Chấm công", path: "/admin/attendance", icon: CalendarDays },
        { name: "Cơ sở làm việc", path: "/admin/facilities", icon: MapPin },
        {
          name: "Tài khoản & quyền truy cập",
          path: "/admin/accounts",
          icon: ShieldCheck,
        },
      ],
    },
    {
      groupTitle: "Tài chính",
      items: [{ name: "Sổ thu chi", path: "/admin/capital", icon: PiggyBank }],
    },
    {
      groupTitle: "Cấu hình hệ thống",
      items: [
        { name: "Danh mục hệ thống", path: "/admin/metadata", icon: Database },
        { name: "Mẫu email", path: "/admin/email-editor", icon: Mail },
      ],
    },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-black text-blue-500 tracking-wider">
            LUMINAL HQ
          </h2>
          <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">
            Hệ điều hành xưởng in
          </p>
        </div>

        <nav className="flex-1 p-4 space-y-5 overflow-y-auto custom-scrollbar">
          {menuGroups.map((group) => (
            <div key={group.groupTitle} className="space-y-1.5">
              <span className="px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                {group.groupTitle}
              </span>

              {group.items.map((item) => {
                const isActive =
                  pathname === item.path ||
                  pathname.startsWith(`${item.path}/`);

                return (
                  <Link
                    key={item.path}
                    href={item.path}
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                      isActive
                        ? "bg-blue-600 text-white shadow-lg shadow-blue-900/30"
                        : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.name}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="space-y-2 border-t border-slate-800 p-4">
          {canSwitchWorkspace && (
            <div className="space-y-1 rounded-lg border border-slate-800 bg-slate-950 p-2">
              <div className="flex items-center gap-2 px-2 py-1 text-[10px] font-bold text-slate-500">
                <ArrowLeftRight className="h-3.5 w-3.5" />
                Chuyển khu vực
              </div>
              <LoadingLink
                href="/admin/dashboard"
                loadingMessage="Đang mở khu vực quản trị..."
                className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-bold text-blue-300 hover:bg-slate-900"
              >
                <LayoutDashboard className="h-3.5 w-3.5" />
                Chuyển sang khu vực quản trị
              </LoadingLink>
              <LoadingLink
                href="/staff"
                loadingMessage="Đang mở khu vực nhân viên..."
                className="flex items-center gap-2 rounded-md px-2 py-2 text-xs font-bold text-emerald-300 hover:bg-slate-900"
              >
                <BriefcaseBusiness className="h-3.5 w-3.5" />
                Chuyển sang khu vực nhân viên
              </LoadingLink>
            </div>
          )}
          <AdminLogoutButton />
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto bg-slate-950">{children}</main>
    </div>
  );
}
