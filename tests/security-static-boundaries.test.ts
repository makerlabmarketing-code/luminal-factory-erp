import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { getSupabasePublicKey } from '../utils/supabase/env';

const repositoryRoot = join(__dirname, '..');
const scannedProductionDirs = ['app', 'component', 'lib', 'services', 'ultis', 'utils'];
const staffUiDirs = ['app/staff'];

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

function collectFiles(dir: string): string[] {
  if (!existsSync(dir)) return [];

  return readdirSync(dir).flatMap((entry) => {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      return collectFiles(fullPath);
    }

    return [fullPath];
  });
}

describe('static security boundaries', () => {
  it('does not expose service-role credentials in production source paths', () => {
    const files = scannedProductionDirs.flatMap((dir) =>
      collectFiles(join(repositoryRoot, dir))
    );

    const offenders = files.filter((file) => {
      if (file.endsWith('utils/supabase/admin.ts')) return false;
      const source = readFileSync(file, 'utf8');
      return /SUPABASE_SERVICE_ROLE_KEY|service[_-]?role/i.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('does not explicitly enable public production browser source maps', () => {
    const nextConfigPath = join(repositoryRoot, 'next.config.js');
    const source = existsSync(nextConfigPath)
      ? readFileSync(nextConfigPath, 'utf8')
      : '';

    expect(source).not.toMatch(/productionBrowserSourceMaps\s*:\s*true/);
  });

  it('does not keep the legacy hard-coded admin passcode or browser-readable admin cookie', () => {
    const files = scannedProductionDirs.flatMap((dir) =>
      collectFiles(join(repositoryRoot, dir))
    );

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /LF2026@|hq_session_token|luminal_secure_encrypted_admin_session_2026/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('does not use URL, localStorage, or sessionStorage staff portal tokens in staff UI', () => {
    const files = staffUiDirs.flatMap((dir) => collectFiles(join(repositoryRoot, dir)));

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /searchParams\.get\(['"]token['"]\)|current_staff_token|localStorage|sessionStorage|staff\/portal\?token=/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps sensitive staff mutations behind server-authenticated routes', () => {
    const routeFiles = [
      'app/api/attendance/check-out/route.ts',
    ];

    routeFiles.forEach((relativePath) => {
      const source = readFileSync(join(repositoryRoot, relativePath), 'utf8');

      expect(source).toMatch(/requireAuthenticatedEmployee/);
      expect(source).not.toMatch(/const\s*\{[^}]*employeeId[^}]*\}\s*=\s*body/);
      expect(source).not.toMatch(/body\.(employeeId|userId|role)/);
    });
  });

  it('keeps staff workspace APIs behind STAFF_WORKSPACE authorization', () => {
    const routeFiles = [
      'app/api/staff/attendance/route.ts',
      'app/api/staff/profile/route.ts',
    ];

    routeFiles.forEach((relativePath) => {
      const source = readFileSync(join(repositoryRoot, relativePath), 'utf8');

      expect(source).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
      expect(source).not.toMatch(/requireAuthenticatedEmployee\(\)/);
      expect(source).not.toMatch(/const\s*\{[^}]*employeeId[^}]*\}\s*=\s*body/);
      expect(source).not.toMatch(/body\.(employeeId|userId|role)/);
    });
  });

  it('does not send staff profile employee identity from the browser', () => {
    const source = readFileSync(
      join(repositoryRoot, 'services/staffProfileService.ts'),
      'utf8'
    );

    expect(source).not.toMatch(/employeeId/);
    expect(source).toMatch(/\/api\/staff\/profile/);
  });

  it('checks admin authorization on the server instead of trusting frontend role state', () => {
    const adminLayout = readFileSync(join(repositoryRoot, 'app/admin/layout.tsx'), 'utf8');
    const adminAuthRoute = readFileSync(join(repositoryRoot, 'app/api/admin/auth/route.ts'), 'utf8');
    const serverAuth = readFileSync(join(repositoryRoot, 'services/server/auth.ts'), 'utf8');

    expect(adminLayout).toMatch(/getServerAdminAuthContext/);
    expect(adminLayout).toMatch(/canAccessAdmin/);
    expect(adminLayout).toMatch(/canAccessStaff/);
    expect(adminAuthRoute).toMatch(/requireAdminEmployee/);
    expect(adminAuthRoute).not.toMatch(/passcode/);
    expect(serverAuth).toMatch(/\.eq\(['"]auth_user_id['"],\s*user\.id\)/);
    expect(serverAuth).toMatch(/employee_workspace_access/);
    expect(serverAuth).toMatch(/employee_permissions/);
    expect(serverAuth).toMatch(/ADMIN_WORKSPACE/);
    expect(serverAuth).toMatch(/STAFF_WORKSPACE/);
    expect(serverAuth).toMatch(/role === 'ADMIN'/);
  });

  it('keeps public auth callback token-safe and internal-redirect only', () => {
    const callbackRoute = readFileSync(
      join(repositoryRoot, 'app/auth/callback/route.ts'),
      'utf8'
    );

    expect(callbackRoute).toMatch(/exchangeCodeForSession/);
    expect(callbackRoute).toMatch(/verifyOtp/);
    expect(callbackRoute).toMatch(/parseAuthCallbackAction/);
    expect(callbackRoute).not.toMatch(/console\.(log|debug|info|warn|error)/);
  });

  it('uses neutral auth messages for login and password reset', () => {
    const adminLogin = readFileSync(join(repositoryRoot, 'app/admin/AdminLoginForm.tsx'), 'utf8');
    const adminLoginFlow = readFileSync(join(repositoryRoot, 'utils/auth/admin-login.ts'), 'utf8');
    const workspaceAuth = readFileSync(join(repositoryRoot, 'app/api/auth/workspaces/route.ts'), 'utf8');
    const forgotPassword = readFileSync(
      join(repositoryRoot, 'app/auth/forgot-password/ForgotPasswordForm.tsx'),
      'utf8'
    );
    const passwordRecovery = readFileSync(
      join(repositoryRoot, 'utils/auth/password-recovery.ts'),
      'utf8'
    );

    expect(adminLogin).toMatch(/submitAdminLogin/);
    expect(adminLoginFlow).toMatch(/Email hoặc mật khẩu chưa đúng\./);
    expect(workspaceAuth).toMatch(/requireAuthenticatedEmployee/);
    expect(workspaceAuth).toMatch(/resolveWorkspaceDefaultPath/);
    expect(forgotPassword).toMatch(
      /Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi\./
    );
    expect(forgotPassword).toMatch(/sendPasswordRecoveryEmail/);
    expect(passwordRecovery).toMatch(/resetPasswordForEmail/);
  });

  it('does not expose privileged admin credentials through public env names', () => {
    const files = scannedProductionDirs.flatMap((dir) =>
      collectFiles(join(repositoryRoot, dir))
    );

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /NEXT_PUBLIC_.*(ADMIN|PASS|PASSWORD|SECRET|SERVICE_ROLE)/i.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps the account-type landing page explicit and token-free', () => {
    const source = readFileSync(join(repositoryRoot, 'app/page.tsx'), 'utf8');

    expect(source).toMatch(/Dành cho quản trị/);
    expect(source).toMatch(/Dành cho nhân viên/);
    expect(source).toMatch(/href: '\/admin\/dashboard'/);
    expect(source).toMatch(/href: '\/staff'/);
    expect(source).toMatch(/Dùng một tài khoản ERP/);
    expect(source).not.toMatch(/Tài khoản riêng|Không dùng chung tài khoản/);
    expect(source).not.toMatch(/staff\/portal\?token=|localStorage|sessionStorage/);
  });

  it('keeps runtime permission decisions on the server', () => {
    const serverAuth = readFileSync(join(repositoryRoot, 'services/server/auth.ts'), 'utf8');
    const adminShell = readFileSync(join(repositoryRoot, 'app/admin/AdminShell.tsx'), 'utf8');
    const staffPortal = readFileSync(join(repositoryRoot, 'app/staff/portal/StaffPortalContent.tsx'), 'utf8');

    expect(serverAuth).toMatch(/export async function hasWorkspaceAccess/);
    expect(serverAuth).toMatch(/export async function hasPermission/);
    expect(serverAuth).toMatch(/const hasDeny/);
    expect(serverAuth).toMatch(/!hasDeny && hasAllow/);
    expect(adminShell).not.toMatch(/localStorage|sessionStorage/);
    expect(staffPortal).not.toMatch(/localStorage|sessionStorage/);
  });

  it('redirects the legacy staff portal path to the staff home without a loop', () => {
    const staffHome = readFileSync(join(repositoryRoot, 'app/staff/page.tsx'), 'utf8');
    const staffPortal = readFileSync(join(repositoryRoot, 'app/staff/portal/page.tsx'), 'utf8');
    const middleware = readFileSync(join(repositoryRoot, 'middleware.ts'), 'utf8');
    const authFlow = readFileSync(join(repositoryRoot, 'utils/auth/flow.ts'), 'utf8');

    expect(staffHome).toMatch(/StaffPortalContent/);
    expect(staffHome).not.toMatch(/redirect\(['"]\/staff\/portal['"]\)/);
    expect(middleware).toMatch(/pathname === ['"]\/staff\/portal['"]/);
    expect(middleware).toMatch(/redirectUrl\.pathname = ['"]\/staff['"]/);
    expect(middleware).toMatch(/NextResponse\.redirect\(redirectUrl,\s*308\)/);
    expect(staffPortal).toMatch(/redirect\(queryString \? `\/staff\?\$\{queryString\}` : '\/staff'\)/);
    expect(authFlow).toMatch(/STAFF_PORTAL_PATH = '\/staff'/);
    expect(authFlow).toMatch(/LOGIN_ENTRY_PATH = '\/admin\/dashboard'/);
  });

  it('keeps the legacy staff portal path free of staff login UI', () => {
    const staffPortal = readFileSync(join(repositoryRoot, 'app/staff/portal/page.tsx'), 'utf8');

    expect(staffPortal).not.toMatch(/StaffLoginForm/);
    expect(staffPortal).not.toMatch(/Đăng nhập nhân sự/);
    expect(staffPortal).not.toMatch(/signInWithPassword/);
  });

  it('does not render the staff login form from the protected staff layout', () => {
    const staffLayout = readFileSync(join(repositoryRoot, 'app/staff/layout.tsx'), 'utf8');

    expect(staffLayout).toMatch(/getServerAuthContext/);
    expect(staffLayout).toMatch(/canAccessStaff/);
    expect(staffLayout).toMatch(/LOGIN_ENTRY_PATH/);
    expect(staffLayout).toMatch(/dynamic = 'force-dynamic'/);
    expect(staffLayout).toMatch(/revalidate = 0/);
    expect(staffLayout).toMatch(/fetchCache = 'force-no-store'/);
    expect(staffLayout).not.toMatch(/StaffLoginForm/);
    expect(staffLayout).not.toMatch(/Vui lòng đăng nhập bằng tài khoản nhân sự/);
  });

  it('authorizes staff by active employee workspace access instead of legacy staff role', () => {
    const serverAuth = readFileSync(join(repositoryRoot, 'services/server/auth.ts'), 'utf8');
    const staffPortalData = readFileSync(
      join(repositoryRoot, 'services/server/staffPortalData.ts'),
      'utf8'
    );

    expect(serverAuth).toMatch(/export async function canAccessStaff/);
    expect(serverAuth).toMatch(/lookupWorkspaceAccess\(authContext, 'STAFF_WORKSPACE'\)/);
    expect(serverAuth).toMatch(/allowed: viaWorkspace/);
    expect(serverAuth).not.toMatch(/role === ['"]STAFF['"]/);
    expect(serverAuth).toMatch(/isActiveEmployee\(serverEmployee\)/);
    expect(staffPortalData).toMatch(/requireWorkspaceAccess\('STAFF_WORKSPACE'\)/);
  });

  it('keeps staff on the shared Supabase session without a separate staff token store', () => {
    const staffFiles = staffUiDirs.flatMap((dir) => collectFiles(join(repositoryRoot, dir)));
    const offenders = staffFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /setItem|getItem|staff[_-]?session|staff[_-]?token/i.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('does not keep a separate staff login form in the staff route tree', () => {
    expect(existsSync(join(repositoryRoot, 'app/staff/StaffLoginForm.tsx'))).toBe(false);

    const staffFiles = staffUiDirs.flatMap((dir) => collectFiles(join(repositoryRoot, dir)));
    const offenders = staffFiles.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /Đăng nhập nhân sự|Vui lòng đăng nhập bằng tài khoản nhân sự|signInWithPassword/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('does not turn dashboard query errors into empty financial data', () => {
    const source = readFileSync(join(repositoryRoot, 'app/admin/dashboard/page.tsx'), 'utf8');
    const serviceSource = readFileSync(
      join(repositoryRoot, 'services/adminDashboardDataCore.ts'),
      'utf8'
    );

    expect(source).toMatch(/AdminDashboardError/);
    expect(serviceSource).toMatch(/throw new DashboardDataError/);
    expect(serviceSource).toMatch(/financial_ledger_select/);
    expect(serviceSource).not.toMatch(/return\s+buildAdminDashboardDto\(\[\]/);
    expect(source).not.toMatch(/console\.error\("Lỗi lấy dữ liệu biểu đồ:/);
  });

  it('keeps admin dashboard finance queries on the server-side DTO boundary', () => {
    const pageSource = readFileSync(join(repositoryRoot, 'app/admin/dashboard/page.tsx'), 'utf8');
    const chartSource = readFileSync(
      join(repositoryRoot, 'app/admin/dashboard/AdminDashboardCharts.tsx'),
      'utf8'
    );
    const serverServiceSource = readFileSync(
      join(repositoryRoot, 'services/server/adminDashboardData.ts'),
      'utf8'
    );

    expect(pageSource).not.toMatch(/['"]use client['"]/);
    expect(pageSource).toMatch(/dynamic = 'force-dynamic'/);
    expect(pageSource).toMatch(/fetchCache = 'force-no-store'/);
    expect(pageSource).toMatch(/getAdminDashboardDto/);
    expect(chartSource).toMatch(/['"]use client['"]/);
    expect(chartSource).not.toMatch(/supabase|from\(['"]financial_ledger['"]\)|from\(['"]office_expenses['"]\)|from\(['"]shareholders['"]\)/);
    expect(serverServiceSource).toMatch(/requireAdminEmployee/);
    expect(serverServiceSource).toMatch(/createClient/);
    expect(serverServiceSource).not.toMatch(/createServerSupabaseClient/);
  });

  it('does not read or write system settings from runtime source paths', () => {
    const files = ['app', 'component', 'lib', 'services', 'utils']
      .flatMap((dir) => collectFiles(join(repositoryRoot, dir)))
      .filter((file) => !file.endsWith('app/admin/settings/page.tsx'));

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /from\(['"]system_settings['"]\)|\.from\(['"]system_settings['"]\)|public\.system_settings/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps central settings disabled in the admin UI', () => {
    const adminShell = readFileSync(join(repositoryRoot, 'app/admin/AdminShell.tsx'), 'utf8');
    const settingsPage = readFileSync(join(repositoryRoot, 'app/admin/settings/page.tsx'), 'utf8');

    expect(adminShell).not.toMatch(/Cấu Hình Trung Tâm|\/admin\/settings/);
    expect(settingsPage).toMatch(/Cấu hình trung tâm đã tắt/);
    expect(settingsPage).not.toMatch(/createClient|supabase|system_settings|SMTP_PASS/);
  });

  it('keeps SMTP secrets in server environment variables instead of database settings', () => {
    const emailService = readFileSync(join(repositoryRoot, 'services/emailService.ts'), 'utf8');

    expect(emailService).toMatch(/getRequiredEnvValue\(['"]SMTP_HOST['"]\)/);
    expect(emailService).toMatch(/getRequiredEnvValue\(['"]SMTP_PASS['"]\)/);
    expect(emailService).not.toMatch(/from\(['"]system_settings['"]\)/);
  });

  it('keeps the system settings broad-policy remediation package reviewed and draft-only', () => {
    const forward = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_system_settings_broad_policy_forward.sql'),
      'utf8'
    );
    const rollback = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_system_settings_broad_policy_rollback.sql'),
      'utf8'
    );
    const validation = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_system_settings_broad_policy_validation.sql'),
      'utf8'
    );
    const compatibility = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_system_settings_broad_policy_compatibility.md'),
      'utf8'
    );
    const security = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_system_settings_broad_policy_security.md'),
      'utf8'
    );

    expect(forward).toMatch(/drop policy if exists "Allow anon all" on public\.system_settings/);
    expect(forward).toMatch(/drop policy if exists "Allow authenticated all" on public\.system_settings/);
    expect(forward).not.toMatch(/create policy|grant |delete\s+from|truncate|drop table/i);
    expect(rollback).toMatch(/create policy "Allow anon all"/);
    expect(rollback).toMatch(/requires a separate approved live rollback\/security decision/i);
    expect(validation).toMatch(/policyname in \('Allow anon all', 'Allow authenticated all'\)/);
    expect(validation).toMatch(/relrowsecurity/);
    expect(compatibility).toMatch(/No backfill is required/);
    expect(security).toMatch(/No grants, service-role exposure, SECURITY DEFINER function/);

    const migrations = collectFiles(join(repositoryRoot, 'supabase/migrations'));
    const promotedCopies = migrations.filter((file) =>
      readFileSync(file, 'utf8').includes('Batch 3D2: system_settings broad-policy remediation')
    );

    expect(promotedCopies).toEqual([]);
  });


  it('keeps the own-row RLS package reviewed and draft-only', () => {
    const forward = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_own_row_rls_forward.sql'),
      'utf8'
    );
    const rollback = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_own_row_rls_rollback.sql'),
      'utf8'
    );
    const validation = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_own_row_rls_validation.sql'),
      'utf8'
    );
    const compatibility = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_own_row_rls_compatibility.md'),
      'utf8'
    );
    const security = readFileSync(
      join(repositoryRoot, 'supabase/drafts/20260723_own_row_rls_security.md'),
      'utf8'
    );

    expect(forward).toMatch(/create policy "employees staff own profile select"/);
    expect(forward).toMatch(/auth_user_id = \(select auth\.uid\(\)\)/);
    expect(forward).toMatch(/public\.has_workspace_access\('STAFF_WORKSPACE'\)/);
    expect(forward).toMatch(/alter table public\.employees enable row level security/);
    expect(forward).toMatch(/alter table public\.attendance enable row level security/);
    expect(forward).toMatch(/alter table public\.attendance_logs enable row level security/);
    expect(forward).not.toMatch(/to anon|for all|delete\s+from|truncate|drop table|update public\.(employees|attendance|attendance_logs)/i);
    expect(rollback).toMatch(/drop policy if exists "employees staff own profile select"/);
    expect(rollback).not.toMatch(/disable row level security|drop table|delete\s+from|truncate/i);
    expect(validation).toMatch(/employees_no_broad_authenticated_policy/);
    expect(validation).toMatch(/attendance_own_row_policies_still_exist/);
    expect(compatibility).toMatch(/No automated backfill is included/);
    expect(security).toMatch(/No `TO authenticated` policy without row ownership or permission predicate/);

    const migrations = collectFiles(join(repositoryRoot, 'supabase/migrations'));
    const promotedCopies = migrations.filter((file) =>
      readFileSync(file, 'utf8').includes('Batch 3E1: own-row RLS package')
    );

    expect(promotedCopies).toEqual([]);
  });

  it('uses the publishable Supabase key even when a legacy anon key is present', () => {
    const previousPublishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';

    expect(getSupabasePublicKey()).toBe('publishable-test-key');

    restoreEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', previousPublishable);
    restoreEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', previousAnon);
  });

  it('does not fall back to the legacy anon Supabase key', () => {
    const previousPublishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';

    expect(() => getSupabasePublicKey()).toThrow(/NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY/);

    restoreEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', previousPublishable);
    restoreEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', previousAnon);
  });

  it('fails clearly when no Supabase public key is configured without exposing a key value', () => {
    const previousPublishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabasePublicKey()).toThrow(/Supabase publishable key/);

    restoreEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', previousPublishable);
    restoreEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', previousAnon);
  });

  it('does not import privileged Supabase clients from Client Components', () => {
    const files = scannedProductionDirs.flatMap((dir) =>
      collectFiles(join(repositoryRoot, dir))
    );

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return (
        /['"]use client['"]/.test(source) &&
        /@\/utils\/supabase\/(privileged|admin)|@\/ultis\/supabase\/(privileged|admin)/.test(source)
      );
    });

    expect(offenders).toEqual([]);
  });

  it('does not import the browser Supabase owner from server routes or server services', () => {
    const serverDirs = ['app/api', 'services/server'];
    const files = serverDirs.flatMap((dir) => collectFiles(join(repositoryRoot, dir)));

    const offenders = files.filter((file) => {
      const source = readFileSync(file, 'utf8');
      return /@\/utils\/supabase\/client|@\/lib\/supabase/.test(source);
    });

    expect(offenders).toEqual([]);
  });

  it('keeps lib/supabase as a compatibility layer without a top-level browser client', () => {
    const source = readFileSync(join(repositoryRoot, 'lib/supabase.ts'), 'utf8');

    expect(source).not.toMatch(/createBrowserClient/);
    expect(source).not.toMatch(/export\s+const\s+supabase/);
    expect(source).toMatch(/Deprecated compatibility exports/);
  });
});
