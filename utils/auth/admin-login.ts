import { ADMIN_DASHBOARD_PATH } from './flow';

export const ADMIN_LOGIN_MESSAGES = {
  invalidCredentials: 'Email hoặc mật khẩu chưa đúng.',
  missingEmployee: 'Tài khoản chưa được cấp quyền sử dụng hệ thống.',
  forbidden: 'Bạn không có quyền truy cập khu vực quản trị.',
  serverError: 'Không thể đăng nhập. Vui lòng thử lại.',
} as const;

export type AdminLoginResult =
  | {
      ok: true;
      redirectPath: string;
    }
  | {
      ok: false;
      message: string;
    };

interface AdminLoginAuthClient {
  signInWithPassword(credentials: {
    email: string;
    password: string;
  }): Promise<{
    data?: {
      session?: unknown;
      user?: unknown;
    } | null;
    error?: unknown;
  }>;
}

interface AdminSessionVerificationResponse {
  ok: boolean;
  status: number;
  json(): Promise<{
    error?: string;
  }>;
}

interface AdminLoginInput {
  auth: AdminLoginAuthClient;
  email: string;
  password: string;
  verifyAdminSession: () => Promise<AdminSessionVerificationResponse>;
}

function toAdminVerificationMessage(status: number, errorMessage?: string): string {
  if (status === 401) return ADMIN_LOGIN_MESSAGES.serverError;
  if (errorMessage === ADMIN_LOGIN_MESSAGES.missingEmployee) {
    return ADMIN_LOGIN_MESSAGES.missingEmployee;
  }
  if (errorMessage === ADMIN_LOGIN_MESSAGES.forbidden) {
    return ADMIN_LOGIN_MESSAGES.forbidden;
  }

  return ADMIN_LOGIN_MESSAGES.serverError;
}

export async function verifyAdminSessionWithApi(): Promise<AdminSessionVerificationResponse> {
  return fetch('/api/admin/auth', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
    },
    cache: 'no-store',
  });
}

export function navigateToAdminDashboard(redirectPath: string): void {
  window.location.assign(redirectPath);
}

export async function submitAdminLogin({
  auth,
  email,
  password,
  verifyAdminSession,
}: AdminLoginInput): Promise<AdminLoginResult> {
  const { data: signInData, error: signInError } = await auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  if (signInError || !signInData?.session || !signInData?.user) {
    return {
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.invalidCredentials,
    };
  }

  try {
    const verificationResponse = await verifyAdminSession();
    if (verificationResponse.ok) {
      return {
        ok: true,
        redirectPath: ADMIN_DASHBOARD_PATH,
      };
    }

    const verificationPayload = await verificationResponse.json();

    return {
      ok: false,
      message: toAdminVerificationMessage(
        verificationResponse.status,
        verificationPayload.error
      ),
    };
  } catch {
    return {
      ok: false,
      message: ADMIN_LOGIN_MESSAGES.serverError,
    };
  }
}
