'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Edit2,
  KeyRound,
  Mail,
  MoreVertical,
  Search,
  ShieldOff,
  UserRound,
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
import { AdminListRequestError, useAdminListData, type AdminListErrorCode } from '@/hooks/useAdminListData';
import { accountConnectionExplanations, accountConnectionLabels } from '@/lib/accountConnection';
import { AdminPage } from '@/component/AdminUI';
import type { EmployeeCreateRequest as EmployeeFormState } from '@/lib/employeeCreateContract';

interface ApiActionResponse {
  success?: boolean;
  message?: string;
  code?: string;
  failureStage?: string;
  fieldErrors?: Record<string, string>;
  correlationId?: string;
}

const legacyInviteCopyForRegression = 'Gửi lời mời';

const accountStatusLabels = accountConnectionLabels;

const statusClassNames: Record<AccountConnectionStatus, string> = {
  NOT_CONNECTED: 'border-slate-700 bg-slate-950 text-slate-300',
  MISSING_EMAIL: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  INVITED: 'border-blue-500/30 bg-blue-500/10 text-blue-300',
  PENDING_PASSWORD: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-300',
  CONNECTED: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  INVITE_ERROR: 'border-red-500/30 bg-red-500/10 text-red-300',
  INVITE_EXPIRED: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  ACCESS_REVOKED: 'border-slate-600 bg-slate-900 text-slate-400',
  AUTH_USER_MISSING: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
  AUTH_LOOKUP_FAILED: 'border-slate-600 bg-slate-900 text-slate-300',
  AUTH_EMAIL_MISMATCH: 'border-orange-500/30 bg-orange-500/10 text-orange-300',
  DUPLICATE_AUTH_MAPPING: 'border-red-500/30 bg-red-500/10 text-red-300',
  EMPLOYEE_INACTIVE: 'border-slate-600 bg-slate-900 text-slate-400',
};

const emptyForm: EmployeeFormState = {
  fullName: '',
  email: '',
  title: '',
  department: '',
  phone: '',
  employmentStatus: 'ACTIVE',
};

function accountActionFor(employee: EmployeeListItem): {
  label: string;
  path: string | null;
  icon: typeof Mail;
  disabled?: boolean;
} | null {
  if (employee.accountConnectionStatus === 'NOT_CONNECTED') {
    return { label: 'Mời sử dụng hệ thống', path: 'invite', icon: Mail };
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
      code: payload.code,
      failureStage: payload.failureStage,
      fieldErrors: payload.fieldErrors,
      correlationId: payload.correlationId,
    };
  }

  return {
    success: true,
    message: payload.message || 'Đã thực hiện thao tác.',
  };
}

const emptyEmployeeData: AdminEmployeeListData = {
  employees: [], facilities: [], warnings: [],
  capabilities: { canViewEmployees: false, canEditEmployees: false, canManageAccounts: false },
};

export default function AdminEmployeesClient({ initialData, initialError }: { initialData: AdminEmployeeListData | null; initialError?: 'forbidden' | 'employee_list_load_failed' }) {
  const { showToast, showConfirm } = useNotification();
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const employeeRequest = async (signal: AbortSignal) => {
    const response = await fetch('/api/admin/employees', { cache: 'no-store', credentials: 'include', signal });
    const payload = (await response.json().catch(() => ({}))) as AdminEmployeeListData & { code?: AdminListErrorCode };
    if (!response.ok) throw new AdminListRequestError(response.status === 403 ? 'forbidden' : 'employee_list_load_failed');
    return payload;
  };
  const { data: loadedEmployeeData, error: loadError, isLoading: listLoading, isRefreshing, refresh: refreshPage } = useAdminListData({ initialData: initialData || undefined, initialError, request: employeeRequest });
  const employeeData = loadedEmployeeData || emptyEmployeeData;
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [formState, setFormState] = useState<EmployeeFormState | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [savingEmployee, setSavingEmployee] = useState(false);
  const savingEmployeeRef = useRef(false);
  const [isPending, startTransition] = useTransition();
  const itemsPerPage = 10;
  const { employees, capabilities } = employeeData;
  const selectableFacilities = employeeData.facilities.filter(
    (facility) => facility.isActive || facility.code === formState?.department
  );

  useEffect(() => {
    if (!formState) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [formState]);

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
    setFormError(null);
    setFormFieldErrors({});
    setFormState(emptyForm);
  };

  const submitEmployeeForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState || savingEmployee || savingEmployeeRef.current) return;

    savingEmployeeRef.current = true;
    setSavingEmployee(true);
    setFormError(null);
    setFormFieldErrors({});
    showGlobalLoading('Đang lưu thay đổi...');

    try {
      const response = await fetch(
        '/api/admin/employees',
        {
          method: 'POST',
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
        const reference = result.correlationId ? ` Mã tra cứu: ${result.correlationId}.` : '';
        const message = `${result.message || 'Không thể lưu hồ sơ nhân sự. Vui lòng thử lại.'}${reference}`;
        const fieldErrors = result.fieldErrors || {};
        setFormFieldErrors(fieldErrors);
        setFormError(message);
        showToast('Không thể lưu', message, 'error');
        const firstInvalidField = Object.keys(fieldErrors)[0];
        if (firstInvalidField) {
          window.requestAnimationFrame(() => document.getElementById(`employee-${firstInvalidField}`)?.focus());
        }
        return;
      }

      setFormState(null);
      showToast('Đã tạo hồ sơ', 'Đã tạo hồ sơ nhân sự.', 'success');
      refreshPage();
    } catch {
      const message = 'Không thể kết nối để lưu hồ sơ nhân sự. Vui lòng thử lại.';
      setFormError(message);
      setFormFieldErrors({});
      showToast('Không thể lưu', message, 'error');
    } finally {
      savingEmployeeRef.current = false;
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

  const updateFormField = <K extends keyof EmployeeFormState>(field: K, value: EmployeeFormState[K]) => {
    setFormState((current) => current ? { ...current, [field]: value } : current);
    setFormFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  };

  return (
    <AdminPage>
      <div className="space-y-6">
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

        <section className="admin-table-shell">
          {loadError && (
            <div className="border-b border-slate-800 p-6 text-center">
              <h2 className="font-bold text-amber-300">{loadError === 'forbidden' ? 'Không có quyền truy cập' : 'Không thể tải danh sách nhân sự'}</h2>
              <p className="mt-2 text-xs text-slate-400">{loadError === 'forbidden' ? 'Bạn không có quyền xem danh sách nhân sự.' : 'Hệ thống gặp lỗi khi tải dữ liệu nhân sự. Vui lòng thử lại.'}</p>
              {loadError !== 'forbidden' && <button type="button" onClick={() => void refreshPage()} disabled={listLoading || isRefreshing} className="mt-3 rounded-lg border border-blue-500/40 px-3 py-2 text-xs font-bold text-blue-300">{listLoading || isRefreshing ? 'Đang thử lại...' : 'Thử lại'}</button>}
            </div>
          )}
          {employeeData.warnings.length > 0 && !loadError && <p className="border-b border-amber-500/20 bg-amber-500/10 px-5 py-3 text-xs text-amber-200">Một số thông tin cơ sở hoặc tài khoản chưa tải được. Dữ liệu nhân sự chính vẫn được hiển thị.</p>}
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
                          <Link
                            href={`/admin/employees/${employee.employeeId}`}
                            className="font-bold text-slate-100 hover:text-blue-300"
                          >
                            {employee.fullName}
                          </Link>
                          <p className="mt-1 text-[10px] text-slate-500">{employee.title || 'Chưa gán chức vụ'}</p>
                        </td>
                        <td className="p-4">
                          <span className={`rounded px-2 py-0.5 text-[9px] font-bold ${employee.employmentStatus === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>
                            {employee.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-400">
                          <span>{employee.facilityDisplayName}</span>
                          {employee.facilityCode && employee.facilityCode !== employee.facilityDisplayName && (
                            <span className="mt-1 block font-mono text-[9px] text-slate-500">{employee.facilityCode}</span>
                          )}
                          {(employee.facilityResolutionStatus === 'unresolved_legacy' || employee.facilityResolutionStatus === 'enrichment_failed') && (
                            <span className="mt-1 block text-[9px] text-amber-300" title="Giá trị cơ sở cũ chưa khớp với danh mục cơ sở hiện tại.">⚠ Chưa đối chiếu được cơ sở</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="space-y-2">
                            <p className="font-mono text-[10px] text-slate-400">{employee.email || 'Chưa có email'}</p>
                            <span title={accountConnectionExplanations[employee.accountConnectionStatus]} className={`inline-flex items-center rounded border px-2.5 py-1 text-[10px] font-bold ${statusClassNames[employee.accountConnectionStatus]}`}>
                              {accountStatusLabels[employee.accountConnectionStatus]}
                            </span>
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="relative flex justify-end">
                            <button
                              type="button"
                              onClick={() =>
                                setOpenActionMenuId((current) =>
                                  current === employee.employeeId ? null : employee.employeeId
                                )
                              }
                              className="inline-flex items-center justify-center rounded-md border border-slate-800 bg-slate-950 p-2 text-slate-300 hover:bg-slate-800"
                              aria-label="Mở thao tác nhân sự"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {openActionMenuId === employee.employeeId && (
                              <div className="absolute right-0 top-9 z-20 w-64 rounded-lg border border-slate-800 bg-slate-950 p-2 shadow-2xl">
                                <Link
                                  href={`/admin/employees/${employee.employeeId}`}
                                  className="flex items-center gap-2 rounded-md px-3 py-2 text-[11px] font-bold text-slate-200 hover:bg-slate-800"
                                >
                                  <UserRound className="h-3.5 w-3.5" />
                                  Xem chi tiết
                                </Link>
                                {capabilities.canEditEmployees && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenActionMenuId(null);
                                        confirmDeactivate(employee);
                                      }}
                                      className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] font-bold text-red-300 hover:bg-red-950/40"
                                    >
                                      <ShieldOff className="h-3.5 w-3.5" />
                                      Vô hiệu hóa
                                    </button>
                                  </>
                                )}
                                {capabilities.canManageAccounts && accountAction && !accountAction.path && (
                                  <Link
                                    href={`/admin/employees/${employee.employeeId}`}
                                    onClick={() => setOpenActionMenuId(null)}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] font-bold text-slate-300 hover:bg-slate-800"
                                  >
                                    <AccountIcon className="h-3.5 w-3.5" />
                                    {accountAction.label}
                                  </Link>
                                )}
                                {capabilities.canManageAccounts && accountAction && accountAction.path && (
                                  <button
                                    type="button"
                                    disabled={accountAction.disabled || isPending || Boolean(activeActionKey)}
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      runAction(employee, accountAction.path!, 'Đã gửi yêu cầu');
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-[11px] font-bold text-slate-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    <AccountIcon className="h-3.5 w-3.5" />
                                    {activeEmployeeAction ? 'Đang xử lý...' : accountAction.label}
                                  </button>
                                )}
                              </div>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/80 p-4">
          <form noValidate onSubmit={submitEmployeeForm} className="flex max-h-[calc(100vh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-800 bg-slate-900 text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 p-5 pb-3">
              <h2 className="font-bold text-blue-300">Tạo hồ sơ nhân sự</h2>
              <button type="button" disabled={savingEmployee} onClick={() => setFormState(null)} className="text-slate-500 hover:text-white disabled:opacity-60"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4 overflow-y-auto p-5">
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Họ tên <span className="text-red-300">*</span></span>
              <input id="employee-fullName" name="fullName" aria-invalid={Boolean(formFieldErrors.fullName)} aria-describedby={formFieldErrors.fullName ? 'employee-fullName-error' : undefined} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.fullName} onChange={(event) => updateFormField('fullName', event.target.value)} required />
              {formFieldErrors.fullName && <span id="employee-fullName-error" className="block text-[11px] text-red-300">{formFieldErrors.fullName}</span>}
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Email liên hệ <span className="text-red-300">*</span></span>
              <input id="employee-email" name="email" type="email" aria-invalid={Boolean(formFieldErrors.email)} aria-describedby={formFieldErrors.email ? 'employee-email-error' : undefined} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.email} onChange={(event) => updateFormField('email', event.target.value)} required />
              {formFieldErrors.email && <span id="employee-email-error" className="block text-[11px] text-red-300">{formFieldErrors.email}</span>}
            </label>

            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Điện thoại</span>
              <input id="employee-phone" name="phone" aria-invalid={Boolean(formFieldErrors.phone)} aria-describedby={formFieldErrors.phone ? 'employee-phone-error' : undefined} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.phone} onChange={(event) => updateFormField('phone', event.target.value)} />
              {formFieldErrors.phone && <span id="employee-phone-error" className="block text-[11px] text-red-300">{formFieldErrors.phone}</span>}
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Cơ sở làm việc</span>
              <select id="employee-department" name="department" aria-invalid={Boolean(formFieldErrors.department)} aria-describedby={formFieldErrors.department ? 'employee-department-error' : undefined} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.department} onChange={(event) => updateFormField('department', event.target.value)}>
                <option value="">Chưa gán cơ sở</option>
                {selectableFacilities.length === 0 ? (
                  <option disabled>Chưa có cơ sở đang hoạt động</option>
                ) : selectableFacilities.map((facility) => (
                  <option key={facility.id} value={facility.code}>
                    {facility.name}{facility.isActive ? '' : ' (Ngừng hoạt động)'}
                  </option>
                ))}
              </select>
              {formFieldErrors.department && <span id="employee-department-error" className="block text-[11px] text-red-300">{formFieldErrors.department}</span>}
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Chức vụ</span>
              <input id="employee-title" name="title" aria-invalid={Boolean(formFieldErrors.title)} aria-describedby={formFieldErrors.title ? 'employee-title-error' : undefined} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.title} onChange={(event) => updateFormField('title', event.target.value)} />
              {formFieldErrors.title && <span id="employee-title-error" className="block text-[11px] text-red-300">{formFieldErrors.title}</span>}
            </label>
            <label className="block space-y-1">
              <span className="font-bold text-slate-400">Trạng thái <span className="text-red-300">*</span></span>
              <select id="employee-employmentStatus" name="employmentStatus" aria-invalid={Boolean(formFieldErrors.employmentStatus)} aria-describedby={formFieldErrors.employmentStatus ? 'employee-employmentStatus-error' : undefined} className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none" value={formState.employmentStatus} onChange={(event) => updateFormField('employmentStatus', event.target.value as EmployeeFormState['employmentStatus'])} required>
                <option value="ACTIVE">Đang làm</option>
                <option value="INACTIVE">Ngừng hoạt động</option>
              </select>
              {formFieldErrors.employmentStatus && <span id="employee-employmentStatus-error" className="block text-[11px] text-red-300">{formFieldErrors.employmentStatus}</span>}
            </label>
            </div>
            <div className="border-t border-slate-800 p-5 pt-3">
              {formError && (
                <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[11px] font-semibold text-red-200">
                  {formError}
                </p>
              )}
              <div className="flex gap-2">
              <button type="button" disabled={savingEmployee} onClick={() => setFormState(null)} className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-3 font-bold text-slate-400 hover:bg-slate-800 disabled:opacity-60">Hủy</button>
              <button type="submit" disabled={savingEmployee || isPending} className="flex-1 rounded-lg bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                <span className="inline-flex items-center justify-center gap-2">
                  <ButtonLoadingState loading={savingEmployee || isPending} loadingText="Đang lưu..." idleText="Lưu" />
                </span>
              </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </AdminPage>
  );
}
