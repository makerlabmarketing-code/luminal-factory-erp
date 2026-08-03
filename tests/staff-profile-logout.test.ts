import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOGOUT_MESSAGES, navigateAfterLogout, signOutCurrentDevice } from '../utils/auth/logout';

const repositoryRoot = join(__dirname, '..');
const source = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');

describe('Staff profile logout', () => {
  it('uses the approved local sign-out and fixed login redirect', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await expect(signOutCurrentDevice({ signOut })).resolves.toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledOnce();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });

    const originalWindow = globalThis.window;
    const replace = vi.fn();
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { replace } } });
    navigateAfterLogout('/login');
    expect(replace).toHaveBeenCalledWith('/login');
    Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow });
  });

  it('keeps failure feedback safe and does not expose the raw provider error', async () => {
    const result = await signOutCurrentDevice({
      signOut: vi.fn().mockResolvedValue({ error: new Error('secret provider detail') }),
    });
    expect(result).toEqual({ ok: false, message: LOGOUT_MESSAGES.failed });
    expect(JSON.stringify(result)).not.toContain('secret provider detail');
  });

  it('keeps the visible mobile action locked synchronously and refreshes routing before replacement', () => {
    const logoutSource = source('app/staff/profile/StaffLogoutButton.tsx');
    const profileSource = source('app/staff/profile/ProfileView.tsx');
    const portalSource = source('app/staff/portal/StaffPortalContent.tsx');

    expect(profileSource).toMatch(/Tài khoản nhân viên/);
    expect(profileSource).toMatch(/StaffLogoutButton/);
    expect(logoutSource).toMatch(/logoutStartedRef\.current/);
    expect(logoutSource).toMatch(/crypto\.randomUUID\(\)/);
    expect(logoutSource).toMatch(/router\.replace\('\/login'\)/);
    expect(logoutSource).toMatch(/router\.refresh\(\)/);
    expect(logoutSource).toMatch(/navigateAfterLogout\('\/login'\)/);
    expect(logoutSource).not.toMatch(/console\.|localStorage|sessionStorage/);
    expect(portalSource).toMatch(/safe-area-inset-bottom/);
  });
});
