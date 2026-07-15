import { ADMIN_DASHBOARD_PATH, UPDATE_PASSWORD_PATH, type AuthPasswordMode } from './flow';

export const INVALID_RECOVERY_LINK_MESSAGE =
  'Link đặt lại mật khẩu đã hết hạn hoặc không hợp lệ.';
export const INVALID_INVITE_LINK_MESSAGE =
  'Liên kết mời đã hết hạn hoặc không hợp lệ.';
export const UNVERIFIED_LINK_MESSAGE = 'Liên kết chưa được xác minh.';
export const RESEND_PASSWORD_RECOVERY_PATH = '/auth/forgot-password';
export const LOGIN_PATH = ADMIN_DASHBOARD_PATH;

export type RecoverySessionStatus = 'checking' | 'valid' | 'invalid';

export interface UpdatePasswordUrlState {
  error?: string;
  errorCode?: string;
  mode?: AuthPasswordMode;
}

export interface UpdatePasswordViewState {
  status: 'checking' | 'valid' | 'invalid';
  message?: string;
  showForm: boolean;
  resendHref: string;
  loginHref: string;
  shouldCleanUrl: boolean;
}

export function hasInvalidRecoveryUrlState(urlState: UpdatePasswordUrlState): boolean {
  return (
    urlState.error === 'access_denied' ||
    urlState.errorCode === 'otp_expired' ||
    urlState.errorCode === 'access_denied'
  );
}

export function resolveUpdatePasswordViewState(
  urlState: UpdatePasswordUrlState,
  sessionStatus: RecoverySessionStatus
): UpdatePasswordViewState {
  const hasUrlError = hasInvalidRecoveryUrlState(urlState);
  const mode = urlState.mode === 'invite' ? 'invite' : 'recovery';

  if (hasUrlError) {
    return {
      status: 'invalid',
      message: mode === 'invite' ? INVALID_INVITE_LINK_MESSAGE : INVALID_RECOVERY_LINK_MESSAGE,
      showForm: false,
      resendHref: RESEND_PASSWORD_RECOVERY_PATH,
      loginHref: LOGIN_PATH,
      shouldCleanUrl: hasUrlError,
    };
  }

  if (sessionStatus === 'invalid') {
    return {
      status: 'invalid',
      message: UNVERIFIED_LINK_MESSAGE,
      showForm: false,
      resendHref: mode === 'invite' ? LOGIN_PATH : RESEND_PASSWORD_RECOVERY_PATH,
      loginHref: LOGIN_PATH,
      shouldCleanUrl: false,
    };
  }

  if (sessionStatus === 'checking') {
    return {
      status: 'checking',
      showForm: false,
      resendHref: RESEND_PASSWORD_RECOVERY_PATH,
      loginHref: LOGIN_PATH,
      shouldCleanUrl: false,
    };
  }

  return {
    status: 'valid',
    showForm: true,
    resendHref: RESEND_PASSWORD_RECOVERY_PATH,
    loginHref: LOGIN_PATH,
    shouldCleanUrl: false,
  };
}

export function cleanUpdatePasswordUrl(): string {
  return UPDATE_PASSWORD_PATH;
}
