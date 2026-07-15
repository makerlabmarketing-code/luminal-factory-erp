export const AUTH_CALLBACK_PATH = '/auth/callback';
export const UPDATE_PASSWORD_PATH = '/auth/update-password';
export const LOGIN_ENTRY_PATH = '/admin/dashboard';
export const ADMIN_DASHBOARD_PATH = '/admin/dashboard';
export const STAFF_PORTAL_PATH = '/staff';
export const NO_WORKSPACE_PATH = '/auth/no-workspace';

const allowedRedirectPaths = new Set([
  AUTH_CALLBACK_PATH,
  UPDATE_PASSWORD_PATH,
  ADMIN_DASHBOARD_PATH,
  STAFF_PORTAL_PATH,
  NO_WORKSPACE_PATH,
  '/',
]);

interface WorkspaceDefaultAccess {
  canAccessAdmin: boolean;
  canAccessStaff: boolean;
}

export interface PasswordValidationResult {
  ok: boolean;
  message?: string;
}

export type AuthCallbackAction =
  | {
      kind: 'code';
      code: string;
      redirectPath: string;
      mode: AuthPasswordMode;
    }
  | {
      kind: 'otp';
      tokenHash: string;
      type: 'invite' | 'recovery';
      redirectPath: string;
      mode: AuthPasswordMode;
    }
  | {
      kind: 'session';
      accessToken: string;
      refreshToken: string;
      redirectPath: string;
      mode: AuthPasswordMode;
    }
  | {
      kind: 'error';
      redirectPath: string;
      message: string;
      mode: AuthPasswordMode;
      errorCode?: string;
    };

export type AuthPasswordMode = 'invite' | 'recovery';

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function normalizeBaseUrl(value: string | undefined): string | null {
  if (!value) return null;
  const trimmedValue = value.trim();
  if (!trimmedValue) return null;
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmedValue) && !/^https?:\/\//i.test(trimmedValue)) {
    return null;
  }

  const candidate = /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;

  try {
    const url = new URL(candidate);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost') return null;

    return trimTrailingSlash(url.origin);
  } catch {
    return null;
  }
}

export function buildAppBaseUrl(value: string | undefined): string {
  if (!value?.trim()) {
    throw new Error('Thiếu cấu hình NEXT_PUBLIC_APP_BASE_URL cho luồng đặt lại mật khẩu.');
  }

  const normalizedBaseUrl = normalizeBaseUrl(value);
  if (!normalizedBaseUrl) {
    throw new Error('NEXT_PUBLIC_APP_BASE_URL không hợp lệ cho luồng đặt lại mật khẩu.');
  }

  return normalizedBaseUrl;
}

export function getPublicAppBaseUrl(): string {
  return buildAppBaseUrl(process.env.NEXT_PUBLIC_APP_BASE_URL);
}

export function getAppBaseUrlConfigError(value: string | undefined): string | null {
  if (!value?.trim()) {
    return 'Thiếu cấu hình NEXT_PUBLIC_APP_BASE_URL cho luồng đặt lại mật khẩu.';
  }

  if (!normalizeBaseUrl(value)) {
    return 'NEXT_PUBLIC_APP_BASE_URL không hợp lệ cho luồng đặt lại mật khẩu.';
  }

  return null;
}

export function getConfiguredAppBaseUrl(
  env: Record<string, string | undefined> = process.env
): string {
  return buildAppBaseUrl(env.NEXT_PUBLIC_APP_BASE_URL);
}

export function getRequestBaseUrl(
  requestUrl: string,
  env: Record<string, string | undefined> = process.env
): string {
  try {
    return getConfiguredAppBaseUrl(env);
  } catch {
    return trimTrailingSlash(new URL(requestUrl).origin);
  }
}

export function isSafeInternalRedirectPath(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!value.startsWith('/')) return false;
  if (value.startsWith('//')) return false;

  const [pathname] = value.split(/[?#]/);
  return allowedRedirectPaths.has(pathname);
}

export function resolveSafeRedirectPath(
  value: string | null | undefined,
  fallbackPath = ADMIN_DASHBOARD_PATH
): string {
  return isSafeInternalRedirectPath(value) ? value! : fallbackPath;
}

export function resolveWorkspaceDefaultPath({
  canAccessAdmin,
  canAccessStaff,
}: WorkspaceDefaultAccess): string {
  if (canAccessAdmin) return ADMIN_DASHBOARD_PATH;
  if (canAccessStaff) return STAFF_PORTAL_PATH;

  return NO_WORKSPACE_PATH;
}

export function resolveAuthPasswordMode(value: string | null | undefined): AuthPasswordMode {
  return value === 'invite' ? 'invite' : 'recovery';
}

export function buildUpdatePasswordRedirectPath(mode: AuthPasswordMode): string {
  return `${UPDATE_PASSWORD_PATH}?mode=${mode}`;
}

export function mapAuthCallbackErrorMessage(mode: AuthPasswordMode, errorCode?: string | null): string {
  if (mode === 'invite') return 'Liên kết mời đã hết hạn hoặc không hợp lệ.';
  if (errorCode === 'otp_expired' || errorCode === 'access_denied') {
    return 'Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.';
  }

  return 'Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.';
}

export function parseAuthCallbackAction(searchParams: URLSearchParams): AuthCallbackAction {
  const type = searchParams.get('type');
  const mode = resolveAuthPasswordMode(searchParams.get('mode') || type);
  const fallbackPath = buildUpdatePasswordRedirectPath(mode);
  const redirectPath = resolveSafeRedirectPath(searchParams.get('next'), fallbackPath);

  if (searchParams.get('error')) {
    const errorCode = searchParams.get('error_code') || searchParams.get('error') || undefined;
    return {
      kind: 'error',
      redirectPath: fallbackPath,
      message: mapAuthCallbackErrorMessage(mode, errorCode),
      mode,
      errorCode,
    };
  }

  const code = searchParams.get('code');
  if (code) {
    return {
      kind: 'code',
      code,
      redirectPath,
      mode,
    };
  }

  const tokenHash = searchParams.get('token_hash');
  if (tokenHash && (type === 'invite' || type === 'recovery')) {
    return {
      kind: 'otp',
      tokenHash,
      type,
      redirectPath,
      mode: type,
    };
  }

  const accessToken = searchParams.get('access_token');
  const refreshToken = searchParams.get('refresh_token');
  if (accessToken && refreshToken) {
    return {
      kind: 'session',
      accessToken,
      refreshToken,
      redirectPath,
      mode,
    };
  }

  return {
    kind: 'error',
    redirectPath: fallbackPath,
    message: mapAuthCallbackErrorMessage(mode),
    mode,
  };
}

export function buildAuthRedirectUrl(baseUrl: string, path = AUTH_CALLBACK_PATH): string {
  const safePath = resolveSafeRedirectPath(path, AUTH_CALLBACK_PATH);
  return new URL(safePath, trimTrailingSlash(baseUrl)).toString();
}

export function buildPasswordRecoveryRedirectUrl(appBaseUrl = getPublicAppBaseUrl()): string {
  return buildAuthRedirectUrl(
    buildAppBaseUrl(appBaseUrl),
    `${AUTH_CALLBACK_PATH}?mode=recovery&next=${encodeURIComponent(buildUpdatePasswordRedirectPath('recovery'))}`
  );
}

export function validateNewPassword(
  password: string,
  confirmPassword: string
): PasswordValidationResult {
  if (password.length < 8) {
    return { ok: false, message: 'Mật khẩu cần có ít nhất 8 ký tự.' };
  }

  if (password !== confirmPassword) {
    return { ok: false, message: 'Hai mật khẩu chưa giống nhau.' };
  }

  return { ok: true };
}
