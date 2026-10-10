'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { isCommerceRaffle, type CommerceRaffle } from '@/lib/commerce-admin/raffle-input';
import { canEditRaffleInformation, parseRaffleInformationMutation, raffleDateToVietnamInput,
  raffleVietnamInputToDate, type RaffleInformationMutation } from '@/lib/commerce-admin/raffle-draft';

function formFromRaffle(raffle: CommerceRaffle) {
  return {title:raffle.title,summary:raffle.summary ?? '',rules:raffle.rules_summary ?? '',
    opens:raffleDateToVietnamInput(raffle.opens_at),closes:raffleDateToVietnamInput(raffle.closes_at)};
}
export default function RaffleInformationEditor({raffle,canManage,viewedAt}: {raffle:CommerceRaffle;canManage:boolean;viewedAt:number}) {
  const router = useRouter();
  const [current,setCurrent] = useState(raffle);
  const [form,setForm] = useState(()=>formFromRaffle(raffle));
  const [saved,setSaved] = useState(()=>JSON.stringify(formFromRaffle(raffle)));
  const [busy,setBusy] = useState(false),[error,setError] = useState(''),[notice,setNotice] = useState('');
  const pending = useRef<{fingerprint:string;mutation:RaffleInformationMutation} | null>(null);
  const saving = useRef(false);
  const editable = canManage && canEditRaffleInformation(current);
  const dirty = JSON.stringify(form) !== saved;
  useEffect(()=>{
    if (!dirty && !busy) return;
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue='';};
    const leave=(event:MouseEvent)=>{
      const link=event.target instanceof Element ? event.target.closest('a[href]') : null;
      if (!(link instanceof HTMLAnchorElement) || link.origin!==window.location.origin || link.pathname===window.location.pathname || event.button!==0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      if (busy || !window.confirm('Thông tin chưa lưu. Rời trang và bỏ thay đổi?')) {event.preventDefault();event.stopPropagation();}
    };
    window.addEventListener('beforeunload',warn);
    document.addEventListener('click',leave,true);
    return ()=>{window.removeEventListener('beforeunload',warn);document.removeEventListener('click',leave,true);};
  },[dirty,busy]);
  async function save(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving.current || !editable) return;
    setError('');setNotice('');
    const information={title:form.title,summary:form.summary || null,rulesSummary:form.rules || null,
      opensAt:raffleVietnamInputToDate(form.opens),closesAt:raffleVietnamInputToDate(form.closes)};
    const fingerprint=JSON.stringify(information);
    const mutation=parseRaffleInformationMutation({operationId:pending.current?.fingerprint===fingerprint ? pending.current.mutation.operationId : crypto.randomUUID(),information});
    if (!mutation) {setError('Kiểm tra tên raffle và chọn giờ đóng sau giờ mở.');return;}
    pending.current={fingerprint,mutation};saving.current=true;setBusy(true);
    try {
      const response=await fetch(`/api/admin/commerce/raffles/${current.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(mutation),cache:'no-store'});
      const result=await response.json();
      if (!response.ok || !result.success) throw new Error(typeof result.message==='string' ? result.message : 'Không thể lưu thông tin raffle.');
      if (!isCommerceRaffle(result.raffle) || result.raffle.id!==current.id) throw new Error('Không xác minh được kết quả lưu. Tải lại để kiểm tra.');
      const next=formFromRaffle(result.raffle);
      setCurrent(result.raffle);setForm(next);setSaved(JSON.stringify(next));pending.current=null;
      setNotice('Đã lưu thông tin bản nháp.');router.refresh();
    } catch(cause) {setError(cause instanceof Error ? cause.message : 'Không thể lưu thông tin raffle.');}
    finally {saving.current=false;setBusy(false);}
  }
  const openingPassed = current.opens_at !== null && Date.parse(current.opens_at) < viewedAt;
  return <div className="admin-page">
    <header className="admin-page-header"><div><h1 className="admin-page-title">{current.title}</h1><p className="admin-page-description">Thông tin raffle · {current.is_published ? 'Đã công khai' : 'Chưa công khai'}</p></div>
      <Link className="admin-button-secondary" prefetch={false} href="/admin/commerce/raffles">Về danh sách</Link></header>
    {openingPassed && !current.is_published ? <p className="admin-card p-4 text-sm text-amber-200">Lịch mở dự kiến đã qua. Kiểm tra lại lịch trước khi công khai đợt raffle.</p> : null}
    <form onSubmit={save} className="admin-card p-4 sm:p-5 space-y-5">
      <p className="text-sm text-slate-400">Giờ mở và đóng theo Việt Nam (UTC+7). Giá bán và ảnh được quản lý theo sản phẩm/phối màu.</p>
      {!editable ? <p className="text-sm text-amber-200">{!canManage ? 'Bạn có quyền xem; chưa có quyền sửa raffle.' : 'Chỉ sửa thông tin của bản nháp chưa công khai.'}</p> : null}
      <fieldset disabled={!editable || busy} className="space-y-4">
        <label className="admin-label">Tên đợt raffle<input className="admin-field mt-2" required maxLength={180} value={form.title} onChange={event=>setForm({...form,title:event.target.value})} /></label>
        <label className="admin-label">Giới thiệu ngắn<textarea className="admin-field mt-2" rows={3} maxLength={5000} value={form.summary} onChange={event=>setForm({...form,summary:event.target.value})} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="admin-label">Giờ mở (Việt Nam)<input className="admin-field mt-2" type="datetime-local" step={1} required value={form.opens} onChange={event=>setForm({...form,opens:event.target.value})} /></label>
          <label className="admin-label">Giờ đóng (Việt Nam)<input className="admin-field mt-2" type="datetime-local" step={1} required value={form.closes} onChange={event=>setForm({...form,closes:event.target.value})} /></label></div>
        <label className="admin-label">Thể lệ tham gia<textarea className="admin-field mt-2" rows={7} maxLength={8000} value={form.rules} onChange={event=>setForm({...form,rules:event.target.value})} /></label>
      </fieldset>
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      {notice ? <p role="status" className="text-sm text-emerald-300">{notice}</p> : null}
      {editable ? <div className="flex flex-wrap gap-3"><button type="submit" className="admin-button-primary" disabled={busy || !dirty}>{busy ? 'Đang lưu…' : 'Lưu nháp'}</button><button type="button" className="admin-button-secondary" disabled={busy || !dirty} onClick={()=>{if(window.confirm('Bỏ các thay đổi chưa lưu?')){setForm(formFromRaffle(current));setError('');setNotice('');}}}>Bỏ thay đổi</button></div> : null}
    </form>
  </div>;
}
