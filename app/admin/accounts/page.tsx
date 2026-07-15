import { AuthFlowError } from '@/services/server/auth';
import { getAdminAccountManagementData } from '@/services/server/adminAccountManagement';
import AdminAccountsClient from './AdminAccountsClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';

function AccountAccessDenied() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-base font-bold text-red-300">Không có quyền truy cập</h1>
        <p className="mt-2 text-xs text-slate-400">
          Bạn cần quyền quản lý tài khoản để mở trang này.
        </p>
      </section>
    </main>
  );
}

function AccountTechnicalError() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <section className="mx-auto max-w-3xl rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h1 className="text-base font-bold text-amber-300">Không thể tải dữ liệu</h1>
        <p className="mt-2 text-xs text-slate-400">
          Hệ thống gặp lỗi khi tải danh sách tài khoản. Vui lòng thử lại sau.
        </p>
      </section>
    </main>
  );
}

export default async function AdminAccountsPage() {
  try {
    const accountData = await getAdminAccountManagementData();

    return <AdminAccountsClient initialData={accountData} />;
  } catch (error) {
    if (error instanceof AuthFlowError && error.status === 403) return <AccountAccessDenied />;

    return <AccountTechnicalError />;
  }
}
