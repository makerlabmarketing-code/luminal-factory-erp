'use client';

import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import {
  Edit3,
  KeyRound,
  Mail,
  Search,
  ShieldCheck,
  ShieldOff,
  X,
} from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { useNotification } from '@/component/NotificationContext';
import type {
  AdminAccountDetailDto,
  AdminAccountListItem,
  AdminAccountManagementData,
} from '@/services/server/adminAccountManagement';
import {
  PERMISSION_GROUPS,
  type AccountPresetCode,
  type PermissionCode,
  type PermissionEditorState,
} from '@/lib/account-permissions';

interface ApiActionResponse {
  success?: boolean;
  message?: string;
}

type AccountConnectionStatus = AdminAccountListItem['accountConnectionStatus'];

const accountStatusLabels: Record<AccountConnectionStatus, string> = {
  NOT_CONNECTED: 'Chưa kết nối',
  MISSING_EMAIL: 'Thiếu email',
  INVITED: 'Đã gửi lời mời',
  PENDING_PASSWORD: 'Chờ đặt mật khẩu',
  CONNECTED: 'Đã kết nối',
  ACCESS_REVOKED: 'Đã thu hồi',
  LINK_ERROR: 'Lỗi liên kết',
};

const presetLabels: Record<AdminAccountListItem['presetCode'], string> = {
  ADMINISTRATOR: 'Quản trị viên',
  HR_MANAGER: 'Quản lý nhân sự',
  PROJECT_MANAGER: 'Quản lý dự án',
  CREATIVE_LEAD: 'Creative Lead',
  OPERATIONS: 'Vận hành',
  STAFF: 'Nhân viên',
  CUSTOM: 'Tùy chỉnh',
  NONE: 'Chưa cấp',
};

const accessStatusLabels: Record<AdminAccountListItem['accessStatus'], string> = {
  ACTIVE: 'Đang cấp quyền',
  REVOKED: 'Đã thu hồi',
  NO_ACCESS: 'Chưa cấp quyền',
};

function workspaceBadge(active: boolean, label: string) {
  return (
    <span
      className={`rounded border px-2 py-1 text-[10px] font-bold ${
        active
          ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
          : 'border-slate-700 bg-slate-950 text-slate-500'
      }`}
    >
      {label}
    </span>
  );
}

function accountActionFor(account: AdminAccountListItem): { label: string; path: string } | null {
  if (account.accountConnectionStatus === 'NOT_CONNECTED') {
    return { label: 'Mời sử dụng hệ thống', path: `employees/${account.employeeId}/invite` };
  }

  if (
    account.accountConnectionStatus === 'INVITED' ||
    account.accountConnectionStatus === 'PENDING_PASSWORD'
  ) {
    return { label: 'Gửi lại lời mời', path: `employees/${account.employeeId}/resend-invite` };
  }

  if (account.accountConnectionStatus === 'CONNECTED') {
    return {
      label: 'Gửi link đặt lại mật khẩu',
      path: `employees/${account.employeeId}/send-password-reset`,
    };
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

function permissionStateClass(state: PermissionEditorState) {
  if (state === 'ALLOW') return 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300';
  if (state === 'DENY') return 'border-red-500/40 bg-red-500/10 text-red-300';

  return 'border-slate-700 bg-slate-950 text-slate-400';
}

export default function AdminAccountsClient({
  initialData,
}: {
  initialData: AdminAccountManagementData;
}) {
  const { showToast, showConfirm } = useNotification();
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeActionKey, setActiveActionKey] = useState<string | null>(null);
  const [editorAccount, setEditorAccount] = useState<AdminAccountDetailDto | null>(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<AccountPresetCode>('STAFF');
  const [permissionDraft, setPermissionDraft] = useState<Record<PermissionCode, PermissionEditorState> | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredAccounts = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return initialData.accounts;

    return initialData.accounts.filter(
      (account) =>
        account.fullName.toLowerCase().includes(query) ||
        (account.email || '').toLowerCase().includes(query)
    );
  }, [initialData.accounts, searchTerm]);

  const refreshPage = () => {
    startTransition(() => window.location.reload());
  };

  const runAction = async (
    key: string,
    path: string,
    options: RequestInit,
    successTitle: string
  ) => {
    if (activeActionKey) return;
    setActiveActionKey(key);
    showGlobalLoading('Đang lưu thay đổi...');

    try {
      const response = await fetch(path, {
        ...options,
        headers: {
          Accept: 'application/json',
          ...(options.body ? { 'Content-Type': 'application/json' } : {}),
          ...options.headers,
        },
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

  const openPermissionEditor = async (account: AdminAccountListItem) => {
    setEditorLoading(true);
    setEditorAccount(null);
    setPermissionDraft(null);
    setSelectedPreset(
      account.presetCode === 'CUSTOM' || account.presetCode === 'NONE' ? 'STAFF' : account.presetCode
    );

    try {
      const response = await fetch(`/api/admin/accounts/${account.employeeId}`, {
        headers: { Accept: 'application/json' },
        credentials: 'include',
        cache: 'no-store',
      });
      const detail = (await response.json()) as AdminAccountDetailDto & ApiActionResponse;
      if (!response.ok || detail.success === false) {
        showToast('Không thành công', detail.message || 'Không thể tải permission.', 'error');
        return;
      }

      setEditorAccount(detail);
      setPermissionDraft(
        Object.fromEntries(detail.permissions.map((permission) => [permission.code, permission.state])) as Record<
          PermissionCode,
          PermissionEditorState
        >
      );
    } finally {
      setEditorLoading(false);
    }
  };

  const applyPreset = () => {
    if (!editorAccount) return;

    runAction(
      `${editorAccount.employeeId}:preset`,
      `/api/admin/accounts/${editorAccount.employeeId}/apply-preset`,
      {
        method: 'POST',
        body: JSON.stringify({ presetCode: selectedPreset }),
      },
      'Đã áp dụng preset'
    );
  };

  const savePermissions = () => {
    if (!editorAccount || !permissionDraft) return;

    runAction(
      `${editorAccount.employeeId}:permissions`,
      `/api/admin/accounts/${editorAccount.employeeId}/permissions`,
      {
        method: 'PUT',
        body: JSON.stringify({ permissions: permissionDraft }),
      },
      'Đã cập nhật permissions'
    );
  };

  const updateWorkspace = (account: AdminAccountListItem, workspace: 'staff' | 'admin', enabled: boolean) => {
    const staffWorkspace = workspace === 'staff' ? enabled : account.hasStaffWorkspace;
    const adminWorkspace = workspace === 'admin' ? enabled : account.hasAdminWorkspace;

    runAction(
      `${account.employeeId}:workspace:${workspace}:${enabled}`,
      `/api/admin/accounts/${account.employeeId}/workspaces`,
      {
        method: 'PUT',
        body: JSON.stringify({ staffWorkspace, adminWorkspace }),
      },
      'Đã cập nhật workspace'
    );
  };

  const revokeAll = (account: AdminAccountListItem) => {
    showConfirm(
      'Thu hồi toàn bộ quyền truy cập',
      `Bạn có chắc muốn thu hồi toàn bộ quyền truy cập của ${account.fullName}?`,
      async () => {
        await runAction(
          `${account.employeeId}:revoke-all`,
          `/api/admin/accounts/${account.employeeId}/revoke-access`,
          { method: 'POST' },
          'Đã thu hồi quyền'
        );
      }
    );
  };

  return (
    <main className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-base font-bold">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
              Quản lý tài khoản & phân quyền
            </h1>
            <p className="mt-1 text-xs text-slate-500">
              Cấp workspace, preset và permission theo từng nhân sự.
            </p>
          </div>
          <div className="relative sm:w-80">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm tên hoặc email..."
              className="w-full rounded-lg border border-slate-800 bg-slate-900 py-2.5 pl-9 pr-4 text-xs outline-none"
            />
          </div>
        </header>

        <section className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
          <div className="border-b border-slate-800 bg-slate-950/40 px-5 py-3 text-xs font-bold text-slate-400">
            Danh sách tài khoản ({filteredAccounts.length})
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-left text-xs">
              <thead className="border-b border-slate-800 bg-slate-950 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="p-4">Nhân sự</th>
                  <th className="p-4">Nhân sự</th>
                  <th className="p-4">Auth</th>
                  <th className="p-4">Workspace</th>
                  <th className="p-4">Preset</th>
                  <th className="p-4">Permission</th>
                  <th className="p-4">Truy cập</th>
                  <th className="p-4 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-500">
                      Không tìm thấy tài khoản phù hợp.
                    </td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => {
                    const accountAction = accountActionFor(account);
                    return (
                      <tr key={account.employeeId} className="hover:bg-slate-950/30">
                        <td className="p-4">
                          <Link
                            href={`/admin/employees/${account.employeeId}`}
                            className="font-bold text-slate-100 hover:text-blue-300"
                          >
                            {account.fullName}
                          </Link>
                          <p className="mt-1 font-mono text-[10px] text-slate-500">
                            {account.email || 'Chưa có email'}
                          </p>
                        </td>
                        <td className="p-4">
                          <span
                            className={`rounded px-2 py-1 text-[10px] font-bold ${
                              account.employmentStatus === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-300'
                                : 'bg-red-500/10 text-red-300'
                            }`}
                          >
                            {account.employmentStatus === 'ACTIVE' ? 'Đang làm' : 'Ngừng hoạt động'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-300">{accountStatusLabels[account.accountConnectionStatus]}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-2">
                            {workspaceBadge(account.hasStaffWorkspace, 'Staff')}
                            {workspaceBadge(account.hasAdminWorkspace, 'Admin')}
                          </div>
                        </td>
                        <td className="p-4 text-slate-300">{presetLabels[account.presetCode]}</td>
                        <td className="p-4 text-slate-300">{account.activePermissionCount}</td>
                        <td className="p-4 text-slate-300">{accessStatusLabels[account.accessStatus]}</td>
                        <td className="p-4">
                          <div className="flex flex-wrap justify-end gap-2">
                            {accountAction && (
                              <button
                                type="button"
                                disabled={Boolean(activeActionKey) || isPending}
                                onClick={() =>
                                  runAction(
                                    `${account.employeeId}:auth`,
                                    `/api/admin/${accountAction.path}`,
                                    { method: 'POST' },
                                    'Đã gửi yêu cầu'
                                  )
                                }
                                className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                              >
                                {accountAction.path.includes('reset') ? <KeyRound className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                                {activeActionKey === `${account.employeeId}:auth` ? 'Đang gửi...' : accountAction.label}
                              </button>
                            )}
                            <button
                              type="button"
                              disabled={Boolean(activeActionKey) || isPending}
                              onClick={() => updateWorkspace(account, 'staff', !account.hasStaffWorkspace)}
                              className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-emerald-300 hover:bg-slate-800 disabled:opacity-50"
                            >
                              {account.hasStaffWorkspace ? 'Thu hồi Staff' : 'Cấp Staff'}
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(activeActionKey) || isPending}
                              onClick={() => updateWorkspace(account, 'admin', !account.hasAdminWorkspace)}
                              className="rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-blue-300 hover:bg-slate-800 disabled:opacity-50"
                            >
                              {account.hasAdminWorkspace ? 'Thu hồi Admin' : 'Cấp Admin'}
                            </button>
                            <button
                              type="button"
                              disabled={editorLoading || Boolean(activeActionKey)}
                              onClick={() => openPermissionEditor(account)}
                              className="inline-flex items-center gap-1 rounded-md border border-slate-800 bg-slate-950 px-2.5 py-1.5 text-[10px] font-bold text-slate-300 hover:bg-slate-800 disabled:opacity-50"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                              Cập nhật permissions
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(activeActionKey) || isPending}
                              onClick={() => revokeAll(account)}
                              className="inline-flex items-center gap-1 rounded-md border border-red-900/50 bg-red-950/20 px-2.5 py-1.5 text-[10px] font-bold text-red-300 hover:bg-red-950/40 disabled:opacity-50"
                            >
                              <ShieldOff className="h-3.5 w-3.5" />
                              Thu hồi toàn bộ
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {(editorLoading || editorAccount) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <section className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-5 text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-bold text-blue-300">Cập nhật permissions</h2>
                <p className="mt-1 text-slate-500">
                  {editorAccount?.fullName || 'Đang tải dữ liệu'}
                </p>
              </div>
              <button type="button" onClick={() => setEditorAccount(null)} className="text-slate-500 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {editorLoading && (
              <div className="space-y-2 py-6">
                <div className="h-10 animate-pulse rounded bg-slate-800" />
                <div className="h-32 animate-pulse rounded bg-slate-800" />
              </div>
            )}

            {editorAccount && permissionDraft && (
              <div className="space-y-5 pt-4">
                <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                  <label className="block space-y-2">
                    <span className="font-bold text-slate-300">Permission preset</span>
                    <select
                      value={selectedPreset}
                      onChange={(event) => setSelectedPreset(event.target.value as AccountPresetCode)}
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 p-2.5 outline-none"
                    >
                      {initialData.presets.map((preset) => (
                        <option key={preset.code} value={preset.code}>
                          {preset.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={Boolean(activeActionKey)}
                    onClick={applyPreset}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ButtonLoadingState
                      loading={activeActionKey === `${editorAccount.employeeId}:preset`}
                      loadingText="Đang áp dụng..."
                      idleText="Áp dụng preset"
                    />
                  </button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.label} className="rounded-lg border border-slate-800 bg-slate-950/40 p-4">
                      <h3 className="font-bold text-slate-200">{group.label}</h3>
                      <div className="mt-3 space-y-3">
                        {group.permissions.map((permission) => {
                          const state = permissionDraft[permission.code];
                          return (
                            <div key={permission.code} className="rounded border border-slate-800 bg-slate-950 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div>
                                  <p className="font-bold text-slate-200">{permission.label}</p>
                                  <p className="mt-1 font-mono text-[10px] text-slate-500">{permission.code}</p>
                                </div>
                                <span className={`rounded border px-2 py-1 text-[10px] font-bold ${permissionStateClass(state)}`}>
                                  {state === 'ALLOW' ? 'ALLOW' : state === 'DENY' ? 'DENY' : 'INHERITED'}
                                </span>
                              </div>
                              <div className="mt-3 flex gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPermissionDraft({
                                      ...permissionDraft,
                                      [permission.code]: state === 'ALLOW' ? 'NONE' : 'ALLOW',
                                    })
                                  }
                                  className={`flex-1 rounded-md border px-3 py-2 font-bold ${
                                    state === 'ALLOW'
                                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  ALLOW
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPermissionDraft({
                                      ...permissionDraft,
                                      [permission.code]: state === 'DENY' ? 'NONE' : 'DENY',
                                    })
                                  }
                                  className={`flex-1 rounded-md border px-3 py-2 font-bold ${
                                    state === 'DENY'
                                      ? 'border-red-500 bg-red-500/10 text-red-300'
                                      : 'border-slate-700 text-slate-400 hover:bg-slate-800'
                                  }`}
                                >
                                  DENY
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex flex-col gap-2 border-t border-slate-800 pt-4 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => setEditorAccount(null)}
                    className="flex-1 rounded-lg border border-slate-800 bg-slate-950 p-3 font-bold text-slate-400 hover:bg-slate-800"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={Boolean(activeActionKey)}
                    onClick={savePermissions}
                    className="flex-1 rounded-lg bg-blue-600 p-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    <ButtonLoadingState
                      loading={activeActionKey === `${editorAccount.employeeId}:permissions`}
                      loadingText="Đang lưu..."
                      idleText="Lưu permissions"
                    />
                  </button>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
