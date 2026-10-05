import { UUID_PATTERN } from './product-input';
import type { CommerceAdminEndpoint } from './contracts';

export const TRANSLATION_FIELDS = {
  title: { label: 'Tên hiển thị', max: 160 },
  description: { label: 'Mô tả', max: 5000 },
  story: { label: 'Câu chuyện', max: 8000 },
  seoTitle: { label: 'Tiêu đề tìm kiếm', max: 180 },
  seoDescription: { label: 'Mô tả tìm kiếm', max: 500 },
  primaryMediaAlt: { label: 'Mô tả ảnh chính', max: 500 },
} as const;
export const TRANSLATION_LANGUAGE_LABELS = { en: 'Tiếng Anh', vi: 'Tiếng Việt' } as const;
export type TranslationLocale = keyof typeof TRANSLATION_LANGUAGE_LABELS;
export type TranslationContent = { -readonly [K in keyof typeof TRANSLATION_FIELDS]: string | null };
export type TranslationDraft = { content: TranslationContent; ready: boolean };
export type TranslationMutation = { operationId: string; expectedRevision: number; draft: TranslationDraft };
export type TranslationTarget = { productId: string; variantId: string | null; locale: TranslationLocale };
export type TranslationRecord = TranslationTarget & TranslationDraft & { revision: number; updatedAt: string };
function object(value: unknown): value is Record<string, unknown> { return Boolean(value && typeof value === 'object' && !Array.isArray(value)); }
function keys(value: Record<string, unknown>, allowed: string[]) { return Object.keys(value).every(key => allowed.includes(key)) && allowed.every(key => key in value); }
export function isTranslationLocale(value: string): value is TranslationLocale { return value === 'en' || value === 'vi'; }
export function emptyTranslation(): TranslationDraft {
  return { content: { title: null, description: null, story: null, seoTitle: null, seoDescription: null, primaryMediaAlt: null }, ready: false };
}
export function parseTranslationDraft(value: unknown): TranslationDraft | null {
  if (!object(value) || !keys(value, ['content', 'ready']) || typeof value.ready !== 'boolean' || !object(value.content) || !keys(value.content, Object.keys(TRANSLATION_FIELDS))) return null;
  const content = emptyTranslation().content;
  for (const key of Object.keys(TRANSLATION_FIELDS) as (keyof TranslationContent)[]) {
    const raw = value.content[key];
    if (raw !== null && typeof raw !== 'string') return null;
    const text = typeof raw === 'string' ? raw.trim() : null;
    if (text !== null && text.length > TRANSLATION_FIELDS[key].max) return null;
    content[key] = text || null;
  }
  if (value.ready && (!content.title || !content.description)) return null;
  return { content, ready: value.ready };
}
export function parseTranslationMutation(value: unknown): TranslationMutation | null {
  if (!object(value) || !keys(value, ['operationId', 'expectedRevision', 'draft']) || typeof value.operationId !== 'string' || !UUID_PATTERN.test(value.operationId) || !Number.isInteger(value.expectedRevision) || typeof value.expectedRevision !== 'number' || value.expectedRevision < 0 || value.expectedRevision > 2147483646) return null;
  const draft = parseTranslationDraft(value.draft);
  return draft ? { operationId: value.operationId, expectedRevision: value.expectedRevision, draft } : null;
}
export function isTranslationRecord(value: unknown): value is TranslationRecord {
  if (!object(value) || !keys(value, ['productId', 'variantId', 'locale', 'revision', 'updatedAt', 'content', 'ready'])) return false;
  return typeof value.productId === 'string' && UUID_PATTERN.test(value.productId)
    && (value.variantId === null || typeof value.variantId === 'string' && UUID_PATTERN.test(value.variantId))
    && typeof value.locale === 'string' && isTranslationLocale(value.locale)
    && typeof value.revision === 'number' && Number.isInteger(value.revision) && value.revision > 0 && value.revision <= 2147483647
    && typeof value.updatedAt === 'string' && !Number.isNaN(Date.parse(value.updatedAt))
    && parseTranslationDraft({ content: value.content, ready: value.ready }) !== null;
}
export function matchesTranslationTarget(value: unknown, target: TranslationTarget): value is TranslationRecord {
  return isTranslationRecord(value) && value.productId === target.productId && value.variantId === target.variantId && value.locale === target.locale;
}
export function translationTargetKey(target: TranslationTarget): string {
  return `${target.productId}:${target.variantId ?? 'product'}:${target.locale}`;
}
export function translationEditorPath(target: TranslationTarget): string {
  return `/api/admin/commerce/products/${encodeURIComponent(target.productId)}${target.variantId ? `/colorways/${encodeURIComponent(target.variantId)}` : ''}/translations/${target.locale}`;
}
export function translationEndpoint(target: TranslationTarget, mutation?: TranslationMutation): CommerceAdminEndpoint<TranslationMutation> {
  const path = `/api/admin/v1/products/${encodeURIComponent(target.productId)}${target.variantId ? `/colorways/${encodeURIComponent(target.variantId)}` : ''}/translations/${target.locale}`;
  return { path, method: mutation ? 'PATCH' : 'GET', capability: mutation ? 'COMMERCE_PRODUCT_MANAGE' : 'COMMERCE_PRODUCT_VIEW', scope: mutation ? 'commerce.product.write' : 'commerce.product.read', ...(mutation ? { body: mutation } : {}) };
}
