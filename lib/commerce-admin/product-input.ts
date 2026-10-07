import type { CommerceProductDraft, CommerceProductDraftMutation, CommerceProductRecord } from './contracts';

export const PRODUCT_TYPE_LABELS = {
  artisan_keycap: 'Keycap thủ công', collectible_object: 'Đồ sưu tầm',
  custom_object: 'Đồ tùy chỉnh', other: 'Khác',
} as const;
export const PRODUCT_RELEASE_LABELS = {
  direct: 'Bán trực tiếp', preorder: 'Đặt trước', informational: 'Giới thiệu / raffle',
} as const;
export const PRODUCT_STATUS_LABELS = {
  draft: 'Bản nháp', published: 'Đã xuất bản', archived: 'Đã lưu trữ',
} as const;
export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]) {
  return Object.keys(value).every(key => keys.includes(key));
}
export function parseCommerceProductDraft(value: unknown, preserveExistingRelease = false): CommerceProductDraft | null {
  if (!record(value) || !exactKeys(value, ['slug', 'name', 'description', 'productType', 'releaseType'])) return null;
  if (typeof value.slug !== 'string' || typeof value.name !== 'string') return null;
  const slug = value.slug.trim();
  const name = value.name.trim();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 120 || !name || name.length > 160) return null;
  if (value.description !== undefined && value.description !== null && typeof value.description !== 'string') return null;
  const description = typeof value.description === 'string' ? value.description.trim() : null;
  if (description !== null && description.length > 5000) return null;
  const productType = value.productType;
  const releaseType = value.releaseType;
  if (productType !== 'artisan_keycap' && productType !== 'collectible_object' && productType !== 'custom_object' && productType !== 'other') return null;
  if (releaseType !== 'direct' && releaseType !== 'preorder' && releaseType !== 'informational') return null;
  if (!preserveExistingRelease && productType === 'artisan_keycap' && releaseType !== 'informational') return null;
  return { slug, name, description, productType, releaseType };
}
export function parseCommerceProductDraftMutation(value: unknown, preserveExistingRelease = false): CommerceProductDraftMutation | null {
  if (!record(value) || !exactKeys(value, ['operationId', 'draft']) || typeof value.operationId !== 'string' || !UUID_PATTERN.test(value.operationId)) return null;
  const draft = parseCommerceProductDraft(value.draft, preserveExistingRelease);
  return draft ? { operationId: value.operationId, draft } : null;
}

export function isProductRecord(value: unknown): value is CommerceProductRecord {
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

