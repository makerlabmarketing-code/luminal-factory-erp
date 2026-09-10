import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const { createClient } = vi.hoisted(() => ({ createClient: vi.fn() }));
vi.mock('@/utils/supabase/server', () => ({ createClient }));

import {
  hasPermission,
  isSystemOwner,
  listGrantedPermissions,
  type AuthContext,
} from '../services/server/auth';

function ownerContext(role = 'OWNER'): AuthContext {
  return {
    authUserId: 'owner-auth-id',
    email: 'owner@example.com',
    employee: {
      id: 3,
      full_name: 'System Owner',
      role,
      status: 'ACTIVE',
      is_active: true,
    },
  };
}

describe('system owner authorization', () => {
  it('recognizes only an active OWNER employee as the protected owner', () => {
    expect(isSystemOwner(ownerContext().employee)).toBe(true);
    expect(isSystemOwner(ownerContext('ADMIN').employee)).toBe(false);
    expect(isSystemOwner({ ...ownerContext().employee, is_active: false })).toBe(false);
  });

  it('grants requested current and future permission codes without a permission-row lookup', async () => {
    const context = ownerContext();

    await expect(hasPermission(context, 'FUTURE_PERMISSION')).resolves.toBe(true);
    await expect(listGrantedPermissions(context, ['ACCOUNT_MANAGE', 'FUTURE_PERMISSION'])).resolves.toEqual({
      ok: true,
      permissionCodes: ['ACCOUNT_MANAGE', 'FUTURE_PERMISSION'],
    });
    expect(createClient).not.toHaveBeenCalled();
  });
});
