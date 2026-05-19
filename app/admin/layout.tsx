// app/admin/layout.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import AdminGatekeeper from './gatekeeper';
import { LayoutDashboard, Users, Settings, ClipboardList, CalendarDays, Database, Mail, PiggyBank, MapPin, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Định nghĩa cấu trúc phân nhóm menu điều hành của sếp
  const menuGroups = [
    {
      groupTitle: 'Lương & Công',
      items: [
        { name: 'Tổng quan tài chính', path: '/admin/dashboard', icon: LayoutDashboard },
        { name: 'Sổ Cái Vốn & Chi Tiêu', path: '/admin/capital', icon: PiggyBank },
        { name: 'Lịch Chấm Công Ca', path: '/admin/attendance', icon: CalendarDays },
        { name: 'Gán Việc & Tiến Độ Phase', path: '/admin/tasks', icon: ClipboardList },
      ]
    },
    {
      groupTitle: 'Quản Lý Nhân Sự',
      items: [
        { name: 'Hồ Sơ Nhân Sự Sâu', path: '/admin/employees', icon: Users },
        { name: 'Danh Sách Cơ Sở & GPS', path: '/admin/facilities', icon: MapPin },
      ]
    },
    {
      groupTitle: 'Cấu Hình Hệ Thống',
      items: [
        { name: 'Quản Lý Danh Mục DB', path: '/admin/metadata', icon: Database },
        { name: 'Mẫu Email Template', path: '/admin/email-editor', icon: Mail },
        { name: 'Cấu Hình Trung Tâm', path: '/admin/settings', icon: Settings },
      ]
    }
  ];

  return (
    <AdminGatekeeper>
      <div className="flex min-h-screen bg-slate-950 text-slate-100 font-sans">
        
        {/* SIDEBAR TẬP TRUNG */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
          <div className="p-6 border-b border-slate-800">
            <h2 className="text-lg font-black text-blue-500 tracking-wider">LUMINAL HQ</h2>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Hệ điều hành xưởng in</p>
          </div>
          
          <nav className="flex-1 p-4 space-y-5 overflow-y-auto custom-scrollbar">
            {menuGroups.map((group, gIdx) => (
              <div key={gIdx} className="space-y-1.5">
                {/* Tiêu đề nhóm nghiệp vụ */}
                <span className="px-4 text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-2">
                  {group.groupTitle}
                </span>
                
                {group.items.map((item) => {
                  const isActive = pathname === item.path;
                  return (
                    <Link 
                      key={item.path} 
                      href={item.path} 
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs font-bold transition duration-200 ${
                        isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
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

          <div className="p-4 border-t border-slate-800">
            <Link href="/" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 text-xs font-bold transition">
              <LogOut className="w-4 h-4" /> Thoát Admin
            </Link>
          </div>
        </aside>

        {/* KHÔNG GIAN HIỂN THỊ NỘI DUNG */}
        <main className="flex-1 overflow-y-auto bg-slate-950">
          {children}
        </main>

      </div>
    </AdminGatekeeper>
  );
}