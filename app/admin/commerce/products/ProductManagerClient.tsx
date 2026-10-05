'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { CommerceProductDraft, CommerceProductRecord } from '@/lib/commerce-admin/contracts';
import { createCommerceMutationRetry } from '@/lib/commerce-admin/mutation-retry';
import { isProductRecord, parseCommerceProductDraft, PRODUCT_RELEASE_LABELS, PRODUCT_STATUS_LABELS, PRODUCT_TYPE_LABELS } from '@/lib/commerce-admin/product-input';

import TranslationManagerClient from './TranslationManagerClient';
import ColorwayManagerClient from './ColorwayManagerClient';

const emptyDraft = (): CommerceProductDraft => ({ name: '', slug: '', description: '', productType: 'artisan_keycap', releaseType: 'informational' });
const inputClass = 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100';
const buttonClass = 'rounded-md border border-slate-700 px-3 py-2 text-sm disabled:opacity-40';

export default function ProductManagerClient({ initialProducts, canManage, integrationEnabled, loadError }: {
  initialProducts: CommerceProductRecord[]; canManage: boolean; integrationEnabled: boolean; loadError: string | null;
}) {
  const router = useRouter();
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CommerceProductDraft | null>(null);
  const [savedDraft, setSavedDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const retry = useRef(createCommerceMutationRetry());
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  const dirty = draft !== null && JSON.stringify(draft) !== savedDraft;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function selectProduct(product?: CommerceProductRecord) {
    if (lock.current || (dirty && !window.confirm('Thông tin chưa được lưu. Bạn có muốn bỏ thay đổi?'))) return;
    const next = product ? parseCommerceProductDraft({ name: product.name, slug: product.slug, description: product.description, productType: product.product_type, releaseType: product.release_type }) : emptyDraft();
    setEditingId(product?.id ?? null);
    setDraft(next);
    setSavedDraft(JSON.stringify(next));
    setMessage('');
  }
  function cancel() {
    if (lock.current || (dirty && !window.confirm('Thông tin chưa được lưu. Bạn có muốn bỏ thay đổi?'))) return;
    setDraft(null); setEditingId(null); setMessage('');
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || !canManage || !integrationEnabled) return;
    const normalized = parseCommerceProductDraft(draft);
    if (!normalized) { setMessage('Vui lòng kiểm tra tên, đường dẫn và cách phát hành sản phẩm.'); return; }
    lock.current = true; setBusy(true); setMessage('');
    const path = editingId ? `/api/admin/commerce/products/${encodeURIComponent(editingId)}` : '/api/admin/commerce/products';
    const method = editingId ? 'PATCH' : 'POST';
    const operationId = retry.current.prepare(path, method, normalized);
    try {
      const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ operationId, draft: normalized }) });
      const result: unknown = await response.json();
      if (!response.ok || !result || typeof result !== 'object' || !('success' in result) || result.success !== true) {
        setMessage(response.status === 409 ? 'Sản phẩm đã thay đổi hoặc đường dẫn đã được sử dụng. Kiểm tra lại trước khi lưu.' : response.status === 403 ? 'Bạn không có quyền lưu sản phẩm.' : 'Không thể lưu sản phẩm. Thông tin đã được giữ lại để thử lại.');
        return;
      }
      // Reconcile only the server-confirmed record; never claim a local draft persisted.
      const product = 'product' in result ? result.product : null;
      if (!isProductRecord(product) || product.status !== 'draft' || !parseCommerceProductDraft({ name: product.name, slug: product.slug, description: product.description, productType: product.product_type, releaseType: product.release_type })) throw new Error('invalid_response');
      retry.current.confirm(operationId);
      setProducts(current => [product, ...current.filter(row => row.id !== product.id)]);
      setEditingId(product.id); setDraft(normalized); setSavedDraft(JSON.stringify(normalized));
      setMessage('Đã lưu bản nháp sản phẩm.');
    } catch {
      setMessage('Chưa xác nhận được kết quả lưu. Thử lại với cùng thông tin để tránh tạo trùng sản phẩm.');
    } finally { lock.current = false; setBusy(false); }
  }
  const visible = products.filter(product => (!status || product.status === status) && `${product.name} ${product.slug}`.toLocaleLowerCase('vi-VN').includes(query.trim().toLocaleLowerCase('vi-VN')));

  return (
    <div className="admin-page space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="admin-page-title">Danh mục sản phẩm</h1><p className="mt-2 text-sm text-slate-400">Tạo và chỉnh sửa bản nháp sản phẩm trên Commerce. Keycap được bán qua raffle.</p></div>
        <div className="flex gap-2"><button type="button" className={buttonClass} disabled={busy} onClick={() => router.refresh()}>Tải lại danh sách</button>{canManage && <button type="button" className={buttonClass} disabled={busy} onClick={() => selectProduct()}>Tạo mới</button>}</div>
      </div>
      {!integrationEnabled && <p role="status" className="admin-card p-4 text-sm text-amber-200">Kết nối Commerce đang tắt. Bạn có thể soạn bản nháp; lưu lên Commerce cần kết nối được kích hoạt.</p>}
      {loadError && <p role="alert" className="admin-card p-4 text-sm text-amber-200">{loadError}</p>}
      {message && <p role="status" aria-live="polite" className="admin-card p-4 text-sm">{message}</p>}
      {draft && <form onSubmit={save} className="admin-card space-y-4 p-5">
        <h2 className="font-semibold">{editingId ? 'Chỉnh sửa bản nháp' : 'Sản phẩm mới'}</h2>
        <fieldset disabled={busy} className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2 text-sm">Tên sản phẩm<input required maxLength={160} className={inputClass} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="space-y-2 text-sm">Đường dẫn<input required maxLength={120} pattern="[a-z0-9]+(-[a-z0-9]+)*" className={inputClass} value={draft.slug} onChange={event => setDraft({ ...draft, slug: event.target.value })} /><span className="block text-xs text-slate-400">Chữ thường, số và dấu gạch ngang. Ví dụ: meowhe.</span></label>
          <label className="space-y-2 text-sm">Loại sản phẩm<select className={inputClass} value={draft.productType} onChange={event => { const productType = event.target.value as CommerceProductDraft['productType']; setDraft({ ...draft, productType, releaseType: productType === 'artisan_keycap' ? 'informational' : draft.releaseType }); }}>{Object.entries(PRODUCT_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-2 text-sm">Cách phát hành<select disabled={draft.productType === 'artisan_keycap'} className={inputClass} value={draft.releaseType} onChange={event => setDraft({ ...draft, releaseType: event.target.value as CommerceProductDraft['releaseType'] })}>{Object.entries(PRODUCT_RELEASE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="space-y-2 text-sm md:col-span-2">Mô tả<textarea maxLength={5000} rows={5} className={inputClass} value={draft.description ?? ''} onChange={event => setDraft({ ...draft, description: event.target.value })} /></label>
        </fieldset>
        <p className="text-xs text-slate-400">Lưu nháp chưa hiển thị sản phẩm công khai. Giá, tồn kho và phối màu được quản lý ở bước tiếp theo.</p>
        <div className="flex gap-2"><button className={buttonClass} disabled={busy || !integrationEnabled}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button><button type="button" className={buttonClass} disabled={busy} onClick={cancel}>Hủy</button></div>
      </form>}
      <div className="admin-card overflow-hidden">
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-800 p-4">
          <label className="flex-1 space-y-1 text-sm">Tìm sản phẩm<input className={inputClass} value={query} onChange={event => setQuery(event.target.value)} placeholder="Tên hoặc đường dẫn" /></label>
          <label className="space-y-1 text-sm">Trạng thái<select className={inputClass} value={status} onChange={event => setStatus(event.target.value)}><option value="">Tất cả</option>{Object.entries(PRODUCT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <span className="text-xs text-slate-400">{visible.length} / {products.length} sản phẩm</span>
        </div>
        {visible.length === 0 ? <p className="p-6 text-sm text-slate-400">{products.length ? 'Không tìm thấy sản phẩm phù hợp.' : loadError ? 'Danh sách chưa tải được.' : 'Chưa có sản phẩm trong danh mục.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-left text-sm"><thead className="text-slate-400"><tr>{['Sản phẩm', 'Loại', 'Cách phát hành', 'Trạng thái', 'Cập nhật', 'Thao tác'].map(label => <th key={label} scope="col" className="p-4 font-medium">{label}</th>)}</tr></thead><tbody className="divide-y divide-slate-800">{visible.map(product => <tr key={product.id}><td className="p-4"><div className="font-medium">{product.name}</div><div className="text-xs text-slate-400">{product.slug}</div></td><td className="p-4">{PRODUCT_TYPE_LABELS[product.product_type as keyof typeof PRODUCT_TYPE_LABELS] ?? 'Chưa xác định'}</td><td className="p-4">{PRODUCT_RELEASE_LABELS[product.release_type as keyof typeof PRODUCT_RELEASE_LABELS] ?? 'Chưa xác định'}</td><td className="p-4">{PRODUCT_STATUS_LABELS[product.status]}</td><td className="p-4 text-xs text-slate-400">{Number.isNaN(Date.parse(product.updated_at)) ? 'Không xác định' : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(product.updated_at))}</td><td className="p-4">{canManage && product.status === 'draft' && <button type="button" className={buttonClass} disabled={busy} onClick={() => selectProduct(product)}>Chỉnh sửa</button>}</td></tr>)}</tbody></table></div>}
      </div>
      <TranslationManagerClient products={products} canManage={canManage} integrationEnabled={integrationEnabled} />
      <ColorwayManagerClient products={products} canManage={canManage} integrationEnabled={integrationEnabled} />
    </div>
  );
}
