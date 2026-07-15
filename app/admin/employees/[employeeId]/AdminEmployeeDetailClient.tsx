'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BriefcaseBusiness,
  Edit2,
  KeyRound,
  Mail,
  MoreVertical,
  Shield,
  ShieldOff,
  UserRound,
  X,
} from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { useNotification } from '@/component/NotificationContext';
import type { AccountConnectionStatus, EmployeeDetailDto } from '@/services/server/adminEmployeeData';

type DetailTab =
  | 'overview'
  | 'job'
  | 'account'
  | 'projects'
  | 'attendance'
  | 'finance'
  | 'history';

interface ApiActionResponse {
  success?: boolean;
  message?: string;
}

interface EmployeeFormState {
  fullName: string;
  email: string;
  title: string;
  employmentStatus: string;
}

const tabs: Array<{ id: DetailTab; label: string }> = [
  { id: 'overview', label: 'Tổng quan' },
  { id: 'job', label: 'Thông tin công việc' },
  { id: 'account', label: 'Tài khoản & phân quyền' },
  { id: 'projects', label: 'Dự án & công việc' },
  { id: 'attendance', label: 'Lịch làm & chấm công' },
  { id: 'finance', label: 'Tài chính cá nhân' },
  { id: 'history', label: 'Lịch sử thay đổi' },
];

const accountStatusLabels: Record<AccountConnectionStatus, string> = {
  NOT_CONNECTED: 'Chưa kết nối',
  MISSING_EMAIL: 'Thiếu email',
  INVITED: 'Đã gửi lời mời',
  PENDING_PASSWORD: 'Chờ đặt mật khẩu',
  CONNECTED: 'Đã kết nối',
  INVITE_ERROR: 'Lời mời lỗi',
  INVITE_EXPIRED: 'Lời mời hết hạn',
  ACCESS_REVOKED: 'Đã thu hồi quyền',
  LINK_ERROR: 'Lỗi liên kết',
};

const accountStatusClassNames: Record<AccountConnectionStatus, string> = {
  NOT_CONNECTED: 'border-slate-700 bg-slate-950 text-slate-300',
  MISSING_EMAIL: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  INVITED: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  PENDING_PASSWORD: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  CONNECTED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  INVITE_ERROR: 'border-red-500/30 bg-red-500/10 text-red-300',
  INVITE_EXPIRED: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  ACCESS_REVOKED: 'border-slate-600 bg-slate-900 text-slate-400',
  LINK_ERROR: 'border-red-500/30 bg-red-500/10 text-red-300',
};

function Field({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
      <p className="text-[10px] font-bold uppercase text-slate-500">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-100">{value || 'Chưa có'}</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function accountActionFor(employee: EmployeeDetailDto): { label: string; path: string } | null {
  if (employee.accountConnectionStatus === 'NOT_CONNECTED') {
    return { label: 'Gửi lời mời', path: 'invite' };
  }

  if (
    employee.accountConnectionStatus === 'INVITED' ||
    employee.accountConnectionStatus === 'PENDING_PASSWORD' ||
    employee.accountConnectionStatus === 'INVITE_EXPIRED'
  ) {
    return { label: 'Gửi lại lời mời', path: 'resend-invite' };
  }

  if (employee.accountConnectionStatus === 'CONNECTED') {
    return { label: 'Gửi link đặt lại mật khẩu', path: 'send-password-reset' };
  }

  if (employee.accountConnectionStatus === 'ACCESS_REVOKED') {
    return { label: 'Khôi phục quyền', path: 'restore-access' };
  }

  return null;
}

async function parseActionResponse(response: Response): Promise<ApiActionResponse> {
  const payload = (await response.json().catch(() => ({}))) as ApiActionResponse;

  if (!response.ok || payload.success === false) {
    return {
      success: false,
      message: payload.message || 'Không thể thực hiện thao tác.',
    };
  }

  return {
    success: true,
    message: payload.message || 'Đã thực hiện thao tác.',
  };
}

export default function AdminEmployeeDetailClient({
  initialData,
}: {
  initialData: EmployeeDetailDto;
}) {
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [activeTab, setActiveTab] = useState<DetailTab>('overview');
  const [menuOpen, setMenuOpen] = useState(false);
  const [formState, setFormState] = useState<EmployeeFormState | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [activeActionPath, setActiveActionPath] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const accountAction = accountActionFor(initialData);

  const quickEditState = useMemo(
    () => ({
      fullName: initialData.fullName,
      email: initialData.email || '',
      title: initialData.title || '',
      employmentStatus: initialData.employmentStatus || 'ACTIVE',
    }),
    [initialData]
  );

  const refreshPage = () => {
    startTransition(() => router.refresh());
  };

  const runAction = async (actionPath: string, successTitle: string) => {
    if (activeActionPath) return;

    setActiveActionPath(actionPath);
    showGlobalLoading(actionPath.includes('invite') ? 'Đang gửi lời mời...' : 'Đang lưu thay đổi...');

    try {
      const response = await fetch(`/api/admin/employees/${initialData.employeeId}/${actionPath}`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });
      const result = await parseActionResponse(response);

      if (!result.success) {
        showToast('Không thành công', result.message || 'Không thể thực hiện thao tác.', 'error');
        return;
      }

      showToast(successTitle, result.message || 'Đã thực hiện thao tác.', 'success');
      refreshPage();
    } finally {
      setActiveActionPath(null);
      hideGlobalLoading();
    }
  };

  const submitEmployeeForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState || savingEmployee) return;

    setSavingEmployee(true);
    showGlobalLoading('Đang lưu thay đổi...');

    try {
      const response = await fetch(`/api/admin/employees/${initialData.employeeId}`, {
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
        body: JSON.stringify(formState),
      });
      const result = await parseActionResponse(response);

      if (!result.success) {
        showToast('Không thành công', result.message || 'Không thể lưu hồ sơ nhân sự.', 'error');
        return;
      }

      setFormState(null);
      showToast('Đã lưu', result.message || 'Đã lưu hồ sơ nhân sự.', 'success');
      refreshPage();
    } finally {
      setSavingEmployee(false);
      hideGlobalLoading();
    }
  };

  const confirmRevoke = () => {
    showConfirm(
      'Thu hồi quyền truy cập',
      `Bạn có chắc muốn thu hồi quyền truy cập của ${initialData.fullName}?`,
      async () => {
        await runAction('revoke-access', 'Đã thu hồi quyền');
      }
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-lg border border-slate-800 bg-slate-900 p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-3">
              <Link
                href="/admin/employees"
                className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Quay lại danh sách
              </Link>
              <div>
                <h1 className="break-words text-xl font-bold text-slate-50 sm:text-2xl">
                  {initialData.fullName}
                </h1>
                <p className="mt-1 text-sm text-slate-400">{initialData.title || 'Chưa gán chức vụ'}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className={`rounded border px-2.5 py-1 text-[10px] font-bold ${initialData.employmentStatus === 'ACTIVE' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-red-500/30 bg-red-500/10 text-red-300'}`}>
                  {initialData.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'}
                </span>
                <span className={`rounded border px-2.5 py-1 text-[10px] font-bold ${accountStatusClassNames[initialData.accountConnectionStatus]}`}>
                  {accountStatusLabels[initialData.accountConnectionStatus]}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {initialData.capabilities.canEditEmployee && (
                <button
                  type="button"
                  onClick={() => setFormState(quickEditState)}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-blue-300 hover:bg-slate-800"
                >
                  <Edit2 className="h-4 w-4" />
                  Sửa hồ sơ
                </button>
              )}
              {initialData.capabilities.canManageAccount && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((current) => !current)}
                    className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
                  >
                    <MoreVertical className="h-4 w-4" />
                    Tài khoản
                  </button>
                  {menuOpen && (
                    <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-slate-800 bg-slate-950 p-2 text-xs shadow-2xl">
                      {accountAction && (
                        <button
                          type="button"
                          disabled={Boolean(activeActionPath) || isPending}
                          onClick={() => runAction(accountAction.path, 'Đã gửi yêu cầu')}
                          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-bold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {accountAction.path.includes('reset') ? <KeyRound className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                          {activeActionPath === accountAction.path ? 'Đang xử lý...' : accountAction.label}
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={Boolean(activeActionPath) || isPending}
                        onClick={confirmRevoke}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                      >
                        <ShieldOff className="h-4 w-4" />
                        Thu hồi quyền truy cập
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </header>

        <nav className="overflow-x-auto rounded-lg border border-slate-800 bg-slate-900 p-2">
          <div className="flex min-w-max gap-1">
            {tabs.map((tab) => (
              <button
                type="button"
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-3 py-2 text-xs font-bold ${
                  activeTab === tab.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </nav>

        {activeTab === 'overview' && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Họ tên" value={initialData.fullName} />
            <Field label="Email" value={initialData.email} />
            <Field label="Điện thoại" value={initialData.phone} />
            <Field label="Cơ sở" value={initialData.facility} />
            <Field label="Ngày tạo" value={formatDate(initialData.createdAt)} />
            <Field label="Trạng thái" value={initialData.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'} />
          </section>
        )}

        {activeTab === 'job' && (
          <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Chức vụ" value={initialData.title} />
            <Field label="Mức lương theo giờ" value={initialData.hourlyRate} />
            <Field label="Cơ sở làm việc" value={initialData.facility} />
            <Field label="Trạng thái làm việc" value={initialData.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'} />
            <Field label="Vai trò vận hành" value={initialData.projectMemberships[0]?.memberRole || null} />
          </section>
        )}

        {activeTab === 'account' && (
          <section className="space-y-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Trạng thái kết nối" value={accountStatusLabels[initialData.accountConnectionStatus]} />
              <Field label="Staff Workspace" value={initialData.hasStaffWorkspace ? 'Đã cấp' : 'Chưa cấp'} />
              <Field label="Admin Workspace" value={initialData.hasAdminWorkspace ? 'Đã cấp' : 'Chưa cấp'} />
            </div>
            <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Shield className="h-4 w-4 text-blue-300" />
                Quyền hiện tại
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {initialData.permissions.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có quyền riêng.</p>
                ) : (
                  initialData.permissions.map((permission) => (
                    <span
                      key={`${permission.permissionCode}:${permission.effect}`}
                      className="rounded border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] font-bold text-slate-300"
                    >
                      {permission.permissionCode} · {permission.effect}
                    </span>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {activeTab === 'projects' && (
          <ComingSoon icon={<BriefcaseBusiness className="h-5 w-5" />} title="Dự án & công việc" />
        )}
        {activeTab === 'attendance' && (
          <ComingSoon icon={<UserRound className="h-5 w-5" />} title="Lịch làm & chấm công" />
        )}
        {activeTab === 'finance' && <ComingSoon icon={<KeyRound className="h-5 w-5" />} title="Tài chính cá nhân" />}
        {activeTab === 'history' && <ComingSoon icon={<Shield className="h-5 w-5" />} title="Lịch sử thay đổi" />}
      </div>

      {formState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={submitEmployeeForm} className="w-full max-w-lg space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5 text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-bold text-blue-300">Sửa nhanh hồ sơ</h2>
              <button type="button" onClick={() => setFormState(null)} className="text-slate-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Họ tên</span>
              <input className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.fullName} onChange={(event) => setFormState({ ...formState, fullName: event.target.value })} required />
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Email</span>
              <input type="email" className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.email} onChange={(event) => setFormState({ ...formState, email: event.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Chức vụ</span>
              <input className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.title} onChange={(event) => setFormState({ ...formState, title: event.target.value })} />
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Trạng thái</span>
              <select className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.employmentStatus} onChange={(event) => setFormState({ ...formState, employmentStatus: event.target.value })}>
                <option value="ACTIVE">Đang làm</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
            </label>
            <div className="flex gap-2 border-t border-slate-800 pt-3">
              <button type="button" onClick={() => setFormState(null)} className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-3 font-bold text-slate-400 hover:bg-slate-800">Hủy</button>
              <button type="submit" disabled={savingEmployee || isPending} className="flex-1 rounded-lg bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                <span className="inline-flex items-center justify-center gap-2">
                  <ButtonLoadingState loading={savingEmployee || isPending} loadingText="Đang lưu..." idleText="Lưu" />
                </span>
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}

function ComingSoon({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-950 text-slate-400">
        {icon}
      </div>
      <h2 className="mt-4 text-sm font-bold">{title}</h2>
      <p className="mt-2 text-xs text-slate-500">Sắp triển khai.</p>
    </section>
  );
}
