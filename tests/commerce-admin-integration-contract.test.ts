import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMERCE_ADMIN_CONTRACT_VERSION,
  COMMERCE_ADMIN_MANAGEMENT_PREFIX,
  COMMERCE_ADMIN_SIGNATURE_VERSION,
  homepageHeroEndpoints,
} from '../lib/commerce-admin/contracts';
import {
  buildCommerceAdminCanonicalRequest,
  createCommerceAdminBodyDigest,
  createCommerceAdminSignature,
} from '../lib/commerce-admin/signature';

vi.mock('server-only', () => ({}));

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

const compatibilityVector = {
  secret: 'luminal-test-only-hmac-secret-32bytes!!',
  rawBody: '{"action":"publish","id":"11111111-1111-4111-8111-111111111111"}',
  bodySha256: 'e3877fb4241d060842079fa6920c9b9826e6ff3e3fa6364ca23a17321916dbf2',
  canonicalRequest: [
    'lfc-hmac-v1',
    'luminal-erp',
    'test-key-2026-09',
    'luminal-commerce-production',
    '22222222-2222-4222-8222-222222222222',
    '1789110000',
    'nonce_example_1234567890ABCD',
    'user_erp_123',
    'luminal_factory',
    'commerce.hero.publish',
    'POST',
    '/api/admin/v1/homepage-hero/11111111-1111-4111-8111-111111111111/publish',
    'application/json',
    'e3877fb4241d060842079fa6920c9b9826e6ff3e3fa6364ca23a17321916dbf2',
  ].join('\n'),
  expectedSignature: '75c556f4b734a2bc9a85f16a6dbf50a1e1b41d6da3d412b941b3aa2b353a9886',
};

const vectorInput = {
  audience: 'luminal-commerce-production',
  bodyDigest: compatibilityVector.bodySha256,
  clientId: 'luminal-erp',
  keyId: 'test-key-2026-09',
  method: 'POST' as const,
  nonce: 'nonce_example_1234567890ABCD',
  actorId: 'user_erp_123',
  workspaceId: 'luminal_factory',
  path: '/api/admin/v1/homepage-hero/11111111-1111-4111-8111-111111111111/publish',
  requestId: '22222222-2222-4222-8222-222222222222',
  scope: 'commerce.hero.publish' as const,
  timestamp: 1789110000,
};

describe('Commerce Admin integration contract', () => {
  it('uses the Commerce-owned v1 route family and scopes', () => {
    expect(COMMERCE_ADMIN_CONTRACT_VERSION).toBe('2026-09-11');
    expect(COMMERCE_ADMIN_SIGNATURE_VERSION).toBe('lfc-hmac-v1');
    expect(COMMERCE_ADMIN_MANAGEMENT_PREFIX).toBe('/api/admin/v1');
    expect(homepageHeroEndpoints.list()).toMatchObject({
      method: 'GET',
      capability: 'COMMERCE_HOMEPAGE_HERO_VIEW',
      scope: 'commerce.hero.read',
      path: '/api/admin/v1/homepage-hero',
    });
    expect(homepageHeroEndpoints.publish('hero/value', { operationId: 'operation-1' })).toMatchObject({
      method: 'POST',
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      scope: 'commerce.hero.publish',
      path: '/api/admin/v1/homepage-hero/hero%2Fvalue/publish',
    });
  });

  it('matches the shared Commerce lfc-hmac-v1 compatibility vector exactly', () => {
    expect(createCommerceAdminBodyDigest(compatibilityVector.rawBody)).toBe(compatibilityVector.bodySha256);
    expect(buildCommerceAdminCanonicalRequest(vectorInput)).toBe(compatibilityVector.canonicalRequest);
    expect(createCommerceAdminSignature(vectorInput, compatibilityVector.secret)).toBe(compatibilityVector.expectedSignature);
  });

  it('changes the signature when any signed security dimension changes', () => {
    const baseline = createCommerceAdminSignature(vectorInput, compatibilityVector.secret);
    const bodyDigest = createCommerceAdminBodyDigest(`${compatibilityVector.rawBody} `);
    const variants = [
      { ...vectorInput, bodyDigest },
      { ...vectorInput, path: '/api/admin/v1/homepage-hero/other/publish' },
      { ...vectorInput, method: 'PATCH' as const },
      { ...vectorInput, scope: 'commerce.hero.write' as const },
      { ...vectorInput, actorId: 'user_erp_456' },
      { ...vectorInput, workspaceId: 'other_workspace' },
      { ...vectorInput, audience: 'luminal-commerce-preview' },
    ];

    variants.forEach((variant) => {
      expect(createCommerceAdminSignature(variant, compatibilityVector.secret)).not.toBe(baseline);
    });
  });

  it('keeps Commerce credentials and transport on the ERP server', () => {
    const transport = source('services/server/commerceAdminIntegration.ts');
    const adapter = source('services/server/commerceAdminHomepageHero.ts');
    const signing = source('lib/commerce-admin/signature.ts');
    const combined = `${transport}\n${adapter}\n${signing}`;

    expect(transport).toMatch(/^import 'server-only';/);
    expect(adapter).toMatch(/^import 'server-only';/);
    expect(signing).toMatch(/^import 'server-only';/);
    expect(signing).toContain("createHmac('sha256'");
    expect(transport).toContain("return value === 'true'");
    expect(transport).toContain("requireWorkspaceAccess('ADMIN_WORKSPACE')");
    expect(transport).toContain('hasPermission(authContext, capability)');
    expect(transport).toContain("redirect: 'error'");
    expect(transport).toContain("cache: 'no-store'");
    expect(transport).toContain('AbortSignal.timeout');
    expect(transport).toContain('COMMERCE_ADMIN_API_HMAC_SECRET_BASE64');
    expect(combined).not.toMatch(/NEXT_PUBLIC_/);
    expect(combined).not.toMatch(/SUPABASE|service[_-]?role|createSupabase/i);
  });

  it('sends every lfc-hmac-v1 signed envelope header', () => {
    const transport = source('services/server/commerceAdminIntegration.ts');
    for (const header of [
      'X-Luminal-Signature-Version',
      'X-Luminal-Client-Id',
      'X-Luminal-Key-Id',
      'X-Luminal-Audience',
      'X-Luminal-Request-Id',
      'X-Luminal-Timestamp',
      'X-Luminal-Nonce',
      'X-Luminal-Actor-Id',
      'X-Luminal-Workspace-Id',
      'X-Luminal-Scope',
      'X-Luminal-Body-SHA256',
      'X-Luminal-Signature',
    ]) {
      expect(transport).toContain(header);
    }
  });

  it('does not add an ERP route or UI consumer before activation approval', () => {
    expect(fs.existsSync(path.join(root, 'app/api/admin/commerce'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app/admin/commerce'))).toBe(false);
  });
});
