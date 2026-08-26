import { ERP_UI_TEXT } from "../i18n/vi";

export type AdminNavigationIcon =
  | "dashboard"
  | "projects"
  | "employees"
  | "attendance"
  | "facilities"
  | "accounts"
  | "capital"
  | "payroll"
  | "metadata"
  | "emailTemplates";

export interface AdminNavigationItem {
  name: string;
  path: string;
  icon: AdminNavigationIcon;
  anyPermission?: readonly string[];
}

export interface AdminNavigationGroup {
  groupTitle: string;
  items: readonly AdminNavigationItem[];
}

export const ADMIN_NAVIGATION_GROUPS: readonly AdminNavigationGroup[] = [
  {
    groupTitle: ERP_UI_TEXT.navigation.groups.overview,
    items: [
      {
        name: ERP_UI_TEXT.navigation.items.dashboard,
        path: "/admin/dashboard",
        icon: "dashboard",
      },
    ],
  },
  {
    groupTitle: ERP_UI_TEXT.navigation.groups.projects,
    items: [
      {
        name: ERP_UI_TEXT.navigation.items.projects,
        path: "/admin/projects",
        icon: "projects",
        anyPermission: ["PROJECT_VIEW", "PROJECT_MANAGE"],
      },
    ],
  },
  {
    groupTitle: ERP_UI_TEXT.navigation.groups.people,
    items: [
      {
        name: ERP_UI_TEXT.navigation.items.employees,
        path: "/admin/employees",
        icon: "employees",
        anyPermission: ["EMPLOYEE_VIEW", "EMPLOYEE_MANAGE"],
      },
      {
        name: ERP_UI_TEXT.navigation.items.attendance,
        path: "/admin/attendance",
        icon: "attendance",
        anyPermission: ["ATTENDANCE_VIEW", "ATTENDANCE_MANAGE"],
      },
      {
        name: ERP_UI_TEXT.navigation.items.facilities,
        path: "/admin/facilities",
        icon: "facilities",
        anyPermission: ["SYSTEM_SETTINGS_VIEW", "SYSTEM_SETTINGS_MANAGE", "ATTENDANCE_MANAGE"],
      },
      {
        name: ERP_UI_TEXT.navigation.items.accounts,
        path: "/admin/accounts",
        icon: "accounts",
        anyPermission: ["ACCOUNT_MANAGE"],
      },
    ],
  },
  {
    groupTitle: ERP_UI_TEXT.navigation.groups.finance,
    items: [
      {
        name: ERP_UI_TEXT.navigation.items.capital,
        path: "/admin/capital",
        icon: "capital",
        anyPermission: ["FINANCE_VIEW", "FINANCE_CREATE", "FINANCE_UPDATE"],
      },
      {
        name: ERP_UI_TEXT.navigation.items.payroll,
        path: "/admin/payroll",
        icon: "payroll",
        anyPermission: ["PAYROLL_VIEW", "PAYROLL_SETTLE", "PAYROLL_ADJUST", "PAYROLL_CONFIGURE"],
      },
    ],
  },
  {
    groupTitle: ERP_UI_TEXT.navigation.groups.system,
    items: [
      {
        name: ERP_UI_TEXT.navigation.items.metadata,
        path: "/admin/metadata",
        icon: "metadata",
        anyPermission: ["SYSTEM_SETTINGS_VIEW", "SYSTEM_SETTINGS_MANAGE"],
      },
      {
        name: ERP_UI_TEXT.navigation.items.emailTemplates,
        path: "/admin/email-editor",
        icon: "emailTemplates",
        anyPermission: ["EMAIL_TEMPLATE_VIEW", "EMAIL_TEMPLATE_MANAGE"],
      },
    ],
  },
];

export const ADMIN_NAVIGATION_PERMISSION_CODES = Array.from(
  new Set(
    ADMIN_NAVIGATION_GROUPS.flatMap((group) =>
      group.items.flatMap((item) => item.anyPermission || []),
    ),
  ),
);

export function filterAdminNavigation(
  permissionCodes: readonly string[],
): AdminNavigationGroup[] {
  const permissions = new Set(permissionCodes);

  return ADMIN_NAVIGATION_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) =>
        !item.anyPermission ||
        item.anyPermission.some((permission) => permissions.has(permission)),
    ),
  })).filter((group) => group.items.length > 0);
}

export function isAdminNavigationItemActive(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}

export function findAdminNavigationItem(
  groups: readonly AdminNavigationGroup[],
  pathname: string,
) {
  return groups
    .flatMap((group) => group.items)
    .find((item) => isAdminNavigationItemActive(pathname, item.path));
}
