import 'server-only';

import { randomUUID } from 'node:crypto';
import {
  COMMERCE_ADMIN_CONTRACT_VERSION,
  COMMERCE_ADMIN_MANAGEMENT_PREFIX,
  COMMERCE_ADMIN_SIGNATURE_VERSION,
  type CommerceAdminActor,
  type CommerceAdminCapability,
  type CommerceAdminEndpoint,
  type CommerceAdminFailure,
  type CommerceAdminResponse,
} from '@/lib/commerce-admin/contracts';
import {
  COMMERCE_ADMIN_CONTENT_TYPE,
  createCommerceAdminBodyDigest,
  createCommerceAdminSignature,
} from '@/lib/commerce-admin/signature';
import { hasPermission, requireWorkspaceAccess } from '@/services/server/auth';

export const COMMERCE_ADMIN_INTEGRATION_FLAG = 'COMMERCE_ADMIN_INTEGRATION_ENABLED';
export const COMMERCE_ADMIN_SERVER_ENVIRONMENT_KEYS = [
  COMMERCE_ADMIN_INTEGRATION_FLAG,
  'COMMERCE_ADMIN_API_BASE_URL',
  'COMMERCE_ADMIN_API_CLIENT_ID',
  'COMMERCE_ADMIN_API_KEY_ID',
  'COMMERCE_ADMIN_API_AUDIENCE',
  'COMMERCE_ADMIN_API_WORKSPACE_ID',
  'COMMERCE_ADMIN_API_HMAC_SECRET_BASE64',
] as const;

const REQUEST_TIMEOUT_MS = 4_000;
const MAX_REQUEST_BYTES = 256_000;
const MAX_RESPONSE_BYTES = 1_000_000;
const SAFE_TOKEN_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

export type CommerceAdminIntegrationErrorCode =
  | 'INTEGRATION_DISABLED'
  | 'CONFIGURATION_INVALID'
  | 'REQUEST_INVALID'
  | 'AUTHORIZATION_DENIED'
  | 'REQUEST_TIMEOUT'
  | 'REMOTE_UNAVAILABLE'
  | 'REMOTE_REJECTED'
  | 'INVALID_RESPONSE';

export class CommerceAdminIntegrationError extends Error {
  constructor(
    public readonly code: CommerceAdminIntegrationErrorCode,
    message: string,
    public readonly status: number,
    public readonly retryable = false,
    public readonly requestId?: string,
  ) {
    super(message);
    this.name = 'CommerceAdminIntegrationError';
  }
}

interface CommerceAdminConfig {
  baseUrl: string;
  clientId: string;
  keyId: string;
  audience: string;
  workspaceId: string;
  signingSecret: Buffer;
}

function readEnvironmentValue(key: typeof COMMERCE_ADMIN_SERVER_ENVIRONMENT_KEYS[number]): string {
  return String(process.env[key] || '').trim();
}

export function isCommerceAdminIntegrationEnabled(
  value = process.env.COMMERCE_ADMIN_INTEGRATION_ENABLED,
): boolean {
  return value === 'true';
}

function assertSafeToken(value: string): boolean {
  return SAFE_TOKEN_PATTERN.test(value);
}

function decodeSigningSecret(secretBase64: string): Buffer | null {
  try {
    const secret = Buffer.from(secretBase64, 'base64');
    if (secret.length < 32 || secret.toString('base64') !== secretBase64) return null;
    return secret;
  } catch {
    return null;
  }
}

function readCommerceAdminConfig(): CommerceAdminConfig {
  if (!isCommerceAdminIntegrationEnabled()) {
    throw new CommerceAdminIntegrationError(
      'INTEGRATION_DISABLED',
      'Kết nối quản trị Commerce đang tắt.',
      503,
    );
  }

  const baseUrlValue = readEnvironmentValue('COMMERCE_ADMIN_API_BASE_URL');
  const clientId = readEnvironmentValue('COMMERCE_ADMIN_API_CLIENT_ID');
  const keyId = readEnvironmentValue('COMMERCE_ADMIN_API_KEY_ID');
  const audience = readEnvironmentValue('COMMERCE_ADMIN_API_AUDIENCE');
  const workspaceId = readEnvironmentValue('COMMERCE_ADMIN_API_WORKSPACE_ID');
  const signingSecret = decodeSigningSecret(readEnvironmentValue('COMMERCE_ADMIN_API_HMAC_SECRET_BASE64'));
  let baseUrl: URL;

  try {
    baseUrl = new URL(baseUrlValue);
  } catch {
    throw new CommerceAdminIntegrationError(
      'CONFIGURATION_INVALID',
      'Cấu hình địa chỉ Commerce Admin API không hợp lệ.',
      503,
    );
  }

  const hasOriginOnly = baseUrl.pathname === '/' && !baseUrl.search && !baseUrl.hash;
  const tokensValid = [clientId, keyId, audience, workspaceId].every(assertSafeToken);
  if (
    baseUrl.protocol !== 'https:' ||
    !hasOriginOnly ||
    baseUrl.username ||
    baseUrl.password ||
    !tokensValid ||
    !signingSecret
  ) {
    throw new CommerceAdminIntegrationError(
      'CONFIGURATION_INVALID',
      'Cấu hình xác thực Commerce Admin API chưa hợp lệ.',
      503,
    );
  }

  return {
    baseUrl: baseUrl.origin,
    clientId,
    keyId,
    audience,
    workspaceId,
    signingSecret,
  };
}

function toStableActorId(value: string | number | null | undefined): string {
  const normalized = String(value ?? '').trim();
  if (!assertSafeToken(normalized)) {
    throw new CommerceAdminIntegrationError(
      'AUTHORIZATION_DENIED',
      'Không thể xác định nhân sự thực hiện thao tác Commerce.',
      403,
    );
  }
  return normalized;
}

export async function requireCommerceAdminActor(
  capability: CommerceAdminCapability,
): Promise<CommerceAdminActor> {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(authContext, capability))) {
    throw new CommerceAdminIntegrationError(
      'AUTHORIZATION_DENIED',
      'Bạn không có quyền thực hiện thao tác quản trị Commerce.',
      403,
    );
  }

  return {
    authUserId: toStableActorId(authContext.authUserId),
    employeeId: toStableActorId(authContext.employee.id),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseResponseMeta(value: unknown, requestId: string) {
  if (!isRecord(value) || value.requestId !== requestId || value.contractVersion !== COMMERCE_ADMIN_CONTRACT_VERSION) {
    return null;
  }
  return {
    requestId,
    contractVersion: COMMERCE_ADMIN_CONTRACT_VERSION,
  } as const;
}

function parseCommerceAdminResponse<TData>(
  payload: unknown,
  requestId: string,
  isData: (value: unknown) => value is TData,
): CommerceAdminResponse<TData> | null {
  if (!isRecord(payload) || typeof payload.ok !== 'boolean') return null;
  const meta = parseResponseMeta(payload.meta, requestId);
  if (!meta) return null;

  if (payload.ok) {
    if (!isData(payload.data)) return null;
    return { ok: true, data: payload.data, meta };
  }

  if (!isRecord(payload.error) || typeof payload.error.code !== 'string' || typeof payload.error.message !== 'string' || typeof payload.error.retryable !== 'boolean') return null;
  return {
    ok: false,
    error: {
      code: payload.error.code,
      message: payload.error.message,
      retryable: payload.error.retryable,
    },
    meta,
  } satisfies CommerceAdminFailure;
}

function assertSafeEndpoint<TBody>(endpoint: CommerceAdminEndpoint<TBody>): void {
  const expectedPrefix = `${COMMERCE_ADMIN_MANAGEMENT_PREFIX}/`;
  if (
    !endpoint.path.startsWith(expectedPrefix) ||
    /(^|\/)\.\.?(\/|$)/.test(endpoint.path) ||
    endpoint.path.includes('?') ||
    endpoint.path.includes('#')
  ) {
    throw new CommerceAdminIntegrationError(
      'CONFIGURATION_INVALID',
      'Đường dẫn Commerce Admin API không hợp lệ.',
      503,
    );
  }
  if (endpoint.method === 'GET' && endpoint.body !== undefined) {
    throw new CommerceAdminIntegrationError(
      'CONFIGURATION_INVALID',
      'Yêu cầu đọc Commerce Admin API không được kèm nội dung.',
      503,
    );
  }
}

function serializeRequestBody(body: unknown): string {
  if (body === undefined) return '';
  try {
    const serialized = JSON.stringify(body);
    if (typeof serialized === 'string') return serialized;
  } catch {
    // Normalize serialization failures without exposing the payload.
  }
  throw new CommerceAdminIntegrationError('REQUEST_INVALID', 'Nội dung yêu cầu Commerce Admin API không hợp lệ.', 400);
}

export async function requestCommerceAdmin<TData, TBody>(
  endpoint: CommerceAdminEndpoint<TBody>,
  isData: (value: unknown) => value is TData,
): Promise<TData> {
  assertSafeEndpoint(endpoint);
  const config = readCommerceAdminConfig();
  const actor = await requireCommerceAdminActor(endpoint.capability);
  const requestId = randomUUID();
  const nonce = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const body = serializeRequestBody(endpoint.body);
  if (Buffer.byteLength(body, 'utf8') > MAX_REQUEST_BYTES) {
    throw new CommerceAdminIntegrationError('REQUEST_INVALID', 'Yêu cầu Commerce Admin API quá lớn.', 413);
  }

  const bodyDigest = createCommerceAdminBodyDigest(body);
  const signature = createCommerceAdminSignature({
    audience: config.audience,
    bodyDigest,
    clientId: config.clientId,
    keyId: config.keyId,
    method: endpoint.method,
    nonce,
    actorId: actor.authUserId,
    workspaceId: config.workspaceId,
    path: endpoint.path,
    requestId,
    scope: endpoint.scope,
    timestamp,
  }, config.signingSecret);

  let response: Response;
  try {
    response = await fetch(`${config.baseUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers: {
        Accept: COMMERCE_ADMIN_CONTENT_TYPE,
        'Content-Type': COMMERCE_ADMIN_CONTENT_TYPE,
        'X-Luminal-Signature-Version': COMMERCE_ADMIN_SIGNATURE_VERSION,
        'X-Luminal-Client-Id': config.clientId,
        'X-Luminal-Key-Id': config.keyId,
        'X-Luminal-Audience': config.audience,
        'X-Luminal-Request-Id': requestId,
        'X-Luminal-Timestamp': String(timestamp),
        'X-Luminal-Nonce': nonce,
        'X-Luminal-Actor-Id': actor.authUserId,
        'X-Luminal-Workspace-Id': config.workspaceId,
        'X-Luminal-Scope': endpoint.scope,
        'X-Luminal-Body-SHA256': bodyDigest,
        'X-Luminal-Signature': signature,
      },
      body: body || undefined,
      cache: 'no-store',
      redirect: 'error',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    throw new CommerceAdminIntegrationError(
      timedOut ? 'REQUEST_TIMEOUT' : 'REMOTE_UNAVAILABLE',
      timedOut ? 'Commerce Admin API phản hồi quá thời gian.' : 'Không thể kết nối Commerce Admin API.',
      503,
      true,
      requestId,
    );
  }

  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_RESPONSE_BYTES) {
    throw new CommerceAdminIntegrationError('INVALID_RESPONSE', 'Commerce Admin API trả dữ liệu quá lớn.', 502, false, requestId);
  }

  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    throw new CommerceAdminIntegrationError('REMOTE_UNAVAILABLE', 'Không thể đọc phản hồi Commerce Admin API.', 503, true, requestId);
  }
  if (Buffer.byteLength(responseText, 'utf8') > MAX_RESPONSE_BYTES) {
    throw new CommerceAdminIntegrationError('INVALID_RESPONSE', 'Commerce Admin API trả dữ liệu quá lớn.', 502, false, requestId);
  }

  let payload: unknown;
  try {
    payload = JSON.parse(responseText);
  } catch {
    throw new CommerceAdminIntegrationError('INVALID_RESPONSE', 'Commerce Admin API trả dữ liệu không hợp lệ.', 502, false, requestId);
  }

  const parsed = parseCommerceAdminResponse(payload, requestId, isData);
  if (!parsed) {
    throw new CommerceAdminIntegrationError('INVALID_RESPONSE', 'Commerce Admin API trả sai contract.', 502, false, requestId);
  }
  if (!response.ok || !parsed.ok) {
    const failure = parsed.ok ? null : parsed;
    throw new CommerceAdminIntegrationError(
      'REMOTE_REJECTED',
      failure?.error.message || 'Commerce Admin API từ chối yêu cầu.',
      response.status >= 400 && response.status < 600 ? response.status : 502,
      failure?.error.retryable || false,
      requestId,
    );
  }

  return parsed.data;
}
