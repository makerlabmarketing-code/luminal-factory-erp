'use client';
import { PayrollActionDialog } from './PayrollActionDialog';

import { CommonTable, TableRowActions } from '@/component/data-table/CommonTable';
import { useCallback, useEffect, useRef, useState } from 'react';
import MonthPicker from '@/component/MonthPicker';
import { businessMonthFromInstant, formatBusinessMonthInput } from '@/lib/business-date';
import type { PayrollMonthDTO, PayrollReadinessDTO } from '@/services/server/payroll';

const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

export default function AdminPayrollPage() {
  const [month, setMonth] = useState(() => formatBusinessMonthInput(businessMonthFromInstant(new Date())));
  const [setupMonth, setSetupMonth] = useState(() => formatBusinessMonthInput(businessMonthFromInstant(new Date())));
  const [rows, setRows] = useState<PayrollMonthDTO[]>([]);
  const [readiness, setReadiness] = useState<PayrollReadinessDTO | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [setupLoading, setSetupLoading] = useState(true);
  const [actionDialog, setActionDialog] = useState<{ row: PayrollMonthDTO; action: 'adjust' | 'reopen' } | null>(null);
  const [success, setSuccess] = useState('');
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const lock = useRef(false);
  const requestSequence = useRef(0);

  const loadReadiness = useCallback(async () => {
    setSetupLoading(true);
    setError('');
    try {
      const response = await fetch('/api/admin/payroll?mode=readiness', { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setReadiness(body.readiness);
      if (body.readiness?.firstSettlementMonth) setSetupMonth(body.readiness.firstSettlementMonth);
      return body.readiness as PayrollReadinessDTO;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể kiểm tra trạng thái quyết toán lương.');
      setReadiness(null);
      return null;
    } finally {
      setSetupLoading(false);
    }
  }, []);

  const loadPayroll = useCallback(async () => {
    const sequence = ++requestSequence.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/admin/payroll?month=${month}`, { cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      if (sequence !== requestSequence.current) return;
      setRows(body.payroll || []);
    } catch (e) {
      if (sequence === requestSequence.current) setError(e instanceof Error ? e.message : 'Không thể tải dữ liệu lương.');
    } finally {
      if (sequence === requestSequence.current) setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void loadReadiness();
    return () => { requestSequence.current += 1; };
  }, [loadReadiness]);

  useEffect(() => {
    if (readiness?.schemaReady && readiness.featureEnabled && readiness.configured && readiness.canView) {
      void loadPayroll();
    } else {
      setLoading(false);
      setRows([]);
    }
  }, [loadPayroll, readiness]);

  async function configureFirstMonth() {
    if (lock.current || !readiness?.canConfigure) return;
    if (!confirm(`Xác nhận ${setupMonth} là tháng quyết toán đầu tiên? Mốc này không được ghi đè sau khi lưu.`)) return;
    lock.current = true;
    setActiveAction('configure');
    setError('');
    try {
      const response = await fetch('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'configure', month: setupMonth }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      await loadReadiness();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể cấu hình tháng quyết toán đầu tiên.');
    } finally {
      lock.current = false;
      setActiveAction(null);
    }
  }

  async function settle(employeeId: string) {
    if (readiness?.firstSettlementMonth && month < readiness.firstSettlementMonth) {
      setError(`Không thể quyết toán kỳ ${month}. Hệ thống chỉ cho phép quyết toán từ ${readiness.firstSettlementMonth}.`);
      return;
    }
    if (lock.current || !confirm('Xác nhận chốt lương cho nhân viên này? Đây chưa phải thao tác thanh toán.')) return;
    lock.current = true;
    setActiveAction(`settle:${employeeId}`);
    try {
      const response = await fetch('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'settle', employeeId, month }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      setRows((current) => current.map((row) => row.employeeId === employeeId
        ? { ...row, settlementStatus: 'SETTLED', settlementId: String(body.settlementId), settledAt: new Date().toISOString() }
        : row));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể quyết toán.');
    } finally {
      lock.current = false;
      setActiveAction(null);
    }
  }

  const readyForPayroll = Boolean(readiness?.schemaReady && readiness.featureEnabled && readiness.configured && readiness.canView);
  const selectedMonthBeforeStart = Boolean(
    readiness?.firstSettlementMonth && month < readiness.firstSettlementMonth
  );

  return (
    <section className="space-y-5 p-5 sm:p-8">
      <div>
        <h1 className="text-xl font-bold">Quyết toán lương tháng</h1>
        <p className="mt-1 text-sm text-slate-400">Chốt lương và thanh toán là hai bước riêng. Khoản cộng/trừ được lưu kèm lý do và lịch sử.</p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="font-bold text-slate-100">Trạng thái sẵn sàng</h2>
            <p className="text-xs text-slate-400">Kiểm tra schema, mốc bắt đầu, runtime flag và quyền trước khi cho phép quyết toán.</p>
          </div>
          <button onClick={() => void loadReadiness()} disabled={setupLoading} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold disabled:opacity-60">
            {setupLoading ? 'Đang kiểm tra...' : 'Kiểm tra lại'}
          </button>
        </div>

        {readiness && (
          <div className="grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-400">Database</span><strong className="mt-1 block">{readiness.schemaReady ? '✓ Sẵn sàng' : '✕ Chưa sẵn sàng'}</strong></div>
            <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-400">Tháng bắt đầu</span><strong className="mt-1 block">{readiness.firstSettlementMonth || 'Chưa cấu hình'}</strong></div>
            <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-400">Runtime</span><strong className="mt-1 block">{readiness.featureEnabled ? '✓ Đã bật' : 'Đang tắt an toàn'}</strong></div>
            <div className="rounded-lg bg-slate-950 p-3"><span className="text-slate-400">Quyền hiện tại</span><strong className="mt-1 block">{readiness.canView ? 'Có PAYROLL_VIEW' : 'Thiếu PAYROLL_VIEW'}</strong></div>
          </div>
        )}

        {readiness?.schemaReady && !readiness.configured && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4">
            <p className="font-bold text-amber-200">Chưa chọn tháng quyết toán đầu tiên</p>
            <p className="mt-1 text-xs text-amber-100/70">Mốc này chặn quyết toán lịch sử trước tháng được chọn và không được ghi đè sau khi lưu.</p>
            {readiness.canConfigure ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="w-full max-w-xs"><MonthPicker value={setupMonth} onChange={setSetupMonth} /></div>
                <button onClick={() => void configureFirstMonth()} disabled={activeAction !== null} className="rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">
                  {activeAction === 'configure' ? 'Đang lưu...' : 'Lưu tháng bắt đầu'}
                </button>
              </div>
            ) : (
              <p className="mt-3 text-xs text-amber-200">Tài khoản hiện tại chưa có quyền PAYROLL_CONFIGURE. Hãy cấp quyền này trong phần Tài khoản & quyền truy cập trước khi chọn mốc.</p>
            )}
          </div>
        )}

        {readiness?.configured && !readiness.featureEnabled && (
          <div className="mt-4 rounded-lg border border-blue-500/30 bg-blue-950/20 p-4 text-sm text-blue-100">
            Database đã có mốc quyết toán. Runtime flag <code>PAYROLL_SETTLEMENT_ENABLED</code> vẫn đang tắt nên chưa nhân sự nào có thể xem hoặc tạo quyết toán.
          </div>
        )}

        {readiness?.featureEnabled && !readiness.canView && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">Runtime đã bật nhưng tài khoản hiện tại thiếu PAYROLL_VIEW, vì vậy bảng lương vẫn bị khóa.</div>
        )}
      </div>

      {success && <p role="status" className="text-sm text-emerald-300">{success}</p>}
      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>}

      {readyForPayroll && (
        <>
          <fieldset disabled={activeAction !== null} className="max-w-xs"><MonthPicker value={month} onChange={setMonth} /></fieldset>
          {selectedMonthBeforeStart && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 p-3 text-sm text-amber-100">
              Kỳ {month} chỉ được xem để đối chiếu. Mốc quyết toán đầu tiên đã khóa ở {readiness?.firstSettlementMonth}, nên không thể xác nhận các kỳ cũ hơn.
            </div>
          )}
          {loading ? (
            <p className="text-sm text-slate-400">Đang tải bảng lương...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <CommonTable className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Nhân viên</th><th>Giờ / ca</th><th>Lương tính</th><th>Điều chỉnh</th><th>Thực nhận</th><th>Trạng thái</th><th /></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.employeeId} className="border-t border-slate-800">
                      <td className="p-3 font-medium">{row.employeeName}{Boolean(row.reopeningHistory?.length) && <details className="mt-1 text-xs text-slate-400"><summary className="cursor-pointer">Lịch sử mở lại ({row.reopeningHistory?.length})</summary><ul className="mt-2 space-y-2">{row.reopeningHistory?.map((item, index) => <li key={`${item.reopenedAt}:${index}`}>{item.actorName} · {new Date(item.reopenedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}<span className="block">{item.reason}</span></li>)}</ul></details>}</td>
                      <td>{row.workedHours} giờ / {row.calculatedShifts} ca</td>
                      <td>{money.format(row.baseSalary)}</td>
                      <td>{money.format(row.adjustmentTotal)}{row.approvedAdjustments.length > 0 && <details className="mt-1 text-xs text-slate-400"><summary className="cursor-pointer">{row.approvedAdjustments.length} lần điều chỉnh</summary><ul className="mt-2 space-y-2">{row.approvedAdjustments.map(item => <li key={item.id}>{money.format(item.amount)} · {item.reason}<span className="block">{new Date(item.approvedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span></li>)}</ul></details>}</td>
                      <td className="font-bold">{money.format(row.finalPayableAmount)}</td>
                      <td>{row.settlementStatus === 'SETTLED' ? 'Đã chốt lương' : 'Đang mở'}{row.settledAt && <span className="mt-1 block text-xs text-slate-400">Chốt: {row.settledByName || 'Chưa ghi nhận'} · {new Date(row.settledAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}</span>}</td>
                      <td className="p-3"><TableRowActions renderActions={function renderRowActions() { return <>
                        {row.settlementStatus === 'UNSETTLED' && readiness?.canSettle && <button disabled={activeAction !== null || selectedMonthBeforeStart} title={selectedMonthBeforeStart ? `Chỉ được quyết toán từ ${readiness.firstSettlementMonth}` : undefined} onClick={() => void settle(row.employeeId)} className="rounded-lg bg-blue-600 px-3 py-2 font-bold hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-40">{activeAction === `settle:${row.employeeId}` ? 'Đang xác nhận...' : selectedMonthBeforeStart ? 'Ngoài kỳ' : 'Chốt lương'}</button>}
                        {row.settlementStatus === 'SETTLED' && row.settlementId && readiness?.canReopen && <button disabled={activeAction !== null} onClick={() => setActionDialog({ row, action: 'reopen' })} className="rounded-lg border border-amber-700 px-3 py-2 font-bold text-amber-200 disabled:opacity-50">Mở lại kỳ lương</button>}
                        {row.settlementStatus === 'SETTLED' && row.settlementId && readiness?.canAdjust && <button disabled={activeAction !== null} onClick={() => setActionDialog({ row, action: 'adjust' })} className="rounded-lg border border-slate-600 px-3 py-2 font-bold hover:bg-slate-800 disabled:opacity-60">{activeAction === `adjust:${row.settlementId}` ? 'Đang điều chỉnh...' : 'Điều chỉnh'}</button>}
                      </>; }} /></td>
                    </tr>
                  ))}
                </tbody>
              </CommonTable>
              {rows.length === 0 && <p className="p-8 text-center text-slate-400">Không có dữ liệu lương trong tháng đã chọn.</p>}
            </div>
          )}
        </>
      )}
      {actionDialog && <PayrollActionDialog key={`${actionDialog.row.settlementId}:${actionDialog.action}`} {...actionDialog} onBusy={busy => { lock.current = busy; setActiveAction(busy ? actionDialog.action : null); }} onClose={() => setActionDialog(null)} onSaved={async () => { await loadPayroll(); setSuccess(actionDialog.action === 'reopen' ? 'Đã mở lại kỳ lương. Có thể chấm công tiếp và chốt lại.' : 'Đã lưu điều chỉnh tiền lương.'); }} />}
    </section>
  );
}
