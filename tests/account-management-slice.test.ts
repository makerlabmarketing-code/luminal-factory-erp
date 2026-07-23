import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNT_PRESETS,
  ALL_PERMISSION_CODES,
  PERMISSION_GROUPS,
} from "../lib/account-permissions";

const repositoryRoot = join(__dirname, "..");

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

describe("account and permission management slice", () => {
  it("serves the accounts page through a server DTO and ACCOUNT_MANAGE gate", () => {
    const page = source("app/admin/accounts/page.tsx");
    const client = source("app/admin/accounts/AdminAccountsClient.tsx");
    const service = source("services/server/adminAccountManagement.ts");

    expect(page).not.toMatch(/['"]use client['"]/);
    expect(page).toMatch(/getAdminAccountManagementData/);
    expect(client).toMatch(/Tài khoản & quyền truy cập/);
    expect(client).not.toMatch(
      /from\(['"]employee_permissions['"]\)|from\(['"]employee_workspace_access['"]\)|utils\/supabase\/admin|SUPABASE_SECRET_KEY/,
    );
    expect(service).toMatch(
      /requireAdminEmployeePermission\([\"\']ACCOUNT_MANAGE[\"\']\)/,
    );
    expect(service).toMatch(/createSupabaseAdminClient/);
  });

  it("defines the requested permission presets in application code", () => {
    const administrator = ACCOUNT_PRESETS.find(
      (preset) => preset.code === "ADMINISTRATOR",
    );
    const staff = ACCOUNT_PRESETS.find((preset) => preset.code === "STAFF");

    expect(administrator?.workspaces).toEqual([
      "STAFF_WORKSPACE",
      "ADMIN_WORKSPACE",
    ]);
    expect(administrator?.permissions).toEqual(ALL_PERMISSION_CODES);
    expect(staff?.workspaces).toEqual(["STAFF_WORKSPACE"]);
    expect(staff?.permissions).toEqual(["TASK_VIEW", "REIMBURSEMENT_SUBMIT"]);
    expect(
      ACCOUNT_PRESETS.find((preset) => preset.code === "HR_MANAGER")
        ?.permissions,
    ).not.toContain("FINANCE_VIEW");
    expect(
      ACCOUNT_PRESETS.find((preset) => preset.code === "PROJECT_MANAGER")
        ?.permissions,
    ).not.toContain("EMPLOYEE_VIEW");
    expect(
      ACCOUNT_PRESETS.find((preset) => preset.code === "CREATIVE_LEAD")
        ?.permissions,
    ).not.toContain("PROJECT_MANAGE");
    expect(
      ACCOUNT_PRESETS.find((preset) => preset.code === "CREATIVE_LEAD")
        ?.permissions,
    ).toEqual(
      expect.arrayContaining([
        "TASK_VIEW",
        "TASK_MANAGE",
        "TASK_ASSIGN",
        "TASK_REVIEW",
      ]),
    );
    expect(ACCOUNT_PRESETS.map((preset) => preset.code)).toEqual([
      "ADMINISTRATOR",
      "HR_MANAGER",
      "PROJECT_MANAGER",
      "CREATIVE_LEAD",
      "STAFF",
      "CUSTOM",
    ]);
  });

  it("groups permissions for the editor", () => {
    expect(PERMISSION_GROUPS.map((group) => group.label)).toEqual([
      "Nhân sự",
      "Tài chính",
      "Dự án",
      "Công việc",
      "Hoàn trả",
      "Chấm công",
      "Hệ thống",
    ]);
  });

  it("keeps the canonical permission registry complete and duplicate-free", () => {
    const approvedKeys = [
      "TASK_VIEW",
      "TASK_MANAGE",
      "TASK_ASSIGN",
      "TASK_REVIEW",
      "REIMBURSEMENT_SUBMIT",
      "REIMBURSEMENT_REVIEW",
      "REIMBURSEMENT_APPROVE",
      "REIMBURSEMENT_MARK_PAID",
    ];

    expect(ALL_PERMISSION_CODES).toEqual(expect.arrayContaining(approvedKeys));
    expect(new Set(ALL_PERMISSION_CODES).size).toBe(
      ALL_PERMISSION_CODES.length,
    );

    const groupedCodes = PERMISSION_GROUPS.flatMap((group) =>
      group.permissions.map((permission) => permission.code),
    );
    expect(groupedCodes).toEqual(expect.arrayContaining(approvedKeys));
    expect(new Set(groupedCodes).size).toBe(groupedCodes.length);
    expect(PERMISSION_GROUPS.flatMap((group) => group.permissions)).toEqual(
      expect.arrayContaining(
        approvedKeys.map((code) =>
          expect.objectContaining({ code, label: expect.any(String) }),
        ),
      ),
    );
  });

  it("implements the requested account API contract", () => {
    const listRoute = source("app/api/admin/accounts/route.ts");
    const detailRoute = source("app/api/admin/accounts/[employeeId]/route.ts");
    const workspaceRoute = source(
      "app/api/admin/accounts/[employeeId]/workspaces/route.ts",
    );
    const permissionRoute = source(
      "app/api/admin/accounts/[employeeId]/permissions/route.ts",
    );
    const presetRoute = source(
      "app/api/admin/accounts/[employeeId]/apply-preset/route.ts",
    );
    const revokeRoute = source(
      "app/api/admin/accounts/[employeeId]/revoke-access/route.ts",
    );

    expect(listRoute).toMatch(/getAdminAccountManagementData/);
    expect(detailRoute).toMatch(/getAdminAccountDetailData/);
    expect(workspaceRoute).toMatch(/updateAccountWorkspaces/);
    expect(permissionRoute).toMatch(/updateAccountPermissions/);
    expect(presetRoute).toMatch(/applyAccountPreset/);
    expect(revokeRoute).toMatch(/revokeAccountAccess/);
    expect(
      `${workspaceRoute}${permissionRoute}${presetRoute}${revokeRoute}`,
    ).not.toMatch(/actor|role|is_admin/);
  });

  it("keeps account mutation safety guards in the server service", () => {
    const service = source("services/server/adminAccountManagement.ts");

    expect(service).toMatch(/assertCanMutateTarget/);
    expect(service).toMatch(/Chủ sở hữu hệ thống/);
    expect(service).toMatch(/tự thay đổi quyền truy cập/);
    expect(service).toMatch(/unknownKeys/);
    expect(service).toMatch(/Không có thay đổi quyền nào để lưu/);
    expect(service).toMatch(/assertNotRemovingLastAdministrator/);
    expect(service).toMatch(/Không thể xóa quản trị viên cuối cùng/);
    expect(service).toMatch(/permissionStateFor/);
    expect(service).toMatch(/effect === ["\']DENY["\']/);
    expect(service).toMatch(/effect === ["\']ALLOW["\']/);
    expect(service).toMatch(/granted_by_employee_id/);
    expect(service).toMatch(/revoked_at/);
    expect(service).not.toMatch(/delete\(\)/);
  });

  it("collapses duplicate active workspace and permission rows before reporting success", () => {
    const service = source("services/server/adminAccountManagement.ts");

    expect(service).toMatch(
      /activeRows[\s\S]*\.slice\(1\)[\s\S]*\.flatMap\(\(row\) => \(row\.id/,
    );
    expect(service).toMatch(
      /from\(["']employee_workspace_access["']\)[\s\S]*duplicateRevokeError[\s\S]*\.in\(["']id["'], duplicateIds\)/,
    );
    expect(service).toMatch(
      /from\(["']employee_permissions["']\)[\s\S]*duplicateRevokeError[\s\S]*\.in\(["']id["'], duplicateIds\)/,
    );
  });

  it("does not expose privileged credentials or browser Supabase mutations", () => {
    const client = source("app/admin/accounts/AdminAccountsClient.tsx");
    const adminClient = source("utils/supabase/admin.ts");

    expect(adminClient).toMatch(/import 'server-only'/);
    expect(client).not.toMatch(
      /SUPABASE_SECRET_KEY|createSupabaseAdminClient|createBrowserClient|\.from\(/,
    );
  });
});

it("keeps preset changes separate from workspace grants", () => {
  const service = source("services/server/adminAccountManagement.ts");

  const applyPresetBody = service.slice(
    service.indexOf("export async function applyAccountPreset"),
    service.indexOf("export async function revokeAccountAccess"),
  );
  expect(applyPresetBody).not.toMatch(/grantWorkspace\(/);
  expect(applyPresetBody).not.toMatch(
    /revokeWorkspace\(targetEmployeeId, "STAFF_WORKSPACE"/,
  );
  expect(applyPresetBody).toMatch(/setPermissionState/);
});

it("documents the live approval boundary for task permission catalog expansion", () => {
  const handoff = source(
    "docs/corrective-slice-5-account-permissions-handoff.md",
  );
  const forward = source(
    "supabase/drafts/20260722_corrective_slice_5_permission_catalog_forward.sql",
  );

  expect(handoff).toMatch(/LIVE_APPROVAL_REQUIRED/);
  expect(forward).toMatch(/TASK_VIEW/);
  expect(forward).toMatch(/TASK_MANAGE/);
  expect(forward).toMatch(/TASK_ASSIGN/);
  expect(forward).toMatch(/TASK_REVIEW/);
});

it("validates live catalog rollout without time-window loopholes", () => {
  const validation = source(
    "supabase/drafts/20260722_corrective_slice_5_permission_catalog_validation.sql",
  );

  expect(validation).toMatch(
    /canonical application contract matches live catalog/,
  );
  expect(validation).toMatch(/no unknown duplicate key exists/);
  expect(validation).toMatch(
    /permission_code in \(select code from approved_keys\)/,
  );
  expect(validation).not.toMatch(/created_at\s*>=\s*statement_timestamp\(\)/);
});
