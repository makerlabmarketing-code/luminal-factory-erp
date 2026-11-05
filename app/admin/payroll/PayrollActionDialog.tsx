'use client';
import { useState } from 'react';
import { ProjectActionDialog } from '../projects/[projectId]/ProjectActionDialog';
import type { PayrollMonthDTO } from '@/services/server/payroll';
import { payrollAdjustmentInput } from '@/lib/payroll-input';
const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });
export function PayrollActionDialog({ row, action, onClose, onSaved, onBusy }: {
  row: PayrollMonthDTO; action: 'adjust' | 'reopen' | 'supplement'; onClose: () => void;
  onSaved: () => Promise<void>; onBusy: (busy: boolean) => void;
}) {
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const reopen = action === 'reopen';
  const supplement = action === 'supplement';
  const [requestId] = useState(() => crypto.randomUUID());
  const delta = /^-?\d+$/.test(amount) ? Number(amount) : NaN;
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy || uncertain) return;
    setError('');
    try {
      if (!reopen) {
        const input = payrollAdjustmentInput(amount, reason);
        if (supplement && input.amount <= 0) throw new Error('Khoản cộng thêm phải lớn hơn 0.');
      }
      else if (reason.trim().length < 10 || reason.trim().length > 1000) throw new Error('Nhập lý do từ 10 đến 1.000 ký tự.');
    } catch (error) { setError((error as Error).message); return; }
    setBusy(true); onBusy(true);
    let received = false;
    try {
      const response = await fetch('/api/admin/payroll', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, settlementId: row.settlementId, amount, reason: reason.trim(), requestId }) });
      const body = await response.json(); received = true; if (!response.ok) throw new Error(body.message || 'Không thể lưu thay đổi.');
      await onSaved(); onClose();
    } catch (error) { if (!received) { setUncertain(true); setError('Chưa xác nhận được kết quả. Đóng hộp thoại và tải lại bảng lương trước khi thực hiện tiếp.'); } else setError(error instanceof Error ? error.message : 'Không thể lưu thay đổi.'); }
    finally { setBusy(false); onBusy(false); }
  }
  return <ProjectActionDialog titleId="payroll-action-title" descriptionId="payroll-action-description" busy={busy} onClose={onClose}>
    <h2 id="payroll-action-title" className="pr-8 text-lg font-bold">{reopen ? 'Mở lại kỳ lương' : supplement ? 'Tạo phiếu lương bổ sung' : 'Điều chỉnh tiền lương'}</h2>
    <p className="mt-1 text-sm">{row.employeeName} · {row.payrollMonth}</p>
    <p id="payroll-action-description" className="mt-3 text-sm text-slate-400">{reopen ? 'Chỉ mở lại khi chưa trả. Bản chốt và phiếu cũ được hủy hiệu lực, giữ trong lịch sử. Chốt lại tạo phiếu mới; khoản điều chỉnh được tính đúng một lần.' : supplement ? 'Giữ nguyên khoản lương đã trả. Tạo một phiếu Chưa trả riêng chỉ bằng số tiền cộng thêm; không tự thanh toán hoặc gửi email.' : 'Điều chỉnh khoản lương chưa trả và cập nhật số tiền trên phiếu đang chờ trả. Không thay đổi giờ công hoặc tự thanh toán.'}</p>
    <form onSubmit={event => void submit(event)} className="mt-4 space-y-4">
      {!reopen && <label className="block text-sm">{supplement ? 'Số tiền cộng thêm (đồng)' : 'Số tiền điều chỉnh (đồng)'}<input value={amount} onChange={e => setAmount(e.target.value)} disabled={busy} inputMode="text" placeholder={supplement ? 'Ví dụ: 100000' : 'Ví dụ: 50000 hoặc -20000'} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-3" /></label>}
      {!reopen && Number.isSafeInteger(delta) && <p className="text-sm text-cyan-200">{supplement ? 'Phiếu bổ sung: ' : 'Thực nhận sau điều chỉnh: '}{money.format(supplement ? delta : row.finalPayableAmount + delta)}</p>}
      <label className="block text-sm">Lý do<textarea value={reason} onChange={e => setReason(e.target.value)} disabled={busy} required minLength={reopen ? 10 : 3} maxLength={1000} className="mt-1 w-full rounded border border-slate-600 bg-slate-950 p-3" /></label>
      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
      <div className="flex justify-end gap-2"><button type="button" disabled={busy} onClick={onClose} className="rounded border border-slate-600 px-4 py-2">Hủy</button><button disabled={busy || uncertain} className="rounded bg-blue-600 px-4 py-2 font-bold disabled:opacity-50">{busy ? 'Đang lưu…' : reopen ? 'Xác nhận mở lại' : supplement ? 'Tạo phiếu bổ sung' : 'Lưu điều chỉnh'}</button></div>
    </form>
  </ProjectActionDialog>;
}
