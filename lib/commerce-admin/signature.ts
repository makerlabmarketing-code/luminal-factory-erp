import 'server-only';

import { createHash, createHmac } from 'node:crypto';
import {
  COMMERCE_ADMIN_SIGNATURE_VERSION,
  type CommerceAdminHttpMethod,
  type CommerceAdminScope,
} from './contracts';

export const COMMERCE_ADMIN_CONTENT_TYPE = 'application/json';

export interface CommerceAdminSignatureInput {
  audience: string;
  bodyDigest: string;
  clientId: string;
  keyId: string;
  method: CommerceAdminHttpMethod;
  nonce: string;
  actorId: string;
  workspaceId: string;
  path: string;
  requestId: string;
  scope: CommerceAdminScope;
  timestamp: number;
}

export function createCommerceAdminBodyDigest(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('hex');
}

export function buildCommerceAdminCanonicalRequest(input: CommerceAdminSignatureInput): string {
  return [
    COMMERCE_ADMIN_SIGNATURE_VERSION,
    input.clientId,
    input.keyId,
    input.audience,
    input.requestId,
    String(input.timestamp),
    input.nonce,
    input.actorId,
    input.workspaceId,
    input.scope,
    input.method,
    input.path,
    COMMERCE_ADMIN_CONTENT_TYPE,
    input.bodyDigest,
  ].join('\n');
}

export function createCommerceAdminSignature(
  input: CommerceAdminSignatureInput,
  signingSecret: string | Buffer,
): string {
  return createHmac('sha256', signingSecret)
    .update(buildCommerceAdminCanonicalRequest(input), 'utf8')
    .digest('hex');
}
