import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_LOGIN_MESSAGES,
  navigateToAdminDashboard,
  submitAdminLogin,
} from '../utils/auth/admin-login';

function verificationResponse(
  ok: boolean,
  status: number,
  error?: string
) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(error ? { error } : {}),
  };
}

describe('admin login flow', () => {
  it('submits credentials through signInWithPassword', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
      error: null,
    });

    await submitAdminLogin({
      auth: { signInWithPassword },
      email: ' admin@luminalfactory.com ',
      password: 'mat-khau',
      verifyAdminSession: vi.fn().mockResolvedValue(verificationResponse(true, 200)),
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
    });
  });

  it('keeps the admin login button in a loading state while submitting', () => {
    const source = readFileSync(
      join(__dirname, '../app/admin/AdminLoginForm.tsx'),
      'utf8'
    );

    expect(source).toMatch(/disabled=\{checking\}/);
    expect(source).toMatch(/Đang đăng nhập\.\.\./);
  });

  it('returns a neutral message when the password is wrong', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error('invalid login'),
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'sai-mat-khau',
      verifyAdminSession: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.invalidCredentials,
    });
  });

  it('requires both session and user after sign-in succeeds', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: null },
          error: null,
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi.fn(),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.invalidCredentials,
    });
  });

  it('reports when the auth user is not mapped to an employee', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'unmapped@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi
        .fn()
        .mockResolvedValue(
          verificationResponse(false, 403, ADMIN_LOGIN_MESSAGES.missingEmployee)
        ),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.missingEmployee,
    });
  });

  it('reports when the employee does not have ADMIN access', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'staff@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi
        .fn()
        .mockResolvedValue(verificationResponse(false, 403, ADMIN_LOGIN_MESSAGES.forbidden)),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.forbidden,
    });
  });

  it('redirects a valid ADMIN to the dashboard', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi.fn().mockResolvedValue(verificationResponse(true, 200)),
    });

    expect(result).toEqual({
      ok: true,
      redirectPath: '/admin/dashboard',
    });
  });

  it('uses document navigation to avoid stale admin dashboard payloads', () => {
    const originalWindow = globalThis.window;
    const assign = vi.fn();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          assign,
        },
      },
    });

    navigateToAdminDashboard('/admin/dashboard');

    expect(assign).toHaveBeenCalledWith('/admin/dashboard');

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('does not swallow server verification failures', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi.fn().mockRejectedValue(new Error('network failed')),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.serverError,
    });
  });

  it('reports a server error when the server cannot see the new session', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi.fn().mockResolvedValue(verificationResponse(false, 401)),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.serverError,
    });
  });

  it('prevents repeated submit while a request is running', () => {
    const source = readFileSync(
      join(__dirname, '../app/admin/AdminLoginForm.tsx'),
      'utf8'
    );

    expect(source).toMatch(/if \(checking\) return/);
    expect(source).toMatch(/disabled=\{checking\}/);
  });

  it('keeps admin auth verification and admin layout uncached', () => {
    const routeSource = readFileSync(
      join(__dirname, '../app/api/admin/auth/route.ts'),
      'utf8'
    );
    const layoutSource = readFileSync(
      join(__dirname, '../app/admin/layout.tsx'),
      'utf8'
    );

    expect(routeSource).toMatch(/Cache-Control['"], ['"]no-store/);
    expect(layoutSource).toMatch(/dynamic = 'force-dynamic'/);
    expect(layoutSource).toMatch(/revalidate = 0/);
    expect(layoutSource).toMatch(/fetchCache = 'force-no-store'/);
  });

  it('does not render the admin login form for a valid admin context', () => {
    const layoutSource = readFileSync(
      join(__dirname, '../app/admin/layout.tsx'),
      'utf8'
    );

    expect(layoutSource).toMatch(/if \(!authContext\)/);
    expect(layoutSource).toMatch(/if \(!hasAdminAccess\(authContext\.employee\)\)/);
    expect(layoutSource).toMatch(/return <AdminShell>\{children\}<\/AdminShell>/);
  });
});
