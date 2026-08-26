import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ADMIN_NAVIGATION_PERMISSION_CODES,
  filterAdminNavigation,
} from "../lib/navigation/admin";

const root = join(__dirname, "..");
const source = (relativePath: string) =>
  readFileSync(join(root, relativePath), "utf8");

describe("bounded SaaS UI foundation", () => {
  it("keeps navigation permission-aware and preserves a safe dashboard fallback", () => {
    const dashboardOnly = filterAdminNavigation([]);
    expect(dashboardOnly.flatMap((group) => group.items.map((item) => item.path))).toEqual([
      "/admin/dashboard",
    ]);

    const projectNavigation = filterAdminNavigation(["PROJECT_VIEW"]);
    expect(projectNavigation.flatMap((group) => group.items.map((item) => item.path))).toContain(
      "/admin/projects",
    );
    expect(projectNavigation.flatMap((group) => group.items.map((item) => item.path))).not.toContain(
      "/admin/employees",
    );
    expect(ADMIN_NAVIGATION_PERMISSION_CODES).toContain("ACCOUNT_MANAGE");
  });

  it("derives shell permissions on the server with explicit deny precedence", () => {
    const layout = source("app/admin/layout.tsx");
    const auth = source("services/server/auth.ts");
    const shell = source("app/admin/AdminShell.tsx");

    expect(layout).toMatch(/listGrantedPermissions/);
    expect(layout).toMatch(/permissionCodes=\{permissionCodes\}/);
    expect(auth).toMatch(/select\('permission_code, effect, status, revoked_at'\)/);
    expect(auth).toMatch(/const denied = activeRows\.some/);
    expect(auth).toMatch(/return !denied && allowed/);
    expect(shell).toMatch(/filterAdminNavigation\(permissionCodes\)/);
    expect(shell).not.toMatch(/createClient|supabase|localStorage|sessionStorage/);
  });

  it("extracts one reusable shell with Vietnamese navigation and an authorized command menu", () => {
    const shell = source("component/app-shell/AdminAppShell.tsx");
    const vocabulary = source("lib/i18n/vi.ts");
    const globals = source("app/globals.css");
    const tailwind = source("tailwind.config.ts");

    expect(shell).toMatch(/function AppSidebar/);
    expect(shell).toMatch(/function AppHeader/);
    expect(shell).toMatch(/export function MainContent/);
    expect(shell).toMatch(/function GlobalCommandMenu/);
    expect(shell).toMatch(/aria-keyshortcuts="Control\+K Meta\+K"/);
    expect(shell).toMatch(/groups\s*\.flatMap/);
    expect(vocabulary).toContain("Tìm trong các trang bạn được phép truy cập.");
    expect(globals).toMatch(/--admin-canvas/);
    expect(globals).toMatch(/--admin-surface/);
    expect(tailwind).toContain("./component/**/*.{js,ts,jsx,tsx,mdx}");
  });

  it("does not change runtime flags or introduce a parallel component dependency", () => {
    const packageJson = source("package.json");
    const shell = source("component/app-shell/AdminAppShell.tsx");

    expect(packageJson).not.toMatch(/@radix-ui|shadcn|class-variance-authority/);
    expect(shell).not.toMatch(/PHASE_TEMPLATES_ENABLED|PAYROLL_SETTLEMENT_ENABLED|ATTENDANCE_RECOVERY_ENABLED/);
  });
});
