'use client';
import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { CommerceColorwayRecord, CommerceProductRecord } from '@/lib/commerce-admin/contracts';
import { isColorwayRecord } from '@/lib/commerce-admin/colorway-input';
import { isMediaManifest, isMediaPresentation, isMediaTicket, mediaEditorPath, mediaPath, MEDIA_MAX_COUNT, type MediaAsset, type MediaManifest, type MediaMutation } from '@/lib/commerce-admin/media-input';
import { prepareMediaFile } from '@/lib/commerce-admin/prepare-media-file';
import { useCommerceFeedback } from '@/lib/commerce-admin/use-commerce-feedback';
import { useNotification } from '@/component/NotificationContext';
import { createCommerceMutationRetry } from '@/lib/commerce-admin/mutation-retry';
const inputClass = 'w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm';
const buttonClass = 'rounded-md border border-slate-700 px-3 py-2 text-sm disabled:opacity-40';
type UploadJob = { id:string; file:File; preview:string; status:'waiting'|'working'|'done'|'failed'; error:string; prepared?: Awaited<ReturnType<typeof prepareMediaFile>>; mutation?: MediaMutation };
async function jsonRequest(path:string, method = 'GET', body?:unknown, signal?:AbortSignal): Promise<unknown> {
  const response = await fetch(path,{ method,cache:'no-store',signal:signal ?? AbortSignal.timeout(30_000),...(body ? { headers:{ 'Content-Type':'application/json' },body:JSON.stringify(body) } : {}) });
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(response.status === 409 ? 'Bộ ảnh đã thay đổi. Tải lại trước khi thử lại.' : response.status === 403 ? 'Bạn không có quyền quản lý ảnh.' : 'Không thể truy cập bộ ảnh. Vui lòng thử lại.');
  if (!result || typeof result !== 'object' || !('success' in result) || result.success !== true || !('media' in result)) throw new Error('Chưa xác nhận được kết quả. Nội dung được giữ lại để thử lại.');
  return result.media;
}
export default function MediaManagerClient({ products,canManage,integrationEnabled,mediaEnabled, fixedProductId, onGuardChange }: { products:CommerceProductRecord[];canManage:boolean;integrationEnabled:boolean;mediaEnabled:boolean;fixedProductId?:string;onGuardChange?:(key:string,state:{dirty:boolean;busy:boolean})=>void }) {
  const [productId,setProductId] = useState(fixedProductId ?? ''); const [variantId,setVariantId] = useState<string|null>(null);
  const [colorways,setColorways] = useState<CommerceColorwayRecord[]>([]); const [variantsLoaded,setVariantsLoaded] = useState(false);
  const [manifest,setManifest] = useState<MediaManifest|null>(null); const [assets,setAssets] = useState<MediaAsset[]>([]); const [primaryId,setPrimaryId] = useState<string|null>(null);
  const [previews,setPreviews] = useState<{id:string;url:string}[]>([]); const [loading,setLoading] = useState(false); const [busy,setBusy] = useState(false); const [refresh,setRefresh] = useState(0);
  const [queue,setQueue] = useState<UploadJob[]>([]); const queueRef = useRef<UploadJob[]>([]); const lock = useRef(false); const mounted = useRef(true); const dragId = useRef<string|null>(null);
  const retry = useRef(createCommerceMutationRetry());
  const { message,setMessage,error,success,loaded } = useCommerceFeedback(); const { showConfirm } = useNotification();
  const target = { productId,variantId }; const path = mediaEditorPath(target);
  const product = products.find(p => p.id === productId); const variant = colorways.find(v => v.id === variantId);
  const writable = canManage && product?.status === 'draft' && (variantId === null || !!variant && !variant.is_active) && mediaEnabled && integrationEnabled;
  const dirty = !!manifest && (JSON.stringify(assets) !== JSON.stringify(manifest.assets) || primaryId !== manifest.primaryId) || queue.some(j => j.status !== 'done');
  function updateQueue() { if (mounted.current) setQueue([...queueRef.current]); }
  function clearQueue() { queueRef.current.forEach(j => URL.revokeObjectURL(j.preview)); queueRef.current=[]; setQueue([]); }
  function canLeave() { return !lock.current && (!dirty || window.confirm('Bộ ảnh chưa được lưu. Bạn có muốn bỏ thay đổi?')); }
  useEffect(() => { onGuardChange?.('media', { dirty, busy }); return () => onGuardChange?.('media', { dirty: false, busy: false }); }, [dirty, busy, onGuardChange]);
  useEffect(() => { mounted.current=true; return () => { mounted.current=false; queueRef.current.forEach(j => URL.revokeObjectURL(j.preview)); }; },[]);
  useEffect(() => { if (!dirty) return; const warn = (e:BeforeUnloadEvent) => e.preventDefault(); window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn); },[dirty]);
  useEffect(() => {
    const abort = new AbortController(); setColorways([]); setVariantsLoaded(false);
    if (!productId || !mediaEnabled || !integrationEnabled) return () => abort.abort();
    void fetch(`/api/admin/commerce/products/${productId}/colorways`,{signal:abort.signal,cache:'no-store'}).then(async response => {
      const value:unknown = await response.json();
      if (!response.ok || !value || typeof value !== 'object' || !('success' in value) || value.success !== true || !('colorways' in value) || !Array.isArray(value.colorways) || value.colorways.length > 200 || !value.colorways.every(v => isColorwayRecord(v) && v.product_id === productId)) throw new Error();
      if (!abort.signal.aborted) { setColorways(value.colorways); setVariantsLoaded(true); }
    }).catch(() => { if (!abort.signal.aborted) error('Chưa tải được phối màu. Bạn vẫn có thể quản lý ảnh chung của sản phẩm.'); });
    return () => abort.abort();
  },[productId,mediaEnabled,integrationEnabled,refresh,error]);
  useEffect(() => {
    const abort=new AbortController(); setManifest(null);setAssets([]);setPrimaryId(null);setPreviews([]);setMessage('');
    if (!productId || !mediaEnabled || !integrationEnabled) { setLoading(false);return () => abort.abort(); }
    setLoading(true);
    void jsonRequest(path,'GET',undefined,abort.signal).then(value => {
      if (!isMediaPresentation(value,{productId,variantId})) throw new Error('Bộ ảnh trả về không khớp sản phẩm/phối màu.');
      if (abort.signal.aborted) return;setManifest(value);setAssets(value.assets);setPrimaryId(value.primaryId);setPreviews(value.previews);loaded('Bộ ảnh đã được tải.');
    }).catch(e => { if (!abort.signal.aborted) error(e instanceof Error ? e.message : 'Không thể tải bộ ảnh.'); }).finally(() => { if (!abort.signal.aborted) setLoading(false); });
    return () => abort.abort();
  },[productId,variantId,path,mediaEnabled,integrationEnabled,refresh,loaded,error,setMessage]);
  function addFiles(files:File[]) {
    if (!writable || !manifest || lock.current) return;
    const active = assets.filter(a => !a.removed).length + queueRef.current.filter(j => j.status !== 'done').length;
    if (files.length === 0) return;
    if (files.length + active > MEDIA_MAX_COUNT || manifest.assets.length + queueRef.current.filter(j => j.status !== 'done').length + files.length > 120) { error('Mỗi bộ tối đa 20 ảnh đang dùng; tối đa 120 ảnh gồm ảnh đã gỡ.');return; }
    if (files.some(f => !['image/jpeg','image/png','image/webp'].includes(f.type) || f.size < 1 || f.size > 20*1024*1024)) { error('Chọn ảnh JPG, PNG hoặc WebP, tối đa 20 MiB mỗi tệp.');return; }
    queueRef.current.push(...files.map(file => ({id:crypto.randomUUID(),file,preview:URL.createObjectURL(file),status:'waiting' as const,error:''})));updateQueue();
  }
  async function upload(singleId?:string) {
    if (lock.current || !writable || !manifest || JSON.stringify(assets) !== JSON.stringify(manifest.assets) || primaryId !== manifest.primaryId) return;
    lock.current=true;setBusy(true);setMessage('');let current=manifest;let completed=0;
    try {
      for (const job of queueRef.current.filter(j => j.status !== 'done' && (!singleId || j.id === singleId))) {
        job.status='working';job.error='';updateQueue();
        try {
          // Reconcile a previous uncertain result without creating another asset.
          if (!current.assets.some(a => a.id === job.id)) {
            job.prepared ??= await prepareMediaFile(job.file);
            const input={assetId:job.id,fileName:job.prepared.fileName,sizeBytes:job.prepared.blob.size};
            const ticket=await jsonRequest(`${path}/upload-ticket`,'POST',input);
            if (!isMediaTicket(ticket,target,input)) throw new Error('Chưa xác nhận được quyền tải ảnh.');
            const response=await fetch(ticket.signedUrl,{method:'PUT',headers:{'Content-Type':'image/webp'},body:job.prepared.blob,signal:AbortSignal.timeout(60_000)});
            // Existing immutable object is validated again by the confirmation endpoint on retry.
            if (!response.ok && response.status !== 409 && response.status !== 400) throw new Error('Tải tệp chưa thành công. Bạn có thể thử lại.');
            const asset:MediaAsset={id:job.id,path:mediaPath(target,job.id),fileName:input.fileName,sizeBytes:input.sizeBytes,width:job.prepared.width,height:job.prepared.height,alt:'',removed:false};
            job.mutation ??= {operationId:crypto.randomUUID(),expectedRevision:current.revision,asset};
            const saved=await jsonRequest(path,'POST',job.mutation);
            if (!isMediaManifest(saved,target) || saved.revision !== job.mutation.expectedRevision + 1 || !saved.assets.some(a => Object.keys(asset).every(key => a[key as keyof MediaAsset] === asset[key as keyof MediaAsset]))) throw new Error('Chưa xác nhận được kết quả lưu ảnh.');
            current=saved;
          }
          job.status='done';completed++;setManifest(current);setAssets(current.assets);setPrimaryId(current.primaryId);updateQueue();
        } catch (e) { job.status='failed';job.error=e instanceof Error ? e.message : 'Không thể tải ảnh.';updateQueue();error(job.error);break; }
      }
      if (completed) success(`Đã lưu ${completed} ảnh vào bộ ảnh nháp.`);
      try { const latest=await jsonRequest(path);if(isMediaPresentation(latest,target)) { setManifest(latest);setAssets(latest.assets);setPrimaryId(latest.primaryId);setPreviews(latest.previews); } } catch { error('Ảnh đã xác nhận lưu được giữ nguyên. Tải lại để cập nhật hình xem trước.'); }
    } finally { lock.current=false;if(mounted.current)setBusy(false); }
  }
  async function save() {
    if (lock.current || !writable || !manifest) return;lock.current=true;setBusy(true);setMessage('');
    const payload={expectedRevision:manifest.revision,assets:assets.map(({id,alt,removed}) => ({id,alt,removed})),primaryId};
    const operationId=retry.current.prepare(path,'PATCH',payload);
    try { const saved=await jsonRequest(path,'PATCH',{operationId,...payload});if(!isMediaManifest(saved,target) || saved.revision !== manifest.revision+1 || saved.primaryId !== primaryId || JSON.stringify(saved.assets.map(({id,alt,removed}) => ({id,alt,removed}))) !== JSON.stringify(payload.assets)) throw new Error('Chưa xác nhận được kết quả lưu.');retry.current.confirm(operationId);setManifest(saved);setAssets(saved.assets);setPrimaryId(saved.primaryId);success('Đã lưu thứ tự, ảnh bìa và mô tả ảnh.'); }
    catch(e) { error(e instanceof Error ? e.message : 'Không thể lưu bộ ảnh.'); } finally {lock.current=false;setBusy(false);}
  }
  function move(id:string, beforeId:string) { if(busy || !writable || id===beforeId)return;setAssets(current => {const next=[...current];const from=next.findIndex(a => a.id===id);const to=next.findIndex(a => a.id===beforeId);if(from<0 || to<0)return current;const [item]=next.splice(from,1);next.splice(to,0,item);return next;}); }
  function remove(id:string) { showConfirm('Gỡ ảnh khỏi bộ ảnh?','Tệp được giữ lại. Bạn có thể khôi phục trong mục Ảnh đã gỡ.',() => {if(lock.current)return;setAssets(current => current.map(a => a.id===id ? {...a,removed:true}:a));if(primaryId===id)setPrimaryId(assets.find(a => a.id!==id && !a.removed)?.id ?? null);},{confirmLabel:'Gỡ ảnh'}); }
  const active=assets.filter(a => !a.removed);const removed=assets.filter(a => a.removed);
  return <section className="admin-card space-y-4 p-5" aria-labelledby="media-heading">
    <h2 id="media-heading" className="font-semibold">Ảnh sản phẩm và phối màu</h2>
    <p className="text-sm text-slate-400">Chọn nhiều ảnh trong một lượt. Ảnh được tối ưu và lưu nháp; website công khai chưa thay đổi.</p>
    {!mediaEnabled && <p role="status" className="text-sm text-amber-200">Tải ảnh nháp chưa được bật. Đang chờ hoàn tất phần lưu trữ ảnh.</p>}
    <div className="grid gap-3 md:grid-cols-2">{!fixedProductId && <label className="space-y-1 text-sm">Sản phẩm<select className={inputClass} disabled={busy || !mediaEnabled} value={productId} onChange={e => {if(canLeave()){clearQueue();setVariantId(null);setProductId(e.target.value);}}}><option value="">Chọn sản phẩm</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>}<label className="space-y-1 text-sm">Bộ ảnh<select className={inputClass} disabled={busy || !variantsLoaded} value={variantId ?? ''} onChange={e => {if(canLeave()){clearQueue();setVariantId(e.target.value || null);}}}><option value="">Ảnh chung của sản phẩm</option>{colorways.map(v => <option key={v.id} value={v.id}>Phối màu: {v.name}</option>)}</select></label></div>
    {message && <p role="status" className="text-sm">{message}</p>}{loading && <p role="status">Đang tải bộ ảnh…</p>}
    {productId && mediaEnabled && <button type="button" className={buttonClass} disabled={busy || loading} onClick={() => {if(canLeave()){clearQueue();setRefresh(v => v+1);}}}>Tải lại bộ ảnh</button>}
    {manifest && <><p className="text-sm">{active.length} / 20 ảnh · {writable ? 'Bản nháp' : 'Chỉ xem'}</p>
      {writable && <div className="rounded-md border border-dashed border-slate-600 p-5" onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault();addFiles(Array.from(e.dataTransfer.files));}}><label className="block space-y-2 text-sm">Kéo thả ảnh vào đây hoặc chọn tệp<input type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e => {addFiles(Array.from(e.target.files ?? []));e.target.value='';}} className="block w-full" /></label><p className="mt-2 text-xs text-slate-400">JPG, PNG, WebP · tối đa 20 MiB/tệp · tối ưu xuống 2048 px và tối đa 2 MiB.</p></div>}
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{active.map((a,i) => <li key={a.id} draggable={writable && !busy} onDragStart={() => {dragId.current=a.id;}} onDragOver={e => e.preventDefault()} onDrop={e => {e.preventDefault();e.stopPropagation();if(dragId.current)move(dragId.current,a.id);dragId.current=null;}} className="space-y-2 rounded-md border border-slate-700 p-3">
        {previews.some(p => p.id===a.id) ? <Image unoptimized src={previews.find(p => p.id===a.id)!.url} alt={a.alt || a.fileName} width={320} height={240} className="aspect-[4/3] w-full rounded object-contain" /> : <p className="text-sm">Tải lại để xem ảnh.</p>}
        <p className="break-words text-sm">{a.fileName}{primaryId===a.id ? ' · Ảnh bìa' : ''}</p><label className="block text-sm">Mô tả ảnh<input className={inputClass} maxLength={500} disabled={!writable || busy} value={a.alt} onChange={e => setAssets(current => current.map(row => row.id===a.id ? {...row,alt:e.target.value}:row))} /></label>
        {writable && <div className="flex flex-wrap gap-2"><button type="button" className={buttonClass} disabled={busy || primaryId===a.id} onClick={() => setPrimaryId(a.id)}>Đặt ảnh bìa</button><button type="button" aria-label={`Đưa ${a.fileName} lên trước`} className={buttonClass} disabled={busy || i===0} onClick={() => move(a.id,active[i-1].id)}>Lên</button><button type="button" aria-label={`Đưa ${a.fileName} xuống sau`} className={buttonClass} disabled={busy || i===active.length-1} onClick={() => move(a.id,active[i+1].id)}>Xuống</button><button type="button" className={buttonClass} disabled={busy} onClick={() => remove(a.id)}>Gỡ ảnh</button></div>}
      </li>)}</ul>
      {!active.length && <p className="text-sm text-slate-400">Chưa có ảnh trong bộ ảnh này.</p>}
      {!!removed.length && <details><summary className="text-sm">Ảnh đã gỡ ({removed.length})</summary><ul>{removed.map(a => <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm"><span>{a.fileName}</span>{writable && <button type="button" className={buttonClass} disabled={busy || active.length>=20} onClick={() => {setAssets(current => current.map(row => row.id===a.id ? {...row,removed:false}:row));if(!primaryId)setPrimaryId(a.id);}}>Khôi phục</button>}</li>)}</ul></details>}
      {writable && <button type="button" className={buttonClass} disabled={busy || JSON.stringify(assets)===JSON.stringify(manifest.assets) && primaryId===manifest.primaryId} onClick={() => void save()}>{busy ? 'Đang xử lý…' : 'Lưu bộ ảnh'}</button>}
    </>}
    {!!queue.length && <><ul className="space-y-2">{queue.map(j => <li key={j.id} className="flex items-center gap-3 rounded border border-slate-700 p-3"><Image unoptimized src={j.preview} alt={j.file.name} width={72} height={72} className="h-16 w-16 object-contain" /><div className="min-w-0 flex-1 text-sm"><p className="break-words">{j.file.name}</p><p>{j.status==='done' ? 'Đã lưu' : j.status==='working' ? 'Đang tối ưu và tải lên…' : j.status==='failed' ? j.error : 'Chờ tải lên'}</p></div>{j.status==='failed' && <button type="button" className={buttonClass} disabled={busy} onClick={() => void upload(j.id)}>Thử lại</button>}{j.status!=='done' && <button type="button" className={buttonClass} disabled={busy} onClick={() => {URL.revokeObjectURL(j.preview);queueRef.current=queueRef.current.filter(row => row.id!==j.id);updateQueue();}}>Bỏ tệp</button>}</li>)}</ul><button type="button" className={buttonClass} disabled={busy || !writable || !manifest || JSON.stringify(assets)!==JSON.stringify(manifest.assets) || primaryId!==manifest.primaryId || queue.every(j => j.status==='done')} onClick={() => void upload()}>Tải các ảnh đã chọn</button><p className="text-xs text-slate-400">Lưu thay đổi bộ ảnh trước khi tải thêm tệp.</p></>}
  </section>;
}
