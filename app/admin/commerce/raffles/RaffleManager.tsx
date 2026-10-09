'use client';
import { useEffect, useRef, useState } from 'react';
import { CommonTable, TableRowActions } from '@/component/data-table/CommonTable';
import { SectionLoadingState } from '@/component/LuminalLoader';
import type { CommerceRaffle, CommerceRaffleEntry } from '@/lib/commerce-admin/raffle-input';
import { isCommerceRaffleEntry } from '@/lib/commerce-admin/raffle-input';
const statusLabels: Record<string,string> = {DRAFT:'Bản nháp',SCHEDULED:'Sắp mở',OPEN:'Đang mở',CLOSED:'Đã đóng',DRAWING:'Đang chọn người mua',DRAWN:'Đã chọn người mua',PAYMENT_PENDING:'Chờ thanh toán',FULFILLING:'Đang hoàn thiện',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy'};
const date = (value: string | null) => value && Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'}) : 'Chưa đặt';
export default function RaffleManager({raffles}:{raffles:CommerceRaffle[]}) {
  const [selected,setSelected] = useState<CommerceRaffle|null>(null), [entries,setEntries] = useState<CommerceRaffleEntry[]>([]);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[search,setSearch]=useState('');
  const controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>controller.current?.abort(),[]);
  async function loadEntries(raffle:CommerceRaffle) {
    controller.current?.abort(); const abort = new AbortController(); controller.current=abort;
    setSelected(raffle);setEntries([]);setSearch('');setBusy(true);setError('');
    try {
      const response=await fetch(`/api/admin/commerce/raffles/${raffle.id}/entries`,{cache:'no-store',signal:abort.signal});
      const result=await response.json();
      if(!response.ok || !result.success) throw new Error(result.message || 'Không thể tải người tham gia.');
      if(!Array.isArray(result.entries) || !result.entries.every(isCommerceRaffleEntry)) throw new Error('Dữ liệu người tham gia không hợp lệ.');
      if(!abort.signal.aborted)setEntries(result.entries);
    }catch(cause){if(!abort.signal.aborted)setError(cause instanceof Error ? cause.message : 'Không thể tải người tham gia.');}
    finally {if(!abort.signal.aborted)setBusy(false);}
  }
  const visible=entries.filter(entry=>`${entry.display_name} ${entry.contact_email}`.toLocaleLowerCase('vi').includes(search.trim().toLocaleLowerCase('vi')));
  function rowActions(raffle:CommerceRaffle) { return <button type="button" className="admin-button-secondary" onClick={()=>void loadEntries(raffle)}>Người tham gia</button>; }
  return <div className="admin-page space-y-5"><h1 className="admin-page-title">Raffle</h1><p className="text-sm text-slate-400">Thông tin đăng ký được lưu tại Commerce. Giờ hiển thị theo Việt Nam.</p>
    <div className="admin-card overflow-x-auto"><CommonTable className="w-full min-w-[700px] text-left text-sm"><thead><tr>{['Đợt raffle','Trạng thái','Mở','Đóng','Thao tác'].map(label=><th scope="col" key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{raffles.map(raffle=><tr key={raffle.id}><td className="p-4">{raffle.title}<span className="block text-xs text-slate-400">{raffle.is_test ? 'Đợt kiểm thử' : raffle.is_published ? 'Đã công khai' : 'Chưa công khai'}</span></td><td className="p-4">{statusLabels[raffle.status] ?? 'Chưa xác định'}</td><td className="p-4">{date(raffle.opens_at)}</td><td className="p-4">{date(raffle.closes_at)}</td><td className="p-4"><TableRowActions renderActions={()=>rowActions(raffle)} /></td></tr>)}</tbody></CommonTable>{raffles.length===0 && <p className="p-5">Chưa có raffle.</p>}</div>
    {selected && <section className="admin-card p-4 space-y-4" aria-label="Người tham gia raffle"><div className="flex flex-wrap justify-between gap-3"><h2 className="font-bold">Người tham gia · {selected.title}</h2><button className="admin-button-secondary" disabled={busy} onClick={()=>void loadEntries(selected)}>Tải lại</button></div>
      {selected.summary && <p className="text-sm text-slate-300">{selected.summary}</p>}
      {selected.rules_summary && <details className="text-sm text-slate-400"><summary className="cursor-pointer">Thể lệ và thông tin đợt raffle</summary><p className="mt-2 whitespace-pre-line">{selected.rules_summary}</p></details>}
      {busy ? <SectionLoadingState /> : error ? <p role="alert" className="text-red-300">{error}</p> : <><label className="block">Tìm tên hoặc email<input value={search} onChange={event=>setSearch(event.target.value)} className="admin-field mt-2" /></label><p className="text-sm text-slate-400">{visible.length} người tham gia</p><div className="overflow-x-auto"><CommonTable className="w-full min-w-[640px] text-left text-sm"><thead><tr>{['Khách hàng','Email','Thời gian','Thông tin giao hàng'].map(label=><th key={label} scope="col" className="p-3">{label}</th>)}</tr></thead><tbody>{visible.map(entry=><tr key={entry.id}><td className="p-3">{entry.display_name}</td><td className="p-3 break-all">{entry.contact_email}</td><td className="p-3">{date(entry.accepted_at)}</td><td className="p-3">{entry.shipping ? <details><summary className="cursor-pointer">Xem địa chỉ</summary><p className="mt-2 whitespace-pre-line">{[entry.shipping.recipient_name,entry.shipping.address_line_1,entry.shipping.address_line_2,[entry.shipping.city,entry.shipping.state_province,entry.shipping.postal_code].filter(Boolean).join(', '),entry.shipping.country_code,entry.shipping.phone].filter(Boolean).join('\n')}</p></details> : 'Chưa có địa chỉ'}</td></tr>)}</tbody></CommonTable></div>{visible.length===0 && <p>Không có người tham gia phù hợp.</p>}</>}
    </section>}
  </div>;
}
