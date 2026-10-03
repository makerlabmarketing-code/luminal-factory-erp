'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CommerceProductRecord } from '@/lib/commerce-admin/contracts';
import { createCommerceMutationRetry } from '@/lib/commerce-admin/mutation-retry';
import { emptyTranslation, isTranslationLocale, matchesTranslationTarget, parseTranslationDraft, TRANSLATION_FIELDS, TRANSLATION_LANGUAGE_LABELS, type TranslationContent, type TranslationDraft, type TranslationLocale } from '@/lib/commerce-admin/translation-input';

const inputClass = 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
const buttonClass = 'rounded-md border border-slate-700 px-3 py-2 text-sm disabled:opacity-40';
export default function TranslationManagerClient({ products, canManage, integrationEnabled }: {
  products: CommerceProductRecord[]; canManage: boolean; integrationEnabled: boolean;
}) {
  const [productId, setProductId] = useState('');
  const [locale, setLocale] = useState<TranslationLocale>('en');
  const [draft, setDraft] = useState<TranslationDraft>(emptyTranslation);
  const [baseline, setBaseline] = useState(JSON.stringify(emptyTranslation()));
  const [revision, setRevision] = useState(0);
  const [loadedKey, setLoadedKey] = useState('');
  const selectedKey = `${productId}:${locale}`;
  const loaded = loadedKey === selectedKey;
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [refresh, setRefresh] = useState(0);
  const lock = useRef(false);
  const retry = useRef(createCommerceMutationRetry());
  const dirty = JSON.stringify(draft) !== baseline;
  const product = products.find(row => row.id === productId);
  const canEdit = canManage && Boolean(product) && product?.status !== 'archived';
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    const abort = new AbortController();
    setLoadedKey(''); setMessage(''); setRevision(0);
    const blank = emptyTranslation(); setDraft(blank); setBaseline(JSON.stringify(blank));
    if (!productId || !integrationEnabled) { setLoading(false); return () => abort.abort(); }
    setLoading(true);
    const target = { productId, variantId: null, locale };
    void fetch(`/api/admin/commerce/products/${encodeURIComponent(productId)}/translations/${locale}`, { signal: abort.signal, cache: 'no-store' })
      .then(async response => {
        const result: unknown = await response.json();
        if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('translation' in result) || result.translation !== null && !matchesTranslationTarget(result.translation, target)) throw new Error('invalid_read');
        if (abort.signal.aborted) return;
        const row = result.translation;
        const next = row ? parseTranslationDraft({ content: row.content, ready: row.ready })! : blank;
        setDraft(next); setBaseline(JSON.stringify(next)); setRevision(row?.revision ?? 0); setLoadedKey(`${productId}:${locale}`);
      }).catch(() => { if (!abort.signal.aborted) setMessage('Chưa tải được bản dịch. Tải lại trước khi chỉnh sửa.'); })
      .finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  }, [productId, locale, integrationEnabled, refresh]);
  function discardAllowed() { return !lock.current && (!dirty || window.confirm('Bản dịch chưa được lưu. Bạn có muốn bỏ thay đổi?')); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !canEdit || !loaded || !integrationEnabled || !product) return;
    const normalized = parseTranslationDraft(draft);
    if (!normalized) { setMessage('Vui lòng nhập tên và mô tả trước khi đánh dấu sẵn sàng duyệt.'); return; }
    const target = { productId, variantId: null, locale };
    const path = `/api/admin/commerce/products/${encodeURIComponent(productId)}/translations/${locale}`;
    const payload = { expectedRevision: revision, draft: normalized };
    const operationId = retry.current.prepare(path, 'PATCH', payload);
    lock.current = true; setBusy(true); setMessage('');
    try {
      const response = await fetch(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId, ...payload }) });
      const result: unknown = await response.json();
      if (!response.ok) { setMessage(response.status === 409 ? 'Bản dịch đã thay đổi. Sao chép nội dung cần giữ rồi tải lại trước khi lưu.' : response.status === 403 ? 'Bạn không có quyền lưu bản dịch.' : 'Chưa lưu được bản dịch. Nội dung được giữ lại để thử lại.'); return; }
      if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('translation' in result) || !matchesTranslationTarget(result.translation, target)) throw new Error('invalid_save');
      const saved = result.translation;
      if (saved.revision !== revision + 1 || saved.ready !== normalized.ready || Object.keys(TRANSLATION_FIELDS).some(key => saved.content[key as keyof TranslationContent] !== normalized.content[key as keyof TranslationContent])) throw new Error('invalid_save');
      retry.current.confirm(operationId); setDraft(normalized); setBaseline(JSON.stringify(normalized)); setRevision(result.translation.revision);
      setMessage('Đã lưu bản nháp dịch. Nội dung công khai chưa thay đổi.');
    } catch { setMessage('Chưa xác nhận được kết quả lưu. Thử lại với cùng nội dung để tránh ghi trùng.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="admin-card space-y-4 p-5" aria-labelledby="translation-heading">
    <div><h2 id="translation-heading" className="font-semibold">Bản dịch sản phẩm</h2><p className="mt-1 text-sm text-slate-400">Soạn tiếng Anh và tiếng Việt cho cùng một sản phẩm. Lưu nháp hoặc đánh dấu sẵn sàng duyệt chưa đưa nội dung lên website.</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="space-y-1 text-sm">Sản phẩm<select className={inputClass} disabled={busy} value={productId} onChange={event => { if (discardAllowed()) setProductId(event.target.value); }}><option value="">Chọn sản phẩm</option>{products.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="space-y-1 text-sm">Ngôn ngữ<select className={inputClass} disabled={busy} value={locale} onChange={event => { if (isTranslationLocale(event.target.value) && discardAllowed()) setLocale(event.target.value); }}>{Object.entries(TRANSLATION_LANGUAGE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
    </div>
    {!integrationEnabled && <p className="text-sm text-amber-200">Kết nối đang tắt. Bản soạn tại đây chưa được lưu và sẽ mất khi tải lại trang.</p>}
    {loading && <p role="status">Đang tải bản dịch…</p>}
    {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
    {product && <form onSubmit={save} className="space-y-4">
      <p className="text-xs text-slate-400">Nguồn hiện có: {product.name}. {loaded ? `Phiên bản bản nháp: ${revision}.` : ''} {product.status === 'archived' ? 'Sản phẩm đã lưu trữ, chỉ xem bản dịch.' : ''}</p>
      <fieldset disabled={busy || loading || !canEdit || integrationEnabled && !loaded} className="grid gap-4 md:grid-cols-2">
        {(Object.keys(TRANSLATION_FIELDS) as (keyof TranslationContent)[]).map(key => <label key={key} className={`space-y-1 text-sm ${key === 'description' || key === 'story' ? 'md:col-span-2' : ''}`}>{TRANSLATION_FIELDS[key].label}<textarea rows={key === 'story' ? 5 : key === 'description' ? 3 : 2} maxLength={TRANSLATION_FIELDS[key].max} lang={locale} className={inputClass} value={draft.content[key] ?? ''} onChange={event => setDraft({ ...draft, content: { ...draft.content, [key]: event.target.value || null } })} /><span className="block text-xs text-slate-500">Tối đa {TRANSLATION_FIELDS[key].max} ký tự</span></label>)}
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" checked={draft.ready} onChange={event => setDraft({ ...draft, ready: event.target.checked })} />Sẵn sàng duyệt — cần tên và mô tả</label>
      </fieldset>
      <div className="flex flex-wrap gap-2">{canManage && <button className={buttonClass} disabled={busy || !canEdit || !integrationEnabled || !loaded}>{busy ? 'Đang lưu…' : 'Lưu bản nháp dịch'}</button>}<button type="button" className={buttonClass} disabled={busy || loading || !integrationEnabled} onClick={() => { if (discardAllowed()) setRefresh(current => current + 1); }}>Tải lại bản dịch</button></div>
    </form>}
  </section>;
}
