'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { CommerceColorwayDraft, CommerceColorwayRecord, CommerceProductRecord } from '@/lib/commerce-admin/contracts';
import { isColorwayRecord, parseColorwayDraft } from '@/lib/commerce-admin/colorway-input';
import { useCommerceFeedback } from '@/lib/commerce-admin/use-commerce-feedback';
import { createCommerceMutationRetry } from '@/lib/commerce-admin/mutation-retry';

const inputClass = 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm';
const buttonClass = 'rounded-md border border-slate-700 px-3 py-2 text-sm disabled:opacity-40';
const empty = (): CommerceColorwayDraft => ({ name: '', slug: '', description: '' });
export default function ColorwayManagerClient({ products, canManage, integrationEnabled }: {
  products: CommerceProductRecord[]; canManage: boolean; integrationEnabled: boolean;
}) {
  const [productId, setProductId] = useState('');
  const [rows, setRows] = useState<CommerceColorwayRecord[]>([]);
  const [draft, setDraft] = useState<CommerceColorwayDraft | null>(null);
  const [variantId, setVariantId] = useState<string | null>(null);
  const [original, setOriginal] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const { message, setMessage, success, error, loaded } = useCommerceFeedback();
  const [reload, setReload] = useState(0);
  const lock = useRef(false);
  const retry = useRef(createCommerceMutationRetry());
  const product = products.find(row => row.id === productId);
  const editable = canManage && product?.status === 'draft' && integrationEnabled;
  const dirty = draft !== null && JSON.stringify(draft) !== original;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  useEffect(() => {
    if (!productId || !integrationEnabled) return;
    const controller = new AbortController();
    setLoading(true); setMessage(''); setRows([]);
    fetch(`/api/admin/commerce/products/${encodeURIComponent(productId)}/colorways`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        const result: unknown = await response.json();
        if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('colorways' in result) || !Array.isArray(result.colorways) || result.colorways.length > 200 || !result.colorways.every(row => isColorwayRecord(row) && row.product_id === productId)) throw new Error('invalid');
        if (!controller.signal.aborted) { setRows(result.colorways); loaded('Danh sách phối màu đã được cập nhật.'); }
      }).catch(() => { if (!controller.signal.aborted) error('Không thể tải phối màu. Vui lòng tải lại.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [productId, integrationEnabled, reload, loaded, error, setMessage]);
  function mayLeave() { return !lock.current && (!dirty || window.confirm('Phối màu chưa được lưu. Bạn có muốn bỏ thay đổi?')); }
  function choose(next: string) {
    if (!mayLeave()) return;
    setProductId(next); setLoading(false); setRows([]); setDraft(null); setVariantId(null); setMessage('');
  }
  function edit(row?: CommerceColorwayRecord) {
    if (!editable || !mayLeave()) return;
    const next = row ? parseColorwayDraft({ name: row.name, slug: row.slug ?? '', description: row.description }) : empty();
    if (!next) { error('Phối màu cũ chưa có đường dẫn hợp lệ. Cần kiểm tra dữ liệu trước khi chỉnh sửa.'); return; }
    setDraft(next); setVariantId(row?.id ?? null); setOriginal(JSON.stringify(next)); setMessage('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !editable || loading) return;
    const normalized = parseColorwayDraft(draft);
    if (!normalized) { error('Vui lòng kiểm tra tên và đường dẫn phối màu.'); return; }
    lock.current = true; setBusy(true); setMessage('');
    const path = `/api/admin/commerce/products/${encodeURIComponent(productId)}/colorways${variantId ? `/${encodeURIComponent(variantId)}` : ''}`;
    const method = variantId ? 'PATCH' : 'POST';
    const operationId = retry.current.prepare(path, method, normalized);
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId, draft: normalized }) });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true) {
        error(response.status === 409 ? 'Đường dẫn đã được dùng hoặc sản phẩm không còn là bản nháp. Kiểm tra lại trước khi lưu.' : response.status === 403 ? 'Bạn không có quyền lưu phối màu.' : 'Không thể lưu phối màu. Thông tin đã được giữ để thử lại.'); return;
      }
      const row = 'colorway' in result ? result.colorway : null;
      if (!isColorwayRecord(row) || row.product_id !== productId || row.is_active || (variantId && row.id !== variantId)) throw new Error('invalid');
      const confirmed = parseColorwayDraft({ name: row.name, slug: row.slug, description: row.description });
      if (!confirmed) throw new Error('invalid');
      retry.current.confirm(operationId);
      setRows(current => [row, ...current.filter(existing => existing.id !== row.id)]);
      setVariantId(row.id); setDraft(confirmed); setOriginal(JSON.stringify(confirmed)); success('Đã lưu bản nháp phối màu.');
    } catch { error('Chưa xác nhận kết quả lưu. Thử lại với cùng thông tin để tránh tạo trùng phối màu.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="admin-card space-y-4 p-5" aria-labelledby="colorway-heading">
    <h2 id="colorway-heading" className="font-semibold">Phối màu theo sản phẩm</h2>
    <p className="text-sm text-slate-400">Mỗi phối màu thuộc một sản phẩm. Bản nháp chưa hiển thị công khai; chỉ sửa phối màu chưa kích hoạt của sản phẩm nháp.</p>
    <label className="block space-y-2 text-sm">Sản phẩm<select className={inputClass} value={productId} disabled={busy} onChange={event => choose(event.target.value)}><option value="">Chọn sản phẩm</option>{products.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    {!integrationEnabled && <p role="status">Kết nối Commerce đang tắt.</p>}
    {productId && integrationEnabled && <div className="flex flex-wrap gap-2">
      <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => { if (mayLeave()) { setDraft(null); setReload(value => value + 1); } }}>Tải lại phối màu</button>
      {editable && <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => edit()}>Thêm phối màu</button>}
    </div>}
    {message && <p role="status" aria-live="polite" className="text-sm">{message}</p>}
    {loading && <p role="status">Đang tải phối màu…</p>}
    {!loading && productId && integrationEnabled && <ul className="divide-y divide-slate-800">{rows.map(row => <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3"><div><strong>{row.name}</strong><p className="text-xs text-slate-400">{row.slug ?? 'Chưa có đường dẫn'} · {row.is_active ? 'Đã kích hoạt' : 'Bản nháp / chưa kích hoạt'}</p></div>{editable && !row.is_active && row.slug && <button type="button" className={buttonClass} disabled={busy} onClick={() => edit(row)}>Sửa phối màu {row.name}</button>}</li>)}{rows.length === 0 && !message && <li className="text-sm text-slate-400">Chưa có phối màu.</li>}</ul>}
    {draft && <form onSubmit={save} className="space-y-4 border-t border-slate-800 pt-4">
      <h3>{variantId ? 'Chỉnh sửa phối màu nháp' : 'Phối màu mới'}</h3>
      <fieldset disabled={busy || !editable} className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm">Tên phối màu<input className={inputClass} required maxLength={160} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
        <label className="space-y-2 text-sm">Đường dẫn phối màu<input className={inputClass} required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} /></label>
        <label className="space-y-2 text-sm md:col-span-2">Mô tả phối màu<textarea className={inputClass} rows={4} maxLength={5000} value={draft.description ?? ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
      </fieldset>
      <div className="flex gap-2"><button className={buttonClass} disabled={busy || !editable || loading}>{busy ? 'Đang lưu…' : 'Lưu phối màu nháp'}</button><button type="button" className={buttonClass} disabled={busy} onClick={() => { if (mayLeave()) setDraft(null); }}>Hủy phối màu</button></div>
    </form>}
  </section>;
}
