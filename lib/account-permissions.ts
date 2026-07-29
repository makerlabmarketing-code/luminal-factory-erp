export type WorkspaceCode = "STAFF_WORKSPACE" | "ADMIN_WORKSPACE";

export type PermissionCode =
  | "EMPLOYEE_VIEW"
  | "EMPLOYEE_MANAGE"
  | "ACCOUNT_MANAGE"
  | "FINANCE_VIEW"
  | "FINANCE_CREATE"
  | "FINANCE_UPDATE"
  | "FINANCE_DELETE"
  | "FINANCE_APPROVE"
  | "FINANCE_PAY"
  | "PROJECT_VIEW"
  | "PROJECT_MANAGE"
  | "PROJECT_ASSIGN"
  | "PROJECT_REVIEW"
  | "TASK_VIEW"
  | "TASK_MANAGE"
  | "TASK_ASSIGN"
  | "TASK_REVIEW"
  | "REIMBURSEMENT_SUBMIT"
  | "REIMBURSEMENT_REVIEW"
  | "REIMBURSEMENT_APPROVE"
  | "REIMBURSEMENT_MARK_PAID"
  | "ATTENDANCE_VIEW"
  | "ATTENDANCE_MANAGE"
  | "SYSTEM_SETTINGS_VIEW"
  | "SYSTEM_SETTINGS_MANAGE"
  | "EMAIL_TEMPLATE_VIEW"
  | "EMAIL_TEMPLATE_MANAGE";

export type PermissionEffect = "ALLOW" | "DENY";
export type PermissionEditorState = PermissionEffect | "NONE";

export type AccountPresetCode =
  | "ADMINISTRATOR"
  | "HR_MANAGER"
  | "PROJECT_MANAGER"
  | "CREATIVE_LEAD"
  | "STAFF"
  | "CUSTOM";

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

export const PERMISSION_MANAGEMENT_PATH = "/admin/accounts";

export const ALL_PERMISSION_CODES: PermissionCode[] = [
  "EMPLOYEE_VIEW",
  "EMPLOYEE_MANAGE",
  "ACCOUNT_MANAGE",
  "FINANCE_VIEW",
  "FINANCE_CREATE",
  "FINANCE_UPDATE",
  "FINANCE_DELETE",
  "PROJECT_VIEW",
  "PROJECT_MANAGE",
  "PROJECT_ASSIGN",
  "PROJECT_REVIEW",
  "TASK_VIEW",
  "TASK_MANAGE",
  "TASK_ASSIGN",
  "TASK_REVIEW",
  "REIMBURSEMENT_SUBMIT",
  "REIMBURSEMENT_REVIEW",
  "REIMBURSEMENT_APPROVE",
  "REIMBURSEMENT_MARK_PAID",
  "ATTENDANCE_VIEW",
  "ATTENDANCE_MANAGE",
  "SYSTEM_SETTINGS_VIEW",
  "SYSTEM_SETTINGS_MANAGE",
  "EMAIL_TEMPLATE_VIEW",
  "EMAIL_TEMPLATE_MANAGE",
];

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    label: "Nhân sự",
    permissions: [
      { code: "EMPLOYEE_VIEW", label: "Xem hồ sơ nhân sự" },
      { code: "EMPLOYEE_MANAGE", label: "Quản lý hồ sơ nhân sự" },
    ],
  },
  {
    label: "Tài chính",
    permissions: [
      { code: "FINANCE_VIEW", label: "Xem sổ thu chi" },
      { code: "FINANCE_CREATE", label: "Tạo khoản thu chi" },
      { code: "FINANCE_UPDATE", label: "Cập nhật khoản thu chi" },
      { code: "FINANCE_DELETE", label: "Hủy hoặc xóa khoản thu chi theo chính sách" },
      { code: "FINANCE_APPROVE", label: "Duyệt hoàn ứng" },
      { code: "FINANCE_PAY", label: "Xác nhận thanh toán hoàn ứng" },
    ],
  },
  {
    label: "Dự án & công việc",
    permissions: [
      { code: "PROJECT_VIEW", label: "Xem dự án" },
      { code: "PROJECT_MANAGE", label: "Quản lý dự án" },
      { code: "PROJECT_ASSIGN", label: "Giao việc dự án" },
      { code: "PROJECT_REVIEW", label: "Duyệt công việc dự án" },
    ],
  },
  {
    label: "Dự án & công việc",
    permissions: [
      { code: "TASK_VIEW", label: "Xem công việc" },
      { code: "TASK_MANAGE", label: "Quản lý nội dung công việc" },
      { code: "TASK_ASSIGN", label: "Giao người phụ trách công việc" },
      { code: "TASK_REVIEW", label: "Duyệt kết quả công việc" },
    ],
  },
  {
    label: "Hoàn trả",
    permissions: [
      { code: "REIMBURSEMENT_SUBMIT", label: "Gửi đề nghị hoàn trả" },
      { code: "REIMBURSEMENT_REVIEW", label: "Rà soát đề nghị hoàn trả" },
      { code: "REIMBURSEMENT_APPROVE", label: "Duyệt đề nghị hoàn trả" },
      { code: "REIMBURSEMENT_MARK_PAID", label: "Xác nhận đã thanh toán hoàn trả" },
    ],
  },
  {
    label: "Chấm công",
    permissions: [
      { code: "ATTENDANCE_VIEW", label: "Xem dữ liệu chấm công" },
      { code: "ATTENDANCE_MANAGE", label: "Quản lý chấm công" },
    ],
  },
  {
    label: "Danh mục hệ thống",
    permissions: [
      { code: "SYSTEM_SETTINGS_VIEW", label: "Xem cài đặt hệ thống" },
      { code: "SYSTEM_SETTINGS_MANAGE", label: "Quản lý cài đặt hệ thống" },
    ],
  },
  {
    label: "Mẫu email",
    permissions: [
      { code: "EMAIL_TEMPLATE_VIEW", label: "Xem mẫu email" },
      { code: "EMAIL_TEMPLATE_MANAGE", label: "Quản lý mẫu email" },
    ],
  },
  {
    label: "Tài khoản & phân quyền",
    permissions: [
      { code: "ACCOUNT_MANAGE", label: "Quản lý tài khoản và quyền truy cập" },
    ],
  },
];

export function getPermissionPresentation(code: string): { group: string; label: string; code: string } {
  for (const group of PERMISSION_GROUPS) {
    const permission = group.permissions.find((item) => item.code === code);
    if (permission) return { group: group.label, label: permission.label, code };
  }
  return { group: "Danh mục hệ thống", label: "Quyền hệ thống chưa đặt tên", code };
}

const hrManagerPermissions: PermissionCode[] = [
  "EMPLOYEE_VIEW",
  "EMPLOYEE_MANAGE",
  "ACCOUNT_MANAGE",
  "ATTENDANCE_VIEW",
  "ATTENDANCE_MANAGE",
];

const projectManagerPermissions: PermissionCode[] = [
  "PROJECT_VIEW",
  "PROJECT_MANAGE",
  "PROJECT_ASSIGN",
  "PROJECT_REVIEW",
  "TASK_VIEW",
  "TASK_MANAGE",
  "TASK_ASSIGN",
  "TASK_REVIEW",
];

const creativeLeadPermissions: PermissionCode[] = [
  "PROJECT_VIEW",
  "PROJECT_ASSIGN",
  "PROJECT_REVIEW",
  "TASK_VIEW",
  "TASK_MANAGE",
  "TASK_ASSIGN",
  "TASK_REVIEW",
];

const staffPermissions: PermissionCode[] = [
  "TASK_VIEW",
  "REIMBURSEMENT_SUBMIT",
];

export const ACCOUNT_PRESETS: AccountPreset[] = [
  {
    code: "ADMINISTRATOR",
    label: "Quản trị viên",
    workspaces: ["STAFF_WORKSPACE", "ADMIN_WORKSPACE"],
    permissions: ALL_PERMISSION_CODES,
  },
  {
    code: "HR_MANAGER",
    label: "Nhân sự",
    workspaces: ["STAFF_WORKSPACE", "ADMIN_WORKSPACE"],
    permissions: hrManagerPermissions,
  },
  {
    code: "PROJECT_MANAGER",
    label: "Quản lý dự án",
    workspaces: ["STAFF_WORKSPACE", "ADMIN_WORKSPACE"],
    permissions: projectManagerPermissions,
  },
  {
    code: "CREATIVE_LEAD",
    label: "Trưởng nhóm sáng tạo",
    workspaces: ["STAFF_WORKSPACE", "ADMIN_WORKSPACE"],
    permissions: creativeLeadPermissions,
  },
  {
    code: "STAFF",
    label: "Nhân viên",
    workspaces: ["STAFF_WORKSPACE"],
    permissions: staffPermissions,
  },
  {
    code: "CUSTOM",
    label: "Tùy chỉnh",
    workspaces: [],
    permissions: [],
  },
];

export function getAccountPreset(code: string): AccountPreset | null {
  return ACCOUNT_PRESETS.find((preset) => preset.code === code) || null;
}
