import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const source = fs.readFileSync(path.join(process.cwd(), 'services/server/commerceAdminIntegration.ts'), 'utf8');

describe('ERP signed Commerce read retry safety', () => {
  it('only retries verifier infrastructure failures for GET once', () => {
    expect(source).toMatch(/retryTransientRead = true/);
    expect(source).toMatch(/retryTransientRead &&\s*endpoint\.method === 'GET'/);
    expect(source).toMatch(/response\.status === 503/);
    expect(source).toMatch(/failure\?\.error\.code === 'VERIFICATION_UNAVAILABLE'/);
    expect(source).toMatch(/failure\.error\.retryable/);
    expect(source).toMatch(/return requestCommerceAdmin\(endpoint, isData, false\)/);
  });

  it('keeps a freshly signed UUID request and nonce per attempt, and never retries rejected 401s or writes', () => {
    expect(source).toMatch(/const requestId = randomUUID\(\)/);
    expect(source).toMatch(/const nonce = randomUUID\(\)/);
    expect(source).toMatch(/createCommerceAdminSignature\(/);
    expect(source).toMatch(/endpoint\.method === 'GET'/);
    expect(source).not.toMatch(/response\.status === 401\s*&&/);
    expect(source).toMatch(/'REMOTE_REJECTED'/);
  });
});
