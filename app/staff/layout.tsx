// app/staff/layout.tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ListTodo, History, UserCircle, QrCode } from 'lucide-react';

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const navs = [
    { name: 'Nhiệm vụ', path: '/staff/tasks', icon: ListTodo },
    { name: 'Lịch sử', path: '/staff/history', icon: History },
    { name: 'Cá nhân', path: '/staff/profile', icon: UserCircle },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Vùng nội dung Mobile */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* Thanh Bottom Navigation cố định dưới điện thoại */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 px-6 py-3 flex justify-between items-center z-50 shadow-2xl">
        {navs.map((nav) => {
          const isActive = pathname === nav.path;
          return (
            <Link 
              key={nav.path} 
              href={nav.path} 
              className={`flex flex-col items-center gap-1 transition ${isActive ? 'text-blue-500' : 'text-slate-500'}`}
            >
              <nav.icon className={`w-5 h-5 ${isActive ? 'stroke-[3px]' : 'stroke-[2px]'}`} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">{nav.name}</span>
            </Link>
          );
        })}
        {/* Nút Scan nhanh ở giữa (Giả lập) */}
        <Link href="/" className="bg-blue-600 p-3 rounded-full -mt-10 border-4 border-slate-950 shadow-xl">
          <QrCode className="w-6 h-6 text-white" />
        </Link>
      </nav>
    </div>
  );
}