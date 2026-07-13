import { describe, expect, it, vi } from 'vitest';
import {
  ADMIN_DASHBOARD_PATH,
  AUTH_CALLBACK_PATH,
  UPDATE_PASSWORD_PATH,
  buildAuthRedirectUrl,
  buildPasswordRecoveryRedirectUrl,
  getConfiguredAppBaseUrl,
  parseAuthCallbackAction,
  resolveSafeRedirectPath,
  validateNewPassword,
} from '../utils/auth/flow';
import { sendPasswordRecoveryEmail } from '../utils/auth/password-recovery';

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
    expect(action.redirectPath).not.toContain('code=');
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
    expect(action.message).toBe('Link không hợp lệ hoặc đã hết hạn.');
  });

  it('handles invalid callback links', () => {
    const action = parseAuthCallbackAction(new URLSearchParams());

    expect(action.kind).toBe('error');
    expect(action.redirectPath).toBe(UPDATE_PASSWORD_PATH);
  });

  it('does not allow redirects to external domains', () => {
    expect(resolveSafeRedirectPath('https://example.com', ADMIN_DASHBOARD_PATH)).toBe(
      ADMIN_DASHBOARD_PATH
    );
    expect(resolveSafeRedirectPath('//example.com', ADMIN_DASHBOARD_PATH)).toBe(
      ADMIN_DASHBOARD_PATH
    );
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
    expect(
      buildPasswordRecoveryRedirectUrl({
        NEXT_PUBLIC_APP_BASE_URL: 'https://erp.luminalfactory.com',
      })
    ).toBe('https://erp.luminalfactory.com/auth/update-password');
  });

  it('passes the ERP update-password URL to resetPasswordForEmail', async () => {
    const resetPasswordForEmail = vi.fn().mockResolvedValue({ error: null });

    await sendPasswordRecoveryEmail(
      { resetPasswordForEmail },
      '  nhanvien@luminalfactory.com  ',
      {
        NEXT_PUBLIC_APP_BASE_URL: 'https://erp.luminalfactory.com',
      }
    );

    expect(resetPasswordForEmail).toHaveBeenCalledWith('nhanvien@luminalfactory.com', {
      redirectTo: 'https://erp.luminalfactory.com/auth/update-password',
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
});
