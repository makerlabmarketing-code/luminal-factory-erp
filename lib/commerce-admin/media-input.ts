import { UUID_PATTERN } from './product-input';
export const MEDIA_MAX_BYTES = 2 * 1024 * 1024;
export const MEDIA_MAX_COUNT = 20;
export type MediaTarget = { productId: string; variantId: string | null };
export type MediaAsset = { id: string; path: string; fileName: string; sizeBytes: number; width: number; height: number; alt: string; removed: boolean };
export type MediaManifest = MediaTarget & { revision: number; assets: MediaAsset[]; primaryId: string | null };
export type MediaPresentation = MediaManifest & { previews: { id: string; url: string }[] };
export type MediaTicketInput = { assetId: string; fileName: string; sizeBytes: number };
export type MediaTicket = Omit<MediaTicketInput, 'fileName'> & { path: string; signedUrl: string; expiresInSeconds: number };
export type MediaMutation = { operationId: string; expectedRevision: number } & ({ asset: MediaAsset } | { assets: { id: string; alt: string; removed: boolean }[]; primaryId: string | null });
function obj(v: unknown): v is Record<string, unknown> { return !!v && typeof v === 'object' && !Array.isArray(v); }
function keys(v: Record<string, unknown>, names: string[]) { return Object.keys(v).length === names.length && names.every(k => k in v); }
function integer(v: unknown, min: number, max: number) { return typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max; }
export function mediaPath(t: MediaTarget, id: string) { return `${t.productId}/${t.variantId ?? 'product'}/${id}.webp`; }
export function isMediaAsset(v: unknown): v is MediaAsset {
  return obj(v) && keys(v,['id','path','fileName','sizeBytes','width','height','alt','removed']) && typeof v.id === 'string' && UUID_PATTERN.test(v.id) && typeof v.path === 'string' && typeof v.fileName === 'string' && v.fileName.trim().length > 0 && v.fileName.length <= 180 && !/[\\/]/.test(v.fileName) && integer(v.sizeBytes,1,MEDIA_MAX_BYTES) && integer(v.width,1,2048) && integer(v.height,1,2048) && typeof v.alt === 'string' && v.alt.length <= 500 && typeof v.removed === 'boolean';
}
export function isMediaManifest(v: unknown, t: MediaTarget): v is MediaManifest {
  if (!obj(v) || v.productId !== t.productId || v.variantId !== t.variantId || !integer(v.revision,0,2147483647) || !Array.isArray(v.assets) || v.assets.length > 120 || !v.assets.every(isMediaAsset) || v.assets.some(a => a.path !== mediaPath(t,a.id))) return false;
  const active = v.assets.filter(a => !a.removed);
  return new Set(v.assets.map(a => a.id)).size === v.assets.length && active.length <= MEDIA_MAX_COUNT && (active.length === 0 ? v.primaryId === null : active.some(a => a.id === v.primaryId));
}
function https(v: unknown) { try { return typeof v === 'string' && new URL(v).protocol === 'https:'; } catch { return false; } }
export function isMediaPresentation(v: unknown, t: MediaTarget): v is MediaPresentation {
  if (!obj(v) || !Array.isArray(v.previews)) return false;
  const previews = v.previews;
  return isMediaManifest(v,t) && previews.length === v.assets.length && previews.every(p => obj(p) && typeof p.id === 'string' && v.assets.some(a => a.id === p.id) && https(p.url)) && new Set(previews.map(p => p.id)).size === previews.length;
}
export function isMediaTicket(v: unknown, t: MediaTarget, input: MediaTicketInput): v is MediaTicket {
  if (!obj(v) || v.assetId !== input.assetId || v.path !== mediaPath(t,input.assetId) || v.sizeBytes !== input.sizeBytes || v.expiresInSeconds !== 7200 || !https(v.signedUrl)) return false;
  const url = new URL(v.signedUrl as string);
  const expected = new URL(`https://storage.invalid/storage/v1/object/upload/sign/catalog-media-drafts/${mediaPath(t,input.assetId)}`).pathname;
  return url.pathname === expected && !!url.searchParams.get('token') && !url.username && !url.password;
}
export function parseMediaTicketInput(v: unknown): MediaTicketInput | null {
  return obj(v) && keys(v,['assetId','fileName','sizeBytes']) && typeof v.assetId === 'string' && UUID_PATTERN.test(v.assetId) && typeof v.fileName === 'string' && v.fileName.trim().length > 0 && v.fileName.length <= 180 && !/[\\/]/.test(v.fileName) && integer(v.sizeBytes,1,MEDIA_MAX_BYTES) ? { assetId:v.assetId,fileName:v.fileName.trim(),sizeBytes:v.sizeBytes as number } : null;
}
export function parseMediaMutation(v: unknown, append: boolean): MediaMutation | null {
  if (!obj(v) || typeof v.operationId !== 'string' || !UUID_PATTERN.test(v.operationId) || !integer(v.expectedRevision,0,2147483646)) return null;
  if (append) return keys(v,['operationId','expectedRevision','asset']) && isMediaAsset(v.asset) && !v.asset.removed ? v as MediaMutation : null;
  if (!keys(v,['operationId','expectedRevision','assets','primaryId']) || !Array.isArray(v.assets) || v.assets.length > 120 || !v.assets.every(a => obj(a) && keys(a,['id','alt','removed']) && typeof a.id === 'string' && UUID_PATTERN.test(a.id) && typeof a.alt === 'string' && a.alt.length <= 500 && typeof a.removed === 'boolean') || new Set(v.assets.map(a => a.id)).size !== v.assets.length || v.primaryId !== null && (typeof v.primaryId !== 'string' || !UUID_PATTERN.test(v.primaryId))) return null;
  return v as MediaMutation;
}
export function mediaEditorPath(t: MediaTarget) { return `/api/admin/commerce/products/${t.productId}${t.variantId ? `/colorways/${t.variantId}` : ''}/media`; }
