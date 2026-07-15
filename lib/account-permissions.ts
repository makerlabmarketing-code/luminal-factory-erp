export type WorkspaceCode = 'STAFF_WORKSPACE' | 'ADMIN_WORKSPACE';

export type PermissionCode =
  | 'EMPLOYEE_VIEW'
  | 'EMPLOYEE_MANAGE'
  | 'ACCOUNT_MANAGE'
  | 'FINANCE_VIEW'
  | 'FINANCE_CREATE'
  | 'FINANCE_UPDATE'
  | 'FINANCE_DELETE'
  | 'PROJECT_VIEW'
  | 'PROJECT_MANAGE'
  | 'PROJECT_ASSIGN'
  | 'PROJECT_REVIEW'
  | 'ATTENDANCE_VIEW'
  | 'ATTENDANCE_MANAGE'
  | 'SYSTEM_SETTINGS_VIEW'
  | 'SYSTEM_SETTINGS_MANAGE'
  | 'EMAIL_TEMPLATE_VIEW'
  | 'EMAIL_TEMPLATE_MANAGE';

export type PermissionEffect = 'ALLOW' | 'DENY';
export type PermissionEditorState = PermissionEffect | 'NONE';

export type AccountPresetCode =
  | 'ADMINISTRATOR'
  | 'HR_MANAGER'
  | 'PROJECT_MANAGER'
  | 'CREATIVE_LEAD'
  | 'OPERATIONS'
  | 'STAFF';

export interface AccountPreset {
  code: AccountPresetCode;
  label: string;
  workspaces: WorkspaceCode[];
  permissions: PermissionCode[];
}

export interface PermissionGroup {
  label: string;
  permissions: Array<{
    code: PermissionCode;
    label: string;
  }>;
}

export const ALL_PERMISSION_CODES: PermissionCode[] = [
  'EMPLOYEE_VIEW',
  'EMPLOYEE_MANAGE',
  'ACCOUNT_MANAGE',
  'FINANCE_VIEW',
  'FINANCE_CREATE',
  'FINANCE_UPDATE',
  'FINANCE_DELETE',
  'PROJECT_VIEW',
  'PROJECT_MANAGE',
  'PROJECT_ASSIGN',
  'PROJECT_REVIEW',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_MANAGE',
  'SYSTEM_SETTINGS_VIEW',
  'SYSTEM_SETTINGS_MANAGE',
  'EMAIL_TEMPLATE_VIEW',
  'EMAIL_TEMPLATE_MANAGE',
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: 'Nhân sự',
    permissions: [
      { code: 'EMPLOYEE_VIEW', label: 'Xem nhân sự' },
      { code: 'EMPLOYEE_MANAGE', label: 'Quản lý hồ sơ nhân sự' },
      { code: 'ACCOUNT_MANAGE', label: 'Quản lý tài khoản' },
    ],
  },
  {
    label: 'Tài chính',
    permissions: [
      { code: 'FINANCE_VIEW', label: 'Xem tài chính' },
      { code: 'FINANCE_CREATE', label: 'Tạo bản ghi tài chính' },
      { code: 'FINANCE_UPDATE', label: 'Cập nhật tài chính' },
      { code: 'FINANCE_DELETE', label: 'Xóa tài chính' },
    ],
  },
  {
    label: 'Dự án',
    permissions: [
      { code: 'PROJECT_VIEW', label: 'Xem dự án' },
      { code: 'PROJECT_MANAGE', label: 'Quản lý dự án' },
      { code: 'PROJECT_ASSIGN', label: 'Giao việc dự án' },
      { code: 'PROJECT_REVIEW', label: 'Duyệt công việc dự án' },
    ],
  },
  {
    label: 'Chấm công',
    permissions: [
      { code: 'ATTENDANCE_VIEW', label: 'Xem chấm công' },
      { code: 'ATTENDANCE_MANAGE', label: 'Quản lý chấm công' },
    ],
  },
  {
    label: 'Hệ thống',
    permissions: [
      { code: 'SYSTEM_SETTINGS_VIEW', label: 'Xem cài đặt hệ thống' },
      { code: 'SYSTEM_SETTINGS_MANAGE', label: 'Quản lý cài đặt hệ thống' },
      { code: 'EMAIL_TEMPLATE_VIEW', label: 'Xem mẫu email' },
      { code: 'EMAIL_TEMPLATE_MANAGE', label: 'Quản lý mẫu email' },
    ],
  },
];

const hrManagerPermissions: PermissionCode[] = [
  'EMPLOYEE_VIEW',
  'EMPLOYEE_MANAGE',
  'ACCOUNT_MANAGE',
  'ATTENDANCE_VIEW',
  'ATTENDANCE_MANAGE',
  'PROJECT_VIEW',
  'FINANCE_VIEW',
  'FINANCE_CREATE',
  'FINANCE_UPDATE',
];

const projectManagerPermissions: PermissionCode[] = [
  'EMPLOYEE_VIEW',
  'PROJECT_VIEW',
  'PROJECT_MANAGE',
  'PROJECT_ASSIGN',
  'PROJECT_REVIEW',
  'FINANCE_VIEW',
  'FINANCE_CREATE',
  'FINANCE_UPDATE',
];

export const ACCOUNT_PRESETS: AccountPreset[] = [
  {
    code: 'ADMINISTRATOR',
    label: 'Quản trị viên',
    workspaces: ['STAFF_WORKSPACE', 'ADMIN_WORKSPACE'],
    permissions: ALL_PERMISSION_CODES,
  },
  {
    code: 'HR_MANAGER',
    label: 'Quản lý nhân sự',
    workspaces: ['STAFF_WORKSPACE', 'ADMIN_WORKSPACE'],
    permissions: hrManagerPermissions,
  },
  {
    code: 'PROJECT_MANAGER',
    label: 'Quản lý dự án',
    workspaces: ['STAFF_WORKSPACE', 'ADMIN_WORKSPACE'],
    permissions: projectManagerPermissions,
  },
  {
    code: 'CREATIVE_LEAD',
    label: 'Creative Lead',
    workspaces: ['STAFF_WORKSPACE', 'ADMIN_WORKSPACE'],
    permissions: projectManagerPermissions,
  },
  {
    code: 'OPERATIONS',
    label: 'Vận hành',
    workspaces: ['STAFF_WORKSPACE', 'ADMIN_WORKSPACE'],
    permissions: [
      'EMPLOYEE_VIEW',
      'PROJECT_VIEW',
      'FINANCE_VIEW',
      'FINANCE_CREATE',
      'FINANCE_UPDATE',
    ],
  },
  {
    code: 'STAFF',
    label: 'Nhân viên',
    workspaces: ['STAFF_WORKSPACE'],
    permissions: [],
  },
];

export function getAccountPreset(code: string): AccountPreset | null {
  return ACCOUNT_PRESETS.find((preset) => preset.code === code) || null;
}
