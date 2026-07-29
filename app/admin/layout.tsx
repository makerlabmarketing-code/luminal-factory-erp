// app/admin/layout.tsx
import AdminLoginForm from './AdminLoginForm';
import AdminShell from './AdminShell';
import { NotificationProvider } from '@/component/NotificationContext';
import { canAccessAdmin, canAccessStaff, getServerAdminAuthContext } from '@/services/server/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const authContext = await getServerAdminAuthContext();

  if (!authContext) {
    return <AdminLoginForm message="Vui lòng đăng nhập bằng tài khoản ERP." />;
  }

  const [adminAccess, staffAccess] = await Promise.all([
    canAccessAdmin(authContext),
    canAccessStaff(authContext),
  ]);

  if (!adminAccess.allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-slate-100">
        <div className="max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center shadow-xl">
          <h1 className="text-base font-bold text-white">Tài khoản chưa được cấp quyền truy cập</h1>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Vui lòng liên hệ người quản trị để được cấp quyền vào khu vực quản trị.
          </p>
        </div>
      </div>
    );
  }

  return (
    <NotificationProvider workspace="admin">
      <AdminShell
        canAccessAdmin={adminAccess.allowed}
        canAccessStaff={staffAccess.allowed}
      >
        {children}
      </AdminShell>
    </NotificationProvider>
  );
}
