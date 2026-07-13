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
      'app/api/staff/attendance/route.ts',
      'app/api/staff/profile/route.ts',
    ];

    routeFiles.forEach((relativePath) => {
      const source = readFileSync(join(repositoryRoot, relativePath), 'utf8');

      expect(source).toMatch(/requireAuthenticatedEmployee/);
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

    expect(adminLayout).toMatch(/getServerAuthContext/);
    expect(adminLayout).toMatch(/hasAdminAccess/);
    expect(adminAuthRoute).toMatch(/requireAdminEmployee/);
    expect(adminAuthRoute).not.toMatch(/passcode/);
    expect(serverAuth).toMatch(/\.eq\(['"]auth_user_id['"],\s*user\.id\)/);
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
    const staffLogin = readFileSync(join(repositoryRoot, 'app/staff/StaffLoginForm.tsx'), 'utf8');
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
    expect(staffLogin).toMatch(/Email hoặc mật khẩu chưa đúng\./);
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

  it('prefers the publishable Supabase key over the legacy anon fallback', () => {
    const previousPublishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'publishable-test-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';

    expect(getSupabasePublicKey()).toBe('publishable-test-key');

    restoreEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', previousPublishable);
    restoreEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', previousAnon);
  });

  it('falls back to the legacy anon Supabase key during compatibility rollout', () => {
    const previousPublishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-test-key';

    expect(getSupabasePublicKey()).toBe('anon-test-key');

    restoreEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', previousPublishable);
    restoreEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', previousAnon);
  });

  it('fails clearly when no Supabase public key is configured without exposing a key value', () => {
    const previousPublishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    const previousAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    expect(() => getSupabasePublicKey()).toThrow(/Supabase public key/);

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
