import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { LOGOUT_MESSAGES, navigateAfterLogout, signOutCurrentDevice } from '../utils/auth/logout';

const repositoryRoot = join(__dirname, '..');
const source = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');

describe('Staff logout', () => {
  const profileSource = source('app/staff/profile/ProfileView.tsx');
  const logoutSource = source('app/staff/profile/StaffLogoutButton.tsx');
  const portalSource = source('app/staff/portal/StaffPortalContent.tsx');
  const middlewareSource = source('middleware.ts');

  it('exposes an explicit logout action in the reachable Staff profile', () => {
    expect(profileSource).toContain('<StaffLogoutButton />');
    expect(logoutSource).toContain('Đăng xuất');
    expect(logoutSource).toMatch(/type="button"/);
    expect(logoutSource).toMatch(/min-h-11 w-full/);
    expect(portalSource).toMatch(/setActiveTab\('profile'\)/);
    expect(portalSource).toContain('Cá Nhân');
  });

  it('keeps the mobile profile and navigation clear of the safe area', () => {
    expect(portalSource).toContain('env(safe-area-inset-bottom)');
    expect(profileSource).toMatch(/grid-cols-1[\s\S]*sm:grid-cols-2/);
  });

  it('locks before awaiting one approved local Supabase sign-out', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await signOutCurrentDevice({ signOut });

    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(logoutSource).toMatch(/if \(logoutInFlight\.current\) return/);
    expect(logoutSource).toMatch(/logoutInFlight\.current = true[\s\S]*await signOutCurrentDevice/);
  });

  it('replaces history with the shared login after successful sign-out', () => {
    const originalWindow = globalThis.window;
    const replace = vi.fn();
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { replace } },
    });

    navigateAfterLogout('/login');

    expect(replace).toHaveBeenCalledWith('/login');
    expect(logoutSource).toContain("router.replace('/login')");
    expect(logoutSource).toContain("navigateAfterLogout('/login')");
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('shows a safe failure with a support ID and does not claim success', async () => {
    const result = await signOutCurrentDevice({
      signOut: vi.fn().mockResolvedValue({ error: new Error('token=cookie-secret') }),
    });

    expect(result).toEqual({ ok: false, message: LOGOUT_MESSAGES.failed });
    expect(JSON.stringify(result)).not.toContain('cookie-secret');
    expect(logoutSource).toContain('crypto.randomUUID()');
    expect(logoutSource).toContain('Mã hỗ trợ:');
    expect(logoutSource).not.toMatch(/console\./);
  });

  it('keeps protected Staff pages behind session middleware after logout or expiry', () => {
    expect(middlewareSource).toMatch(/pathname\.startsWith\('\/staff'\)[\s\S]*error \|\| !data\.user/);
    expect(middlewareSource).toMatch(/loginUrl\.pathname = '\/login'/);
  });
});
