import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  requireWorkspaceAccess: vi.fn(),
  hasPermission: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/services/server/auth', () => auth);
vi.mock('@/lib/commerce-admin/contracts', () => import('../lib/commerce-admin/contracts'));
vi.mock('@/lib/commerce-admin/signature', () => import('../lib/commerce-admin/signature'));

import { homepageHeroEndpoints } from '../lib/commerce-admin/contracts';
import { requestCommerceAdmin } from '../services/server/commerceAdminIntegration';

const isList = (value: unknown): value is unknown[] => Array.isArray(value);
const TEST_ONLY_HMAC_KEY = Buffer.alloc(32, 53).toString('base64');

describe('Commerce HMAC production guard regression, synthetic credentials only', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('COMMERCE_ADMIN_INTEGRATION_ENABLED', 'true');
    vi.stubEnv('COMMERCE_ADMIN_API_BASE_URL', 'https://commerce-test.invalid');
    vi.stubEnv('COMMERCE_ADMIN_API_CLIENT_ID', 'erp-test');
    vi.stubEnv('COMMERCE_ADMIN_API_KEY_ID', 'current-test');
    vi.stubEnv('COMMERCE_ADMIN_API_AUDIENCE', 'commerce-test');
    vi.stubEnv('COMMERCE_ADMIN_API_WORKSPACE_ID', 'workspace-test');
    vi.stubEnv('COMMERCE_ADMIN_API_HMAC_SECRET_BASE64', TEST_ONLY_HMAC_KEY);
    auth.requireWorkspaceAccess.mockResolvedValue({
      authUserId: 'verified-test-operator',
      employee: { id: 'employee-test' },
    });
    auth.hasPermission.mockResolvedValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('fails closed when the integration is disabled, before reading actor permissions or contacting Commerce', async () => {
    vi.stubEnv('COMMERCE_ADMIN_INTEGRATION_ENABLED', 'false');
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({
      code: 'INTEGRATION_DISABLED',
      status: 503,
    });
    expect(auth.requireWorkspaceAccess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    'http://commerce-test.invalid',
    'https://commerce-test.invalid/path',
    'https://commerce-test.invalid/?token=value',
    'https://commerce-test.invalid/#fragment',
    'https://someone:password@commerce-test.invalid',
    'ftp://commerce-test.invalid',
  ])('rejects an unsafe Commerce URL without making a request: %s', async (baseUrl) => {
    vi.stubEnv('COMMERCE_ADMIN_API_BASE_URL', baseUrl);
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({
      code: 'CONFIGURATION_INVALID',
      status: 503,
    });
    expect(auth.requireWorkspaceAccess).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    Buffer.alloc(31, 9).toString('base64'),
    'not-base64',
    `${TEST_ONLY_HMAC_KEY}=`,
  ])('rejects a short or noncanonical signing secret without exposing it: %s', async (badSecret) => {
    vi.stubEnv('COMMERCE_ADMIN_API_HMAC_SECRET_BASE64', badSecret);
    const error = await requestCommerceAdmin(homepageHeroEndpoints.list(), isList).catch((cause: unknown) => cause);
    expect(error).toMatchObject({ code: 'CONFIGURATION_INVALID', status: 503 });
    expect(String((error as Error).message)).not.toContain(badSecret);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never retries a remote HMAC 401 even if Commerce labels it retryable', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      return Response.json({
        ok: false,
        error: { code: 'AUTHENTICATION_FAILED', message: 'Access denied', retryable: true },
        meta: { contractVersion: '2026-09-11', requestId: headers.get('X-Luminal-Request-Id') },
      }, { status: 401 });
    });

    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({
      code: 'REMOTE_REJECTED',
      status: 401,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries only a verifier infrastructure 503 for GET, with a new nonce and signed request identity', async () => {
    const requestIds: string[] = [];
    const nonces: string[] = [];
    const signatures: string[] = [];
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      const id = headers.get('X-Luminal-Request-Id');
      const nonce = headers.get('X-Luminal-Nonce');
      const signature = headers.get('X-Luminal-Signature');
      if (!id || !nonce || !signature) throw new Error('Missing HMAC envelope');
      requestIds.push(id);
      nonces.push(nonce);
      signatures.push(signature);
      return requestIds.length === 1
        ? Response.json({
            ok: false,
            error: { code: 'VERIFICATION_UNAVAILABLE', message: 'Temporarily unavailable', retryable: true },
            meta: { contractVersion: '2026-09-11', requestId: id },
          }, { status: 503 })
        : Response.json({
            ok: true,
            data: [],
            meta: { contractVersion: '2026-09-11', requestId: id },
          });
    });

    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Set(requestIds).size).toBe(2);
    expect(new Set(nonces).size).toBe(2);
    expect(new Set(signatures).size).toBe(2);
    expect(auth.requireWorkspaceAccess).toHaveBeenCalledTimes(2);
  });

  it('does not retry unrelated 503 failures from the remote service', async () => {
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const headers = new Headers(init.headers);
      return Response.json({
        ok: false,
        error: { code: 'SERVICE_UNAVAILABLE', message: 'Down', retryable: true },
        meta: { contractVersion: '2026-09-11', requestId: headers.get('X-Luminal-Request-Id') },
      }, { status: 503 });
    });
    await expect(requestCommerceAdmin(homepageHeroEndpoints.list(), isList)).rejects.toMatchObject({
      code: 'REMOTE_REJECTED',
      status: 503,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
