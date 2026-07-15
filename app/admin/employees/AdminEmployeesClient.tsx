'use client';

import { FormEvent, useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit2,
  KeyRound,
  Mail,
  Search,
  ShieldOff,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { useNotification } from '@/component/NotificationContext';
import type {
  AccountConnectionStatus,
  AdminEmployeeListData,
  EmployeeListItem,
} from '@/services/server/adminEmployeeData';

interface EmployeeFormState {
  employeeId: string | null;
  fullName: string;
  email: string;
  title: string;
  employmentStatus: string;
}

interface ApiActionResponse {
  success?: boolean;
  message?: string;
}

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

const statusClassNames: Record<AccountConnectionStatus, string> = {
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

const emptyForm: EmployeeFormState = {
  employeeId: null,
  fullName: '',
  email: '',
  title: '',
  employmentStatus: 'ACTIVE',
};

function accountActionFor(employee: EmployeeListItem): {
  label: string;
  path: string | null;
  icon: typeof Mail;
  disabled?: boolean;
} | null {
  if (employee.accountConnectionStatus === 'NOT_CONNECTED') {
    return { label: 'Gửi lời mời', path: 'invite', icon: Mail };
  }

  if (employee.accountConnectionStatus === 'MISSING_EMAIL') {
    return { label: 'Cập nhật email', path: null, icon: Edit2, disabled: true };
  }

  if (
    employee.accountConnectionStatus === 'INVITED' ||
    employee.accountConnectionStatus === 'PENDING_PASSWORD' ||
    employee.accountConnectionStatus === 'INVITE_EXPIRED'
  ) {
    return { label: 'Gửi lại lời mời', path: 'resend-invite', icon: Mail };
  }

  if (employee.accountConnectionStatus === 'CONNECTED') {
    return { label: 'Gửi link đặt lại mật khẩu', path: 'send-password-reset', icon: KeyRound };
  }

  if (employee.accountConnectionStatus === 'ACCESS_REVOKED') {
    return { label: 'Khôi phục quyền', path: 'restore-access', icon: ShieldOff };
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

export default function AdminEmployeesClient({ initialData }: { initialData: AdminEmployeeListData }) {
  const { showToast, showConfirm } = useNotification();
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [formState, setFormState] = useState<EmployeeFormState | null>(null);
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [isPending, startTransition] = useTransition();
  const itemsPerPage = 10;
  const { employees, capabilities } = initialData;

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return employees.filter((employee) => {
      const matchesText =
        !query ||
        employee.fullName.toLowerCase().includes(query) ||
        (employee.title || '').toLowerCase().includes(query) ||
        (employee.email || '').toLowerCase().includes(query);
      const matchesStatus =
        statusFilter === 'ALL' || employee.accountConnectionStatus === statusFilter;

      return matchesText && matchesStatus;
    });
  }, [employees, searchTerm, statusFilter]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1;
  const currentData = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const refreshPage = () => {
    startTransition(() => {
      router.refresh();
    });
  };

  const runAction = async (employee: EmployeeListItem, actionPath: string, successTitle: string) => {
    const actionKey = `${employee.employeeId}:${actionPath}`;
    if (activeActionKey) return;

    setActiveActionKey(actionKey);
    showGlobalLoading(actionPath.includes('invite') ? 'Đang gửi lời mời...' : 'Đang lưu thay đổi...');

    try {
      const response = await fetch(`/api/admin/employees/${employee.employeeId}/${actionPath}`, {
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
      setActiveActionKey(null);
      hideGlobalLoading();
    }
  };

  const openCreateForm = () => {
    setFormState(emptyForm);
  };

  const openEditForm = (employee: EmployeeListItem) => {
    setFormState({
      employeeId: employee.employeeId,
      fullName: employee.fullName,
      email: employee.email || '',
      title: employee.title || '',
      employmentStatus: employee.employmentStatus || 'ACTIVE',
    });
  };

  const submitEmployeeForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState || savingEmployee) return;

    setSavingEmployee(true);
    showGlobalLoading('Đang lưu thay đổi...');

    try {
      const response = await fetch(
        formState.employeeId ? `/api/admin/employees/${formState.employeeId}` : '/api/admin/employees',
        {
          method: formState.employeeId ? 'PATCH' : 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify(formState),
        }
      );
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

  const confirmDeactivate = (employee: EmployeeListItem) => {
    showConfirm(
      'Vô hiệu hóa nhân sự',
      `Bạn có chắc muốn vô hiệu hóa hồ sơ ${employee.fullName}?`,
      async () => {
        await runAction(employee, 'deactivate', 'Đã vô hiệu hóa');
      }
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-base font-bold">
              <Users className="h-5 w-5 text-blue-400" />
              Hồ sơ nhân sự
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Danh sách hiển thị theo quyền Employee View.
            </p>
          </div>
          {capabilities.canEditEmployees && (
            <button
              type="button"
              onClick={openCreateForm}
              className="flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700"
            >
              <UserPlus className="h-4 w-4" />
              Tạo nhân sự
            </button>
          )}
        </div>

        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-950/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="text-xs font-bold uppercase text-slate-400">
              Danh sách nhân sự ({filtered.length})
            </span>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300 outline-none"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">Tất cả tài khoản</option>
                {Object.entries(accountStatusLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <div className="relative sm:w-72">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Tìm tên, email, chức vụ..."
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-2 pl-9 pr-4 text-xs text-slate-200 outline-none"
                  value={searchTerm}
                  onChange={(event) => {
                    setSearchTerm(event.target.value);
                    setCurrentPage(1);
                  }}
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="p-4">Nhân sự</th>
                  <th className="p-4">Trạng thái</th>
                  <th className="p-4">Cơ sở</th>
                  <th className="p-4">Tài khoản hệ thống</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-[11px]">
                {currentData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      Không tìm thấy dữ liệu nhân sự.
                    </td>
                  </tr>
                ) : (
                  currentData.map((employee) => {
                    const AccountIcon = accountActionFor(employee)?.icon || Mail;
                    const accountAction = accountActionFor(employee);
                    const activeEmployeeAction =
                      accountAction?.path && activeActionKey === `${employee.employeeId}:${accountAction.path}`;

                    return (
                      <tr key={employee.employeeId} className="hover:bg-slate-950/30">
                        <td className="p-4">
                          <p className="font-bold text-slate-100">{employee.fullName}</p>
                          <p className="mt-1 text-[10px] text-slate-500">{employee.title || 'Chưa gán chức vụ'}</p>
                        </td>
                        <td className="p-4">
                          <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${employee.employmentStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                            {employee.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">{employee.facilityName || 'Chưa gán'}</td>
                        <td className="p-4">
                          <div className="space-y-2">
                            <p className="font-mono text-[10px] text-slate-400">{employee.email || 'Chưa có email'}</p>
                            <span className={`inline-flex items-center rounded border px-2.5 py-1 text-[10px] font-bold ${statusClassNames[employee.accountConnectionStatus]}`}>
                              {accountStatusLabels[employee.accountConnectionStatus]}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {capabilities.canEditEmployees && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openEditForm(employee)}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-blue-300 hover:bg-slate-800"
                                >
                                  <Edit2 className="h-3.5 w-3.5" />
                                  Sửa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => confirmDeactivate(employee)}
                                  className="inline-flex items-center gap-1 rounded-md border border-red-900/50 bg-red-950/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-950/40"
                                >
                                  <ShieldOff className="h-3.5 w-3.5" />
                                  Vô hiệu hóa
                                </button>
                              </>
                            )}
                            {capabilities.canManageAccounts && accountAction && (
                              <button
                                type="button"
                                disabled={!accountAction.path || accountAction.disabled || isPending || Boolean(activeActionKey)}
                                onClick={() => {
                                  if (!accountAction.path) {
                                    if (employee.accountConnectionStatus === 'MISSING_EMAIL') openEditForm(employee);
                                    return;
                                  }
                                  runAction(employee, accountAction.path, 'Đã gửi yêu cầu');
                                }}
                                className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <AccountIcon className="h-3.5 w-3.5" />
                                {activeEmployeeAction ? 'Đang xử lý...' : accountAction.label}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/50 p-4 text-xs text-slate-400">
              <div>
                Tổng <span className="font-bold text-blue-300">{filtered.length}</span> hồ sơ
              </div>
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="rounded border border-slate-800 bg-slate-900 p-1.5 disabled:opacity-30"><ChevronsLeft className="h-4 w-4" /></button>
                <button type="button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1} className="rounded border border-slate-800 bg-slate-900 p-1.5 disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                <span className="px-2 font-bold text-slate-200">{currentPage} / {totalPages}</span>
                <button type="button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages} className="rounded border border-slate-800 bg-slate-900 p-1.5 disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                <button type="button" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="rounded border border-slate-800 bg-slate-900 p-1.5 disabled:opacity-30"><ChevronsRight className="h-4 w-4" /></button>
              </div>
            </div>
          )}
        </section>
      </div>

      {formState && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <form onSubmit={submitEmployeeForm} className="w-full max-w-lg space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5 text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="font-bold text-blue-300">{formState.employeeId ? 'Sửa hồ sơ nhân sự' : 'Tạo hồ sơ nhân sự'}</h2>
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
    </div>
  );
}
