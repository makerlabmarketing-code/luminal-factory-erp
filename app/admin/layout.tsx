// app/admin/layout.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Users, Layers, Mail, PiggyBank, Settings, LogOut } from 'lucide-react';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const menuItems = [
    { name: 'Tổng quan', path: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Nhân sự & Lương', path: '/admin/employees', icon: Users },
    { name: 'Quy trình sản xuất', path: '/admin/job-templates', icon: Layers },
    { name: 'Góp vốn & Chi tiêu', path: '/admin/capital', icon: PiggyBank },
    { name: 'Mẫu Email', path: '/admin/email-editor', icon: Mail },
    { name: 'Cấu hình SMTP', path: '/admin/settings/email', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-slate-100">
      {/* Sidebar cố định bên trái */}
      <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col flex-shrink-0">
        <div className="p-6 border-b border-slate-800">
          <h2 className="text-lg font-black tracking-tighter text-blue-500">LUMINAL ERP</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Quản trị xưởng in 3D</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5">
          {menuItems.map((item) => {
            const isActive = pathname === item.path;
            return (
              <Link 
                key={item.path} 
                href={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition duration-200 ${
                  isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <Link href="/" className="flex items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 text-sm font-bold transition">
            <LogOut className="w-4 h-4" /> Thoát hệ thống
          </Link>
        </div>
      </aside>

      {/* Vùng nội dung bên phải */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}