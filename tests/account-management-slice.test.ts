import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ACCOUNT_PRESETS,
  ADMINISTRATOR_PERMISSION_CODES,
  ALL_PERMISSION_CODES,
  PERMISSION_GROUPS,
} from "../lib/account-permissions";

const repositoryRoot = join(__dirname, "..");

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), "utf8");
}

describe("account and permission management slice", () => {
  it("lets administrators view accounts while reserving mutations for the owner", () => {
    const page = source("app/admin/accounts/page.tsx");
    const client = source("app/admin/accounts/AdminAccountsClient.tsx");
    const service = source("services/server/adminAccountManagement.ts");

    expect(page).not.toMatch(/['"]use client['"]/);
    expect(page).toMatch(/getAdminAccountManagementData/);
    expect(client).toMatch(/Tài khoản & quyền truy cập/);
    expect(client).not.toMatch(
      /from\(['"]employee_permissions['"]\)|from\(['"]employee_workspace_access['"]\)|utils\/supabase\/admin|SUPABASE_SECRET_KEY/,
    );
    expect(service).toMatch(/requireWorkspaceAccess\(["']ADMIN_WORKSPACE["']\)/);
    expect(service).toMatch(/requireSystemOwner\(\)/);
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
    expect(administrator?.permissions).toEqual(ADMINISTRATOR_PERMISSION_CODES);
    expect(administrator?.permissions).not.toContain("ACCOUNT_MANAGE");
    expect(staff?.workspaces).toEqual(["STAFF_WORKSPACE"]);
    expect(staff?.permissions).toEqual(["TASK_VIEW", "REIMBURSEMENT_SUBMIT"]);
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
      "Bảng lương",
      "Dự án & công việc",
      "Hoàn trả",
      "Chấm công",
      "Danh mục hệ thống",
      "Mẫu email",
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
    expect(ALL_PERMISSION_CODES).toContain("PHASE_TEMPLATE_MANAGE");
    expect(
      ACCOUNT_PRESETS.find((preset) => preset.code === "PROJECT_MANAGER")
        ?.permissions,
    ).not.toContain("PHASE_TEMPLATE_MANAGE");
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
    expect(detailRoute).toMatch(/loadScopedAccountDetail/);
    expect(detailRoute).toMatch(/requireWorkspaceAccess\(['"]ADMIN_WORKSPACE['"]\)/);
    expect(detailRoute).toMatch(/\.eq\(['"]employee_id['"], employeeIdValue\)/);
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

  it("treats the system owner as protected full access", () => {
    const auth = source("services/server/auth.ts");
    const service = source("services/server/adminAccountManagement.ts");
    const client = source("app/admin/accounts/AdminAccountsClient.tsx");
    const detailRoute = source("app/api/admin/accounts/[employeeId]/route.ts");

    expect(auth).toMatch(/isSystemOwner\(authContext\.employee\)/);
    expect(auth).toMatch(/permissionCodes: requestedCodes/);
    expect(service).toMatch(/isSystemOwner\(employee\).*ALL_PERMISSION_CODES\.length/s);
    expect(service).toMatch(/isSystemOwner\(target\) \? ["']ALLOW["'] : state/);
    expect(client).toMatch(/Chủ hệ thống/);
    expect(client).toMatch(/!account\.isSelf.*!account\.isSystemOwner/s);
    expect(detailRoute).toMatch(/isSystemOwner\(employee\) \? ['"]ALLOW['"] : state/);
  });

  it("only enables permission persistence for an editable changed draft", () => {
    const client = source("app/admin/accounts/AdminAccountsClient.tsx");

    expect(client).toMatch(/canEditPermissionDraft/);
    expect(client).toMatch(/permissionDraftChanged/);
    expect(client).toMatch(/!permissionDraftChanged/);
    expect(client).toMatch(/Chủ hệ thống có toàn quyền/);
    expect(client).toMatch(/accountData\?\.canManagePermissions/);
    expect(client).toMatch(/<details key=\{group\.label\}/);
    expect(client).toMatch(/allowedCount.*group\.permissions\.length/s);
    expect(client).toMatch(/Đã cho phép hết/);
  });

  it("automatically grants the administrator baseline without permission management", () => {
    const service = source("services/server/adminAccountManagement.ts");

    expect(service).toMatch(/if \(adminWorkspace\)[\s\S]*grantWorkspace\(targetEmployeeId, "STAFF_WORKSPACE"/);
    expect(service).toMatch(/ADMINISTRATOR_PERMISSION_CODES\.map/);
    expect(service).toMatch(/setPermissionState\(targetEmployeeId, "ACCOUNT_MANAGE", "NONE"/);
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

  it("shows active employees by default and keeps inactive history discoverable", () => {
    const client = source("app/admin/employees/AdminEmployeesClient.tsx");

    expect(client).toMatch(/useState\('ACTIVE_EMPLOYEES'\)/);
    expect(client).toMatch(/employee\.employmentStatus === 'ACTIVE'/);
    expect(client).toMatch(/Nhân sự ngừng hoạt động/);
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
