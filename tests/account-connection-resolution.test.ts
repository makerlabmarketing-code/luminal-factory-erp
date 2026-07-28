import { describe, expect, it } from 'vitest';
import { accountConnectionLabels, resolveAccountConnectionStatus } from '../lib/accountConnection';

const connected = {
  employeeEmail: 'staff@example.com',
  authUserId: 'auth-1',
  employeeIsActive: true,
  authUser: { email: 'staff@example.com', confirmedAt: '2026-01-01', lastSignInAt: '2026-01-02' },
};

describe('employee account connection classification', () => {
  it('reports a valid connected mapping', () => {
    expect(resolveAccountConnectionStatus(connected)).toBe('CONNECTED');
    expect(accountConnectionLabels.CONNECTED).toBe('Đã kết nối');
  });

  it('distinguishes a missing Auth user', () => {
    expect(resolveAccountConnectionStatus({ ...connected, authUser: null })).toBe('AUTH_USER_MISSING');
    expect(accountConnectionLabels.AUTH_USER_MISSING).toBe('Không tìm thấy tài khoản');
  });

  it('does not call a temporary batch lookup failure a broken link', () => {
    expect(resolveAccountConnectionStatus({ ...connected, authLookupFailed: true, authUser: null })).toBe('AUTH_LOOKUP_FAILED');
    expect(accountConnectionLabels.AUTH_LOOKUP_FAILED).toBe('Chưa tải được trạng thái tài khoản');
  });

  it('distinguishes an Auth email mismatch', () => {
    expect(resolveAccountConnectionStatus({ ...connected, authUser: { ...connected.authUser, email: 'other@example.com' } })).toBe('AUTH_EMAIL_MISMATCH');
  });

  it('uses Lỗi liên kết only for a confirmed duplicate mapping', () => {
    expect(resolveAccountConnectionStatus({ ...connected, duplicateMapping: true })).toBe('DUPLICATE_AUTH_MAPPING');
    expect(accountConnectionLabels.DUPLICATE_AUTH_MAPPING).toBe('Lỗi liên kết');
  });
});
