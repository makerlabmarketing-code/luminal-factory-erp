import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_DASHBOARD_PATH,
  AUTH_CALLBACK_PATH,
  UPDATE_PASSWORD_PATH,
  buildAuthRedirectUrl,
  buildPasswordRecoveryRedirectUrl,
  getConfiguredAppBaseUrl,
  parseAuthCallbackAction,
  resolveWorkspaceDefaultPath,
  resolveSafeRedirectPath,
  validateNewPassword,
} from '../utils/auth/flow';
import { sendPasswordRecoveryEmail } from '../utils/auth/password-recovery';
import {
  cleanUpdatePasswordUrl,
  INVALID_RECOVERY_LINK_MESSAGE,
  INVALID_INVITE_LINK_MESSAGE,
  UNVERIFIED_LINK_MESSAGE,
  resolveUpdatePasswordViewState,
} from '../utils/auth/update-password-state';

describe('auth flow helpers', () => {
  it('handles invite callback with token hash', () => {
    const action = parseAuthCallbackAction(
      new URLSearchParams({
        token_hash: 'token-hash',
        type: 'invite',
        next: UPDATE_PASSWORD_PATH,
      })
    );

    expect(action).toEqual({
      kind: 'otp',
      tokenHash: 'token-hash',
      type: 'invite',
      redirectPath: UPDATE_PASSWORD_PATH,
      mode: 'invite',
    });
  });

  it('handles PKCE callback with code and removes code from the redirect path', () => {
    const action = parseAuthCallbackAction(
      new URLSearchParams({
        code: 'auth-code',
        next: UPDATE_PASSWORD_PATH,
      })
    );

    expect(action.kind).toBe('code');
    expect(action.redirectPath).toBe(UPDATE_PASSWORD_PATH);
    expect(action.mode).toBe('recovery');
    expect(action.redirectPath).not.toContain('code=');
  });

  it('handles implicit callback tokens without keeping them in the redirect path', () => {
    const action = parseAuthCallbackAction(
      new URLSearchParams({
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        mode: 'invite',
        next: '/auth/update-password?mode=invite',
      })
    );

    expect(action.kind).toBe('session');
    expect(action.redirectPath).toBe('/auth/update-password?mode=invite');
    expect(action.redirectPath).not.toContain('access_token=');
  });

  it('handles expired callback links without exposing token details', () => {
    const action = parseAuthCallbackAction(
      new URLSearchParams({
        error: 'access_denied',
        error_description: 'expired',
      })
    );

    expect(action.kind).toBe('error');
    if (action.kind !== 'error') throw new Error('Expected callback error action.');
    expect(action.message).toBe(INVALID_RECOVERY_LINK_MESSAGE);
  });

  it('handles invalid callback links', () => {
    const action = parseAuthCallbackAction(new URLSearchParams());

    expect(action.kind).toBe('error');
    expect(action.redirectPath).toBe('/auth/update-password?mode=recovery');
  });

  it('does not allow redirects to external domains', () => {
    expect(resolveSafeRedirectPath('https://example.com', ADMIN_DASHBOARD_PATH)).toBe(
      ADMIN_DASHBOARD_PATH
    );
    expect(resolveSafeRedirectPath('//example.com', ADMIN_DASHBOARD_PATH)).toBe(
      ADMIN_DASHBOARD_PATH
    );
  });

  it('defaults dual-workspace users to admin after login', () => {
    expect(
      resolveWorkspaceDefaultPath({
        canAccessAdmin: true,
        canAccessStaff: true,
      })
    ).toBe('/admin/dashboard');
  });

  it('defaults staff-only users to staff after login', () => {
    expect(
      resolveWorkspaceDefaultPath({
        canAccessAdmin: false,
        canAccessStaff: true,
      })
    ).toBe('/staff');
  });

  it('defaults admin-only users to admin after login', () => {
    expect(
      resolveWorkspaceDefaultPath({
        canAccessAdmin: true,
        canAccessStaff: false,
      })
    ).toBe('/admin/dashboard');
  });

  it('defaults users without workspace access to the shared login entry', () => {
    expect(
      resolveWorkspaceDefaultPath({
        canAccessAdmin: false,
        canAccessStaff: false,
      })
    ).toBe('/auth/no-workspace');
  });

  it('builds reset links through the callback route', () => {
    expect(
      buildAuthRedirectUrl(
        'https://erp.luminalfactory.com',
        `${AUTH_CALLBACK_PATH}?next=/auth/update-password`
      )
    ).toBe('https://erp.luminalfactory.com/auth/callback?next=/auth/update-password');
  });

  it('builds the ERP password recovery redirect URL from configured app base URL', () => {
    expect(buildPasswordRecoveryRedirectUrl(' https://erp.luminalfactory.com/ ')).toBe(
      'https://erp.luminalfactory.com/auth/callback?mode=recovery&next=%2Fauth%2Fupdate-password%3Fmode%3Drecovery'
    );
  });

  it('passes the ERP update-password URL to resetPasswordForEmail', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    await sendPasswordRecoveryEmail(
      { resetPasswordForEmail },
      '  nhanvien@luminalfactory.com  ',
      'https://erp.luminalfactory.com'
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith('nhanvien@luminalfactory.com', {
      redirectTo:
        'https://erp.luminalfactory.com/auth/callback?mode=recovery&next=%2Fauth%2Fupdate-password%3Fmode%3Drecovery',
    });
  });

  it('validates mismatched passwords', () => {
    expect(validateNewPassword('matkhau123', 'khacmatkhau')).toEqual({
      ok: false,
      message: 'Hai mật khẩu chưa giống nhau.',
    });
  });

  it('validates weak passwords', () => {
    expect(validateNewPassword('1234567', '1234567')).toEqual({
      ok: false,
      message: 'Mật khẩu cần có ít nhất 8 ký tự.',
    });
  });

  it('accepts matching passwords that meet the minimum length', () => {
    expect(validateNewPassword('matkhau123', 'matkhau123')).toEqual({ ok: true });
  });

  it('requires a valid explicit app base URL configuration', () => {
    expect(
      getConfiguredAppBaseUrl({
        NEXT_PUBLIC_APP_BASE_URL: 'https://erp.luminalfactory.com',
      })
    ).toBe('https://erp.luminalfactory.com');

    expect(
      getConfiguredAppBaseUrl({
        NEXT_PUBLIC_APP_BASE_URL: 'http://localhost:3000',
      })
    ).toBe('http://localhost:3000');

    expect(() => getConfiguredAppBaseUrl({})).toThrow(
      'Thiếu cấu hình NEXT_PUBLIC_APP_BASE_URL cho luồng đặt lại mật khẩu.'
    );

    expect(() =>
      getConfiguredAppBaseUrl({
        NEXT_PUBLIC_APP_BASE_URL: 'ftp://erp.luminalfactory.com',
      })
    ).toThrow('NEXT_PUBLIC_APP_BASE_URL không hợp lệ cho luồng đặt lại mật khẩu.');
  });

  it('hides the update-password form when the URL has otp_expired', () => {
    const viewState = resolveUpdatePasswordViewState(
      { error: 'access_denied', errorCode: 'otp_expired' },
      'valid'
    );

    expect(viewState.showForm).toBe(false);
    expect(viewState.status).toBe('invalid');
    expect(viewState.message).toBe(INVALID_RECOVERY_LINK_MESSAGE);
  });

  it('uses invite-specific expired link copy', () => {
    const viewState = resolveUpdatePasswordViewState(
      { error: 'access_denied', errorCode: 'otp_expired', mode: 'invite' },
      'valid'
    );

    expect(viewState.showForm).toBe(false);
    expect(viewState.message).toBe(INVALID_INVITE_LINK_MESSAGE);
  });

  it('hides the update-password form when the recovery session is invalid', () => {
    const viewState = resolveUpdatePasswordViewState({}, 'invalid');

    expect(viewState.showForm).toBe(false);
    expect(viewState.status).toBe('invalid');
    expect(viewState.message).toBe(UNVERIFIED_LINK_MESSAGE);
  });

  it('shows the update-password form when the recovery session is valid', () => {
    const viewState = resolveUpdatePasswordViewState({}, 'valid');

    expect(viewState.showForm).toBe(true);
    expect(viewState.status).toBe('valid');
  });

  it('points the resend instructions action to forgot password', () => {
    const viewState = resolveUpdatePasswordViewState({ errorCode: 'otp_expired' }, 'invalid');

    expect(viewState.resendHref).toBe('/auth/forgot-password');
  });

  it('cleans auth error parameters from the update-password URL', () => {
    expect(cleanUpdatePasswordUrl()).toBe('/auth/update-password');
  });
});
