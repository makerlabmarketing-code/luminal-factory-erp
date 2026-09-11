import 'server-only';

import { createHash, createHmac } from 'node:crypto';
import {
  COMMERCE_ADMIN_CONTRACT_VERSION,
  type CommerceAdminActor,
  type CommerceAdminCapability,
  type CommerceAdminHttpMethod,
} from './contracts';

export interface CommerceAdminSignatureInput {
  actor: CommerceAdminActor;
  bodyDigest: string;
  capability: CommerceAdminCapability;
  clientId: string;
  method: CommerceAdminHttpMethod;
  nonce: string;
  path: string;
  requestId: string;
  timestamp: string;
}

export function createCommerceAdminBodyDigest(body: string): string {
  return createHash('sha256').update(body, 'utf8').digest('base64url');
}

export function createCommerceAdminSignature(
  input: CommerceAdminSignatureInput,
  signingSecret: string,
): string {
  const canonicalRequest = [
    COMMERCE_ADMIN_CONTRACT_VERSION,
    input.method,
    input.path,
    input.timestamp,
    input.nonce,
    input.requestId,
    input.clientId,
    input.actor.employeeId,
    input.actor.authUserId,
    input.capability,
    input.bodyDigest,
  ].join('\n');

  return createHmac('sha256', signingSecret).update(canonicalRequest, 'utf8').digest('base64url');
}
