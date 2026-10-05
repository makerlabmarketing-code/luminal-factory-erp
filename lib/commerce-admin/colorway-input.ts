import type { CommerceColorwayDraft, CommerceColorwayMutation, CommerceColorwayRecord } from './contracts';
import { UUID_PATTERN } from './product-input';
function object(value: unknown): value is Record<string, unknown> { return value !== null && typeof value === 'object' && !Array.isArray(value); }
export function parseColorwayDraft(value: unknown): CommerceColorwayDraft | null {
  if (!object(value) || Object.keys(value).some(key => !['name', 'slug', 'description'].includes(key)) || typeof value.name !== 'string' || typeof value.slug !== 'string') return null;
  const name = value.name.trim(); const slug = value.slug.trim();
  if (!name || name.length > 160 || slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return null;
  if (value.description !== null && value.description !== undefined && typeof value.description !== 'string') return null;
  const description = typeof value.description === 'string' ? value.description.trim() : null;
  if (description !== null && description.length > 5000) return null;
  return { name, slug, description };
}
export function parseColorwayMutation(value: unknown): CommerceColorwayMutation | null {
  if (!object(value) || Object.keys(value).some(key => !['operationId', 'draft'].includes(key)) || typeof value.operationId !== 'string' || !UUID_PATTERN.test(value.operationId)) return null;
  const draft = parseColorwayDraft(value.draft);
  return draft ? { operationId: value.operationId, draft } : null;
}
export function isColorwayRecord(value: unknown): value is CommerceColorwayRecord {
  return object(value) && typeof value.id === 'string' && UUID_PATTERN.test(value.id)
    && typeof value.product_id === 'string' && UUID_PATTERN.test(value.product_id)
    && typeof value.name === 'string' && (value.slug === null || typeof value.slug === 'string')
    && (value.description === null || typeof value.description === 'string')
    && typeof value.is_active === 'boolean' && typeof value.created_at === 'string' && typeof value.updated_at === 'string';
}
