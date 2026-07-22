import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { canProjectRolePerformPhaseAction } from "../services/server/phaseAuthorizationCore";
import {
  canProjectMembershipPerformAction,
  capabilitiesForProjectRole,
  GLOBAL_PROJECT_VIEW_CAPABILITIES,
} from "../services/server/projectMembershipAuthorizationCore";

const root = process.cwd();
const source = (path: string) => readFileSync(join(root, path), "utf8");

describe("Corrective Slice 1 project and workspace authorization contracts", () => {
  it("allows System Owner to use protected global project and phase access without self-revoking owner semantics", () => {
    const phaseAuth = source("services/server/phaseAuthorization.ts");
    const projectAuth = source(
      "services/server/projectMembershipAuthorization.ts",
    );
    const accountManagement = source(
      "services/server/adminAccountManagement.ts",
    );

    expect(phaseAuth).toMatch(/hasAdminAccess\(authContext\.employee\)/);
    expect(projectAuth).toMatch(/hasAdminAccess\(authContext\.employee\)/);
    expect(accountManagement).toMatch(/assertNotRemovingLastAdministrator/);
  });

  it("allows Application Admin read access through ADMIN_WORKSPACE plus PROJECT_VIEW without granting mutation capabilities", () => {
    const phaseAuth = source("services/server/phaseAuthorization.ts");
    const projectAuth = source(
      "services/server/projectMembershipAuthorization.ts",
    );

    expect(phaseAuth).toMatch(/action === 'PHASE_VIEW'/);
    expect(phaseAuth).toMatch(/hasPermission\(authContext, 'PROJECT_VIEW'\)/);
    expect(projectAuth).toMatch(/hasGlobalProjectView/);
    expect(GLOBAL_PROJECT_VIEW_CAPABILITIES).toEqual({
      canViewProject: true,
      canEditProject: false,
      canManageMembers: false,
      canManagePhases: false,
      canManageTasks: false,
      canCancelProject: false,
    });
  });

  it("keeps Project Manager access membership-scoped when no global admin project permission exists", () => {
    expect(
      canProjectRolePerformPhaseAction("PROJECT_MANAGER", "PHASE_VIEW"),
    ).toBe(true);
    expect(
      canProjectRolePerformPhaseAction("PROJECT_MANAGER", "PHASE_EDIT"),
    ).toBe(true);
    expect(
      canProjectMembershipPerformAction("PROJECT_MANAGER", "PROJECT_EDIT"),
    ).toBe(true);
    expect(canProjectMembershipPerformAction(null, "PROJECT_EDIT")).toBe(false);
  });

  it("keeps Creative Lead and Staff-style contributors view-only at the project membership boundary", () => {
    expect(
      canProjectRolePerformPhaseAction("CREATIVE_LEAD", "PHASE_VIEW"),
    ).toBe(true);
    expect(
      canProjectRolePerformPhaseAction("CREATIVE_LEAD", "PHASE_EDIT"),
    ).toBe(false);
    expect(canProjectRolePerformPhaseAction("CONTRIBUTOR", "PHASE_VIEW")).toBe(
      true,
    );
    expect(
      canProjectRolePerformPhaseAction("CONTRIBUTOR", "PHASE_ASSIGN"),
    ).toBe(false);
    expect(capabilitiesForProjectRole("CONTRIBUTOR").canViewProject).toBe(true);
    expect(capabilitiesForProjectRole("CONTRIBUTOR").canManageTasks).toBe(
      false,
    );
  });

  it("denies unauthorized project and phase access", () => {
    expect(canProjectMembershipPerformAction(null, "PROJECT_VIEW")).toBe(false);
    expect(canProjectMembershipPerformAction(null, "TASK_MANAGE")).toBe(false);
  });

  it("preserves loaded project data when phase loading fails and records a sanitized phase failure", () => {
    const workflowService = source("services/workflowService.ts");
    const repository = source("services/repositories/workflowRepository.ts");

    expect(workflowService).toMatch(/toProjectPlaceholderSetting/);
    expect(workflowService).toMatch(/phase_load_error_code/);
    expect(workflowService).toMatch(/phase_load_failure_stage/);
    expect(workflowService).toMatch(/Không thể tải giai đoạn\./);
    expect(repository).toMatch(/failureStage/);
    expect(repository).toMatch(/failure_stage/);
  });

  it("does not expose raw database errors from phase loading route responses", () => {
    const phaseRoute = source("app/api/admin/phases/route.ts");

    expect(phaseRoute).toMatch(/code: error\.code/);
    expect(phaseRoute).toMatch(/failure_stage: error\.failureStage/);
    expect(phaseRoute).not.toMatch(
      /supabase_error_message|supabase_error_hint|supabase_error_details/,
    );
  });

  it("keeps Staff Workspace and Admin Workspace independent without deleting Auth accounts", () => {
    const accountManagement = source(
      "services/server/adminAccountManagement.ts",
    );
    const accountClient = source("app/admin/accounts/AdminAccountsClient.tsx");

    expect(accountManagement).toMatch(
      /if \(staffWorkspace\)\s+await grantWorkspace\(\s+targetEmployeeId,\s+["']STAFF_WORKSPACE["']/,
    );
    expect(accountManagement).toMatch(
      /else await revokeWorkspace\(targetEmployeeId, ["']STAFF_WORKSPACE["']\)/,
    );
    expect(accountManagement).toMatch(
      /if \(adminWorkspace\)\s+await grantWorkspace\(\s+targetEmployeeId,\s+["']ADMIN_WORKSPACE["']/,
    );
    expect(accountManagement).toMatch(
      /else await revokeWorkspace\(targetEmployeeId, ["']ADMIN_WORKSPACE["']\)/,
    );
    expect(accountManagement).not.toMatch(/deleteUser|admin\.delete/);
    expect(accountClient).toMatch(
      /Cấp Staff Workspace|Thu hồi Staff Workspace/,
    );
    expect(accountClient).toMatch(
      /Cấp Admin Workspace|Thu hồi Admin Workspace/,
    );
    expect(accountClient).toMatch(/Thu hồi toàn bộ truy cập/);
  });
});
