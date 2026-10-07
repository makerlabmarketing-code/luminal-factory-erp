'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActivityEntity, ActivityEvent } from '@/lib/activity-history';
export default function ActivityHistory({entity,entityId}:{entity:ActivityEntity;entityId:string}) {
  const [events,setEvents]=useState<ActivityEvent[]>([]),[enabled,setEnabled]=useState(true),[cursor,setCursor]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const controller=useRef<AbortController|null>(null);
  const load=useCallback(async (before?:string)=>{
    controller.current?.abort(); const abort=new AbortController();controller.current=abort; setBusy(true);setError('');
    try { const response=await fetch(`/api/admin/activity-history?entity=${entity}&id=${encodeURIComponent(entityId)}${before ? `&before=${encodeURIComponent(before)}` : ''}`,{cache:'no-store',signal:abort.signal});
      const result=await response.json(); if(!response.ok)throw new Error(result.message||'Không thể tải lịch sử.');
      if(abort.signal.aborted)return; setEnabled(result.enabled);setEvents(previous=>before ? [...previous,...result.events] : result.events);setCursor(result.nextCursor);
    }catch(cause){if(!abort.signal.aborted)setError(cause instanceof Error ? cause.message : 'Không thể tải lịch sử.');}finally{if(!abort.signal.aborted)setBusy(false);}
  },[entity,entityId]);
  useEffect(()=>{setEvents([]);setCursor(null);void load();return()=>controller.current?.abort();},[load]);
  return <section className="rounded-xl border border-slate-800 bg-slate-900/50 p-4" aria-label="Lịch sử hoạt động"><div className="flex items-center justify-between gap-3"><h2 className="text-sm font-bold">Lịch sử hoạt động</h2><button type="button" disabled={busy} onClick={()=>void load()} className="admin-button-secondary">Tải lại</button></div>
    {!enabled && <p className="mt-3 text-xs text-slate-400">Nhật ký đang chờ triển khai kho lịch sử. Không có lịch sử cũ được tạo lại.</p>}
    {error && <p role="alert" className="mt-3 text-xs text-red-300">{error}</p>}
    {enabled && !busy && !error && events.length===0 && <p className="mt-3 text-xs text-slate-400">Chưa có hoạt động được ghi nhận.</p>}
    <ol className="mt-3 divide-y divide-slate-800">{events.map(event=><li key={event.id} className="py-3"><p className="text-xs font-semibold">{event.actorName} · {event.summary}</p><p className="mt-1 text-[11px] text-slate-400">{new Date(event.occurredAt).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh'})} · {event.screen} · <Link href={event.href} className="text-blue-300 underline">Mở bản ghi #{event.entityId}</Link></p>{event.changesText && <details className="mt-2 text-xs text-slate-400"><summary className="cursor-pointer">Chi tiết thay đổi</summary><pre className="mt-2 whitespace-pre-wrap break-words font-sans">{event.changesText}</pre></details>}</li>)}</ol>
    {busy && <p role="status" className="mt-3 text-xs text-slate-400">Đang tải lịch sử...</p>}{cursor && <button type="button" disabled={busy} className="admin-button-secondary mt-3" onClick={()=>void load(cursor)}>Xem thêm</button>}
  </section>;
}
