'use client';

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
    if (lock.current || !confirm('Xác nhận quyết toán? Bản gốc sẽ không thể sửa hoặc ghi đè.')) return;
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
      await loadPayroll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể quyết toán.');
    } finally {
      lock.current = false;
      setActiveAction(null);
    }
  }

  async function adjust(settlementId: string) {
    if (lock.current) return;
    const amount = prompt('Nhập số tiền điều chỉnh (âm để khấu trừ):');
    if (!amount) return;
    const reason = prompt('Nhập lý do điều chỉnh (bắt buộc):');
    if (!reason) return;
    lock.current = true;
    setActiveAction(`adjust:${settlementId}`);
    try {
      const response = await fetch('/api/admin/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'adjust', settlementId, amount, reason }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.message);
      await loadPayroll();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không thể tạo điều chỉnh.');
    } finally {
      lock.current = false;
      setActiveAction(null);
    }
  }

  const readyForPayroll = Boolean(readiness?.schemaReady && readiness.featureEnabled && readiness.configured && readiness.canView);

  return (
    <section className="space-y-5 p-5 sm:p-8">
      <div>
        <h1 className="text-xl font-bold">Quyết toán lương tháng</h1>
        <p className="mt-1 text-sm text-slate-400">Bản quyết toán là ảnh chụp bất biến. Mọi sửa đổi được ghi thành điều chỉnh riêng.</p>
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

      {error && <div role="alert" className="rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-200">{error}</div>}

      {readyForPayroll && (
        <>
          <div className="max-w-xs"><MonthPicker value={month} onChange={setMonth} /></div>
          {loading ? (
            <p className="text-sm text-slate-400">Đang tải bảng lương...</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400"><tr><th className="p-3">Nhân viên</th><th>Giờ / ca</th><th>Lương tính</th><th>Điều chỉnh</th><th>Thực nhận</th><th>Trạng thái</th><th /></tr></thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.employeeId} className="border-t border-slate-800">
                      <td className="p-3 font-medium">{row.employeeName}</td>
                      <td>{row.workedHours} giờ / {row.calculatedShifts} ca</td>
                      <td>{money.format(row.baseSalary)}</td>
                      <td>{money.format(row.adjustmentTotal)}</td>
                      <td className="font-bold">{money.format(row.finalPayableAmount)}</td>
                      <td>{row.settlementStatus === 'SETTLED' ? 'Đã quyết toán' : 'Chưa quyết toán'}</td>
                      <td className="p-3">
                        {row.settlementStatus === 'UNSETTLED' && readiness?.canSettle && <button disabled={activeAction !== null} onClick={() => void settle(row.employeeId)} className="rounded-lg bg-blue-600 px-3 py-2 font-bold hover:bg-blue-500 disabled:opacity-60">{activeAction === `settle:${row.employeeId}` ? 'Đang xác nhận...' : 'Xác nhận'}</button>}
                        {row.settlementStatus === 'SETTLED' && row.settlementId && readiness?.canAdjust && <button disabled={activeAction !== null} onClick={() => void adjust(row.settlementId!)} className="rounded-lg border border-slate-600 px-3 py-2 font-bold hover:bg-slate-800 disabled:opacity-60">{activeAction === `adjust:${row.settlementId}` ? 'Đang điều chỉnh...' : 'Điều chỉnh'}</button>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length === 0 && <p className="p-8 text-center text-slate-400">Không có dữ liệu lương trong tháng đã chọn.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
