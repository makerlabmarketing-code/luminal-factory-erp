// app/staff/layout.tsx
import { NotificationProvider } from '@/component/NotificationContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  return (
    <NotificationProvider workspace="staff">
      <div className="min-h-screen bg-slate-950 text-slate-100">{children}</div>
    </NotificationProvider>
  );
}
