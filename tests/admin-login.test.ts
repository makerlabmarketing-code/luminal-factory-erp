import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ADMIN_LOGIN_STEP_MESSAGES,
  ADMIN_LOGIN_MESSAGES,
  navigateToAdminDashboard,
  submitAdminLogin,
  verifyAdminSessionWithApi,
} from '../utils/auth/admin-login';
import {
  LOGOUT_MESSAGES,
  navigateAfterLogout,
  signOutCurrentDevice,
} from '../utils/auth/logout';

function verificationResponse(
  ok: boolean,
  status: number,
  error?: string,
  code?: string
) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue({
      ...(error ? { error } : {}),
      ...(code ? { code } : {}),
      status,
    }),
  };
}

describe('admin login flow', () => {
  it('submits credentials through signInWithPassword', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
      error: null,
    });

    const verifyAdminSession = vi.fn().mockResolvedValue(verificationResponse(true, 200));

    await submitAdminLogin({
      auth: { signInWithPassword },
      email: ' admin@luminalfactory.com ',
      password: 'mat-khau',
      verifyAdminSession,
    });

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
    });
    expect(verifyAdminSession).toHaveBeenCalledTimes(1);
  });

  it('calls the admin verification endpoint with the required fetch contract', async () => {
    const originalFetch = globalThis.fetch;
    const fetchMock = vi.fn().mockResolvedValue(verificationResponse(true, 200));
    globalThis.fetch = fetchMock;

    await verifyAdminSessionWithApi();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/auth', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
      },
      credentials: 'include',
      cache: 'no-store',
    });

    globalThis.fetch = originalFetch;
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
    const verifyAdminSession = vi.fn();
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: null, user: null },
          error: new Error('invalid login'),
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'sai-mat-khau',
      verifyAdminSession,
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.invalidCredentials,
    });
    expect(verifyAdminSession).not.toHaveBeenCalled();
  });

  it('returns the same neutral message for auth network and rate-limit errors', async () => {
    const cases = [
      new Error('network error'),
      new Error('rate limit exceeded'),
      new Error('invalid login credentials'),
    ];

    for (const signInError of cases) {
      const verifyAdminSession = vi.fn();
      const result = await submitAdminLogin({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: null,
            error: signInError,
          }),
        },
        email: 'admin@luminalfactory.com',
        password: 'mat-khau',
        verifyAdminSession,
      });

      expect(result).toEqual({
        ok: false,
        message: ADMIN_LOGIN_MESSAGES.invalidCredentials,
      });
      expect(verifyAdminSession).not.toHaveBeenCalled();
    }
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
          verificationResponse(
            false,
            404,
            ADMIN_LOGIN_MESSAGES.missingEmployee,
            'employee_not_linked'
          )
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

  it('reports inactive employees as forbidden admin access', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'inactive@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi
        .fn()
        .mockResolvedValue(
          verificationResponse(false, 403, ADMIN_LOGIN_MESSAGES.forbidden, 'employee_inactive')
        ),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.forbidden,
    });
  });

  it('redirects a valid ADMIN to the dashboard', async () => {
    const onStep = vi.fn();
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
      onStep,
    });

    expect(result).toEqual({
      ok: true,
      redirectPath: '/admin/dashboard',
    });
    expect(onStep).toHaveBeenNthCalledWith(1, 'sign_in_started');
    expect(onStep).toHaveBeenNthCalledWith(2, 'sign_in_succeeded');
    expect(onStep).toHaveBeenNthCalledWith(3, 'admin_verify_started');
    expect(onStep).toHaveBeenNthCalledWith(4, 'admin_verify_response_status', 200);
    expect(onStep).toHaveBeenNthCalledWith(5, 'admin_verify_succeeded');
  });

  it('uses document navigation to avoid stale admin dashboard payloads', () => {
    const originalWindow = globalThis.window;
    const replace = vi.fn();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          replace,
        },
      },
    });

    navigateToAdminDashboard('/admin/dashboard');

    expect(replace).toHaveBeenCalledWith('/admin/dashboard');

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: originalWindow,
    });
  });

  it('signs out only the current device for admin logout', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });

    const result = await signOutCurrentDevice({ signOut });

    expect(result).toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('reports admin logout failures without swallowing them', async () => {
    const result = await signOutCurrentDevice({
      signOut: vi.fn().mockResolvedValue({ error: new Error('logout failed') }),
    });

    expect(result).toEqual({
      ok: false,
      message: LOGOUT_MESSAGES.failed,
    });
  });

  it('uses document navigation after logout so cached admin data is not restored', () => {
    const originalWindow = globalThis.window;
    const replace = vi.fn();

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: {
        location: {
          replace,
        },
      },
    });

    navigateAfterLogout('/');

    expect(replace).toHaveBeenCalledWith('/');

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
      message: ADMIN_LOGIN_MESSAGES.unconfirmedSession,
    });
  });

  it('reports auth.getUser errors as an unconfirmed session instead of a server failure', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi
        .fn()
        .mockResolvedValue(
          verificationResponse(false, 401, ADMIN_LOGIN_MESSAGES.unconfirmedSession, 'session_not_verified')
        ),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.unconfirmedSession,
    });
  });

  it('reports a server error for admin verification 500 responses', async () => {
    const result = await submitAdminLogin({
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: { session: { id: 'session' }, user: { id: 'auth-user-id' } },
          error: null,
        }),
      },
      email: 'admin@luminalfactory.com',
      password: 'mat-khau',
      verifyAdminSession: vi.fn().mockResolvedValue(verificationResponse(false, 500)),
    });

    expect(result).toEqual({
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.serverError,
    });
  });

  it('keeps a clear diagnostic state while successful verification navigates', () => {
    const source = readFileSync(
      join(__dirname, '../app/admin/AdminLoginForm.tsx'),
      'utf8'
    );

    expect(source).toMatch(/data-auth-step=\{authStep\}/);
    expect(source).toMatch(/setAuthStep\('navigation_started'\)/);
    expect(source).toMatch(/authStep === 'admin_verify_response_status'/);
    expect(ADMIN_LOGIN_STEP_MESSAGES.navigation_started).toBe(
      'Đang chuyển tới bảng điều khiển.'
    );
  });

  it('only navigates after admin verification succeeds', () => {
    const source = readFileSync(
      join(__dirname, '../app/admin/AdminLoginForm.tsx'),
      'utf8'
    );

    expect(source).toMatch(/if \(!loginResult\.ok\) \{/);
    expect(source).toMatch(/return;\n    }\n\n    try \{/);
    expect(source).toMatch(/navigateToAdminDashboard\(loginResult\.redirectPath\)/);
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
    const serverAuthSource = readFileSync(
      join(__dirname, '../services/server/auth.ts'),
      'utf8'
    );
    const layoutSource = readFileSync(
      join(__dirname, '../app/admin/layout.tsx'),
      'utf8'
    );

    expect(routeSource).toMatch(/Cache-Control['"], ['"]no-store/);
    expect(routeSource).toMatch(/export async function POST/);
    expect(routeSource).toMatch(/requireAdminEmployee\(\)/);
    expect(routeSource).not.toMatch(/request\.json\(/);
    expect(routeSource).toMatch(/has_auth_cookie/);
    expect(routeSource).toMatch(/get_user_success/);
    expect(routeSource).toMatch(/employee_lookup_started/);
    expect(routeSource).toMatch(/employee_lookup_result_count/);
    expect(routeSource).toMatch(/failure_stage/);
    expect(routeSource).toMatch(/supabase_error_code/);
    expect(routeSource).toMatch(/supabase_error_message/);
    expect(serverAuthSource).toMatch(/supabase\.auth\.getUser\(\)/);
    expect(serverAuthSource).toMatch(/\.eq\('auth_user_id', user\.id\)/);
    expect(serverAuthSource).toMatch(/ADMIN_EMPLOYEE_AUTH_SELECT =\n  'id, auth_user_id, role, status, is_active'/);
    expect(serverAuthSource).toMatch(/getServerAuthContextLookup\(ADMIN_EMPLOYEE_AUTH_SELECT\)/);
    expect(serverAuthSource).not.toMatch(/ADMIN_EMPLOYEE_AUTH_SELECT =\n  '.*employee_id/);
    expect(serverAuthSource).toMatch(/role === 'ADMIN'/);
    expect(serverAuthSource).toMatch(/role === 'OWNER'/);
    expect(serverAuthSource).toMatch(/isActiveEmployee\(serverEmployee\)/);
    expect(serverAuthSource).toMatch(/hasAdminAccess\(authContext\.employee\)/);
    expect(routeSource).toMatch(/status: 200/);
    expect(routeSource).toMatch(/code: 'admin_verified'/);
    expect(routeSource).toMatch(/session_not_verified/);
    expect(routeSource).toMatch(/employee_not_linked/);
    expect(serverAuthSource).toMatch(/employee_inactive/);
    expect(routeSource).toMatch(/admin_forbidden/);
    expect(routeSource).toMatch(/admin_verification_failed/);
    expect(layoutSource).toMatch(/getServerAdminAuthContext/);
    expect(layoutSource).toMatch(/dynamic = 'force-dynamic'/);
    expect(layoutSource).toMatch(/revalidate = 0/);
    expect(layoutSource).toMatch(/fetchCache = 'force-no-store'/);
  });

  it('keeps admin logout as a real local Supabase sign-out flow', () => {
    const shellSource = readFileSync(
      join(__dirname, '../app/admin/AdminShell.tsx'),
      'utf8'
    );
    const logoutSource = readFileSync(
      join(__dirname, '../app/admin/AdminLogoutButton.tsx'),
      'utf8'
    );

    expect(shellSource).toMatch(/AdminLogoutButton/);
    expect(shellSource).not.toMatch(/Thoát Admin/);
    expect(logoutSource).toMatch(/signOutCurrentDevice/);
    expect(logoutSource).toMatch(/Đăng xuất/);
    expect(logoutSource).toMatch(/Đang đăng xuất\.\.\./);
    expect(logoutSource).toMatch(/router\.refresh\(\)/);
    expect(logoutSource).toMatch(/navigateAfterLogout\('\/'\)/);
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

  it('keeps the Supabase SSR browser/server/middleware cookie contract aligned', () => {
    const browserClientSource = readFileSync(
      join(__dirname, '../utils/supabase/client.ts'),
      'utf8'
    );
    const serverClientSource = readFileSync(
      join(__dirname, '../utils/supabase/server.ts'),
      'utf8'
    );
    const middlewareClientSource = readFileSync(
      join(__dirname, '../utils/supabase/middleware.ts'),
      'utf8'
    );
    const loginFormSource = readFileSync(
      join(__dirname, '../app/admin/AdminLoginForm.tsx'),
      'utf8'
    );

    expect(browserClientSource).toMatch(/createBrowserClient\(getSupabaseUrl\(\), getSupabasePublicKey\(\)\)/);
    expect(serverClientSource).toMatch(/createServerClient\(getSupabaseUrl\(\), getSupabasePublicKey\(\)/);
    expect(middlewareClientSource).toMatch(/createServerClient\(getSupabaseUrl\(\), getSupabasePublicKey\(\)/);
    expect(serverClientSource).toMatch(/getAll\(\)/);
    expect(serverClientSource).toMatch(/setAll\(cookiesToSet\)/);
    expect(middlewareClientSource).toMatch(/request\.cookies\.getAll\(\)/);
    expect(middlewareClientSource).toMatch(/supabaseResponse\.cookies\.set/);
    expect(loginFormSource).toMatch(/useMemo\(\(\) => createClient\(\), \[\]\)/);
    expect(loginFormSource).not.toMatch(/import \{ supabase \}/);
    expect(loginFormSource).not.toMatch(/localStorage/);
  });
});
