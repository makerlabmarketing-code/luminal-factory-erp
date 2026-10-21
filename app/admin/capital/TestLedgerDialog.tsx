
'use client';
import { useState } from 'react';
import { ProjectActionDialog } from '../projects/[projectId]/ProjectActionDialog';
import type { FinancialLedgerEntry } from '@/lib/types/finance';
export function TestLedgerDialog({row,onClose,onSaved}:{row:FinancialLedgerEntry;onClose:()=>void;onSaved:()=>Promise<void>}) {
 const [reason,setReason]=useState(''); const [confirmId,setConfirmId]=useState(''); const [confirmedTest,setConfirmedTest]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState('');const [uncertain,setUncertain]=useState(false);
 const restore=Boolean(row.cancelled_at);
 async function submit(event:React.FormEvent) {
  event.preventDefault();if(busy||uncertain)return;setBusy(true);setError('');let received=false;
  try {const response=await fetch(`/api/admin/finance/ledger/${row.id}`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'testArchive',archived:!restore,reason,confirmId,confirmedTest})});const body=await response.json();received=true;if(!response.ok)throw new Error(body.message||'Không thể lưu.');await onSaved();onClose();}
  catch(error){if(!received){setUncertain(true);setError('Chưa rõ kết quả. Đóng hộp thoại và tải lại sổ trước khi thử tiếp.');}else setError(error instanceof Error?error.message:'Không thể lưu.');}finally{setBusy(false);}
 }
 return <ProjectActionDialog titleId="test-ledger-title" descriptionId="test-ledger-description" busy={busy} onClose={onClose}>
 <h2 id="test-ledger-title" className="text-lg font-bold">{restore?'Khôi phục bản ghi thử':'Xóa bản ghi thử'}</h2>
 <p id="test-ledger-description" className="mt-3 text-sm">#{row.id} · {row.category} · {Number(row.amount).toLocaleString('vi-VN')}đ. {restore?'Bản ghi sẽ được tính lại vào báo cáo.':'Bản ghi sẽ được loại khỏi sổ và báo cáo; giữ chứng từ, lịch sử và có thể khôi phục. Thao tác này không hoàn tiền.'}</p>
 <form onSubmit={event=>void submit(event)} className="mt-4 space-y-3">
 <label className="block"><input type="checkbox" required checked={confirmedTest} disabled={busy} onChange={e=>setConfirmedTest(e.target.checked)}/> Tôi xác nhận đây là dữ liệu thử, không phản ánh khoản tiền thật.</label>
 <label className="block">Nhập mã bản ghi #{row.id}<input className="admin-field" required value={confirmId} disabled={busy} onChange={e=>setConfirmId(e.target.value)}/></label>
 <label className="block">Lý do<textarea className="admin-field" required minLength={10} maxLength={500} value={reason} disabled={busy} onChange={e=>setReason(e.target.value)}/></label>
 {error&&<p role="alert" className="text-red-300">{error}</p>}
 <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="admin-button-secondary">Hủy</button><button disabled={busy||uncertain||!confirmedTest||confirmId!==String(row.id)} className="admin-button-primary">{busy?'Đang lưu…':restore?'Khôi phục':'Xóa bản ghi thử'}</button></div>
 </form></ProjectActionDialog>;
}
