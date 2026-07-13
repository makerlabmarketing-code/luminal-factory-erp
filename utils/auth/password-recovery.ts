import { buildPasswordRecoveryRedirectUrl } from './flow';

interface PasswordRecoveryAuthClient {
  resetPasswordForEmail(
    email: string,
    options: {
      redirectTo: string;
    }
  ): Promise<unknown>;
}

export function getPasswordRecoveryConfigurationError(
  env: Record<string, string | undefined> = process.env
): string | null {
  try {
    buildPasswordRecoveryRedirectUrl(env);
    return null;
  } catch {
    return 'Cấu hình đặt lại mật khẩu chưa hợp lệ. Vui lòng liên hệ quản trị viên.';
  }
}

export async function sendPasswordRecoveryEmail(
  auth: PasswordRecoveryAuthClient,
  email: string,
  env: Record<string, string | undefined> = process.env
): Promise<unknown> {
  return auth.resetPasswordForEmail(email.trim(), {
    redirectTo: buildPasswordRecoveryRedirectUrl(env),
  });
}
