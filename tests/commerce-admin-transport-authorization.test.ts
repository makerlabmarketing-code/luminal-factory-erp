import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({ requireWorkspaceAccess: vi.fn(), hasPermission: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/services/server/auth', () => auth);
vi.mock('@/lib/commerce-admin/contracts', () => import('../lib/commerce-admin/contracts'));
vi.mock('@/lib/commerce-admin/signature', () => import('../lib/commerce-admin/signature'));

import { homepageHeroEndpoints } from '../lib/commerce-admin/contracts';
import { requestCommerceAdmin } from '../services/server/commerceAdminIntegration';

const isList = (value: unknown): value is unknown[] => Array.isArray(value);

describe('Commerce server transport authorization', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('COMMERCE_ADMIN_INTEGRATION_ENABLED', 'true');
    vi.stubEnv('COMMERCE_ADMIN_API_BASE_URL', 'https://commerce-test.invalid');
    vi.stubEnv('COMMERCE_ADMIN_API_CLIENT_ID', 'erp-test');
    vi.stubEnv('COMMERCE_ADMIN_API_KEY_ID', 'current-test');
    vi.stubEnv('COMMERCE_ADMIN_API_AUDIENCE', 'commerce-test');
    vi.stubEnv('COMMERCE_ADMIN_API_WORKSPACE_ID', 'workspace-test');
    vi.stubEnv('COMMERCE_ADMIN_API_HMAC_SECRET_BASE64', Buffer.alloc(32, 7).toString('base64'));
    auth.requireWorkspaceAccess.mockResolvedValue({ authUserId: 'verified-operator', employee: { id: 'employee-test' } });
    auth.hasPermission.mockResolvedValue(true);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });

  it('never calls Commerce for an unavailable session or denied capability', async () => {
    auth.requireWorkspaceAccess.mockRejectedValueOnce(new Error('session_required'));
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toThrow('session_required');
    auth.hasPermission.mockResolvedValue(false);
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED', status: 403 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('checks the session again on retry and signs only the verified operator', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      expect(headers.get('x-luminal-actor-id')).toBe('verified-operator');
      return Response.json({ ok: true, data: [], meta: {
        contractVersion: '2026-09-11', requestId: headers.get('x-luminal-request-id'),
      } });
    });
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).resolves.toEqual([]);
    auth.hasPermission.mockResolvedValue(false);
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({ code: 'AUTHORIZATION_DENIED' });
    expect(auth.requireWorkspaceAccess).toHaveBeenCalledTimes(2);
    expect(auth.requireWorkspaceAccess).toHaveBeenCalledWith('ADMIN_WORKSPACE');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a successful response with the wrong request identity', async () => {
    fetchMock.mockResolvedValue(Response.json({ ok: true, data: [], meta: {
      contractVersion: '2026-09-11', requestId: 'wrong-request',
    } }));
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
