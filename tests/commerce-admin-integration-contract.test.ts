import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  COMMERCE_ADMIN_CONTRACT_VERSION,
  COMMERCE_ADMIN_MANAGEMENT_PREFIX,
  homepageHeroEndpoints,
} from '../lib/commerce-admin/contracts';
import { createCommerceAdminSignature } from '../lib/commerce-admin/signature';

vi.mock('server-only', () => ({}));

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

describe('Commerce Admin integration contract', () => {
  it('uses a versioned Commerce-owned management boundary', () => {
    expect(COMMERCE_ADMIN_CONTRACT_VERSION).toBe('2026-09-11');
    expect(COMMERCE_ADMIN_MANAGEMENT_PREFIX).toBe('/api/management/v1');
    expect(homepageHeroEndpoints.list()).toMatchObject({
      method: 'GET',
      capability: 'COMMERCE_HOMEPAGE_HERO_VIEW',
      path: '/api/management/v1/homepage-hero',
    });
    expect(homepageHeroEndpoints.publish('hero/value', { operationId: 'operation-1' })).toMatchObject({
      method: 'POST',
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE',
      path: '/api/management/v1/homepage-hero/hero%2Fvalue/publish',
    });
  });

  it('signs the full request identity', () => {
    const input = {
      actor: { authUserId: 'auth-user-1', employeeId: 'employee-1' },
      bodyDigest: 'body-digest',
      capability: 'COMMERCE_HOMEPAGE_HERO_MANAGE' as const,
      clientId: 'erp-production',
      method: 'POST' as const,
      nonce: 'nonce-1',
      path: '/api/management/v1/homepage-hero',
      requestId: 'request-1',
      timestamp: '2026-09-11T00:00:00.000Z',
    };
    const secret = '0123456789abcdef0123456789abcdef';
    const signature = createCommerceAdminSignature(input, secret);

    expect(signature).toBe(createCommerceAdminSignature(input, secret));
    expect(signature).not.toBe(createCommerceAdminSignature({ ...input, nonce: 'nonce-2' }, secret));
    expect(signature).not.toBe(createCommerceAdminSignature({
      ...input,
      actor: { ...input.actor, employeeId: 'employee-2' },
    }, secret));
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
    expect(combined).not.toMatch(/NEXT_PUBLIC_/);
    expect(combined).not.toMatch(/SUPABASE|service[_-]?role|createSupabase/i);
  });

  it('signs actor, capability, replay and body-integrity evidence', () => {
    const transport = source('services/server/commerceAdminIntegration.ts');
    for (const header of [
      'X-Luminal-Actor-Auth-User-Id',
      'X-Luminal-Actor-Employee-Id',
      'X-Luminal-Capability',
      'X-Luminal-Content-SHA256',
      'X-Luminal-Contract-Version',
      'X-Luminal-Nonce',
      'X-Luminal-Request-Id',
      'X-Luminal-Timestamp',
    ]) {
      expect(transport).toContain(header);
    }
  });

  it('does not add an ERP route or UI consumer before activation approval', () => {
    expect(fs.existsSync(path.join(root, 'app/api/admin/commerce'))).toBe(false);
    expect(fs.existsSync(path.join(root, 'app/admin/commerce'))).toBe(false);
  });
});
