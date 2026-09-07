import { buildPasswordRecoveryRedirectUrl, getAppBaseUrlConfigError } from './flow';

interface PasswordRecoveryAuthClient {
  resetPasswordForEmail(
    email: string,
    options: {
      redirectTo: string;
    }
  ): Promise<{
    error: {
      code?: string;
      status?: number;
    } | null;
  }>;
}

export type PasswordRecoveryOutcome =
  | { ok: true }
  | { ok: false; reason: 'rate_limited' | 'unavailable' };

export const PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE =
  'Hiện chưa thể gửi email đặt lại mật khẩu. Vui lòng liên hệ quản trị viên.';

export const PASSWORD_RECOVERY_RATE_LIMIT_MESSAGE =
  'Bạn đã yêu cầu quá nhanh. Vui lòng đợi một phút rồi thử lại.';

export function getPasswordRecoveryConfigurationError(
  appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL
): string | null {
  return getAppBaseUrlConfigError(appBaseUrl)
    ? 'Cấu hình đặt lại mật khẩu chưa hợp lệ. Vui lòng liên hệ quản trị viên.'
    : null;
}

export async function sendPasswordRecoveryEmail(
  auth: PasswordRecoveryAuthClient,
  email: string,
  appBaseUrl = process.env.NEXT_PUBLIC_APP_BASE_URL
): Promise<PasswordRecoveryOutcome> {
  try {
    const { error } = await auth.resetPasswordForEmail(email.trim(), {
      redirectTo: buildPasswordRecoveryRedirectUrl(appBaseUrl),
    });

    if (!error) return { ok: true };

    if (error.status === 429 || error.code === 'over_email_send_rate_limit') {
      return { ok: false, reason: 'rate_limited' };
    }

    return { ok: false, reason: 'unavailable' };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}
