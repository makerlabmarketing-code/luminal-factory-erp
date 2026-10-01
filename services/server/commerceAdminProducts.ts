import 'server-only';

import {
  commerceProductEndpoints,
  type CommerceProductRecord,
} from '@/lib/commerce-admin/contracts';
import { requestCommerceAdmin } from '@/services/server/commerceAdminIntegration';

function isProductRecord(value: unknown): value is CommerceProductRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string'
    && typeof row.slug === 'string'
    && typeof row.name === 'string'
    && (row.description === null || typeof row.description === 'string')
    && typeof row.product_type === 'string'
    && typeof row.release_type === 'string'
    && ['draft', 'published', 'archived'].includes(String(row.status))
    && (row.published_at === null || typeof row.published_at === 'string')
    && typeof row.created_at === 'string'
    && typeof row.updated_at === 'string';
}

export async function listCommerceProducts(): Promise<CommerceProductRecord[]> {
  return requestCommerceAdmin(
    commerceProductEndpoints.list(),
    (value): value is CommerceProductRecord[] =>
      Array.isArray(value) && value.length <= 200 && value.every(isProductRecord),
  );
}
