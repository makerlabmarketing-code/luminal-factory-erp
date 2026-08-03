import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const repositoryRoot = join(__dirname, '..');
const source = (path: string) => readFileSync(join(repositoryRoot, path), 'utf8');

describe('shared Staff authentication entry', () => {
  const middleware = source('middleware.ts');
  const loginPage = source('app/login/page.tsx');
  const workspaceRoute = source('app/api/auth/workspaces/route.ts');
  const adminLayout = source('app/admin/layout.tsx');

  it('redirects a clean Staff route session to the shared login with a return target', () => {
    expect(middleware).toMatch(/pathname\.startsWith\('\/staff'\)/);
    expect(middleware).toMatch(/loginUrl\.pathname = '\/login'/);
    expect(middleware).toMatch(/searchParams\.set\([\s\S]*'next'/);
    expect(loginPage).toContain('AdminLoginForm');
  });

  it('verifies an existing session before leaving the shared login', () => {
    expect(loginPage).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(loginPage).toContain('/auth/workspace-redirect');
  });

  it('resolves workspace access on the server rather than from the route name', () => {
    expect(workspaceRoute).toMatch(/canAccessAdmin\(authContext\)/);
    expect(workspaceRoute).toMatch(/canAccessStaff\(authContext\)/);
    expect(workspaceRoute).toMatch(/resolveWorkspaceRedirectPath/);
  });

  it('preserves the existing safe Admin unauthorized state', () => {
    expect(adminLayout).toContain('Tài khoản chưa được cấp quyền truy cập');
    expect(adminLayout).toMatch(/if \(!adminAccess\.allowed\)/);
  });
});
