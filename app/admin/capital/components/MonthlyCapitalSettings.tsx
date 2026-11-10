'use client';

import { useEffect, useState, type FormEvent } from 'react';

interface Rate {
  employee_id: number | string;
  full_name: string;
  amount: number | string;
  effective_month: string;
  updated_at: string;
}

const endpoint = '/api/admin/finance/monthly-capital';

function formatMonth(date: string) {
  return `${date.slice(5, 7)}/${date.slice(0, 4)}`;
}

export default function MonthlyCapitalSettings({ canUpdate }: { canUpdate: boolean }) {
  const [rates, setRates] = useState<Rate[] | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loadError, setLoadError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const selected = rates?.find(rate => String(rate.employee_id) === selectedId);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if ([401, 403].includes(response.status)) return;
        if (!response.ok) throw new Error();
        const result = await response.json() as { rates: Rate[] };
        setRates(result.rates);
        setLoadError(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoadError(true);
      });
    return () => controller.abort();
  }, [refresh]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: Number(selected.employee_id), amount: Number(amount), expectedAt: selected.updated_at }),
      });
      const result = await response.json();
      if (!response.ok) {
        if (response.status === 409) setRefresh(value => value + 1);
        setMessage(result.error || 'Không lưu được mức góp vốn.');
        return;
      }
      setSelectedId('');
      setMessage(`Đã lưu mức góp áp dụng từ kỳ ${formatMonth(result.effectiveMonth)}.`);
      setRefresh(value => value + 1);
    } catch {
      setMessage('Chưa xác minh được kết quả lưu. Kiểm tra lại mức góp trước khi thử lại.');
      setRefresh(value => value + 1);
    } finally {
      setBusy(false);
    }
  }

  if (!rates && !loadError) return null;

  return (
    <details className="rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <summary className="cursor-pointer text-sm font-semibold">Mức góp vốn hằng tháng</summary>
      <p className="mt-2 text-xs text-slate-400">ERP lập phiếu ngày 10. Xác nhận đã thu khi tiền về quỹ.</p>
      {loadError && (
        <button type="button" className="admin-button-secondary mt-2" onClick={() => setRefresh(value => value + 1)}>
          Tải lại mức góp vốn
        </button>
      )}
      {rates && rates.length === 0 && <p className="mt-2 text-xs text-slate-400">Chưa có mức góp vốn được cấu hình.</p>}
      {rates && rates.length > 0 && (
        <ul className="mt-2 divide-y divide-slate-700">
          {rates.map(rate => (
            <li key={rate.employee_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <span>{rate.full_name} · {Number(rate.amount).toLocaleString('vi-VN')} đ · từ kỳ {formatMonth(rate.effective_month)}</span>
              {canUpdate && (
                <button type="button" className="admin-button-secondary" disabled={busy} onClick={() => {
                  setSelectedId(String(rate.employee_id));
                  setAmount(String(rate.amount));
                  setMessage('');
                }}>Đổi mức góp</button>
              )}
            </li>
          ))}
        </ul>
      )}
      {selected && (
        <form className="mt-3 flex flex-wrap items-end gap-2" onSubmit={save}>
          <label className="text-xs">
            Mức góp mới của {selected.full_name} (đồng)
            <input type="number" required min={1} max={999999999999} step={1} disabled={busy}
              className="mt-1 block rounded-lg border border-slate-700 bg-slate-950 p-2"
              value={amount} onChange={event => setAmount(event.target.value)} />
          </label>
          <button type="submit" className="admin-button-secondary" disabled={busy}>Lưu mức góp</button>
          <button type="button" className="admin-button-secondary" disabled={busy} onClick={() => setSelectedId('')}>Hủy</button>
        </form>
      )}
      {message && <p role="status" className="mt-2 text-xs text-slate-300">{message}</p>}
    </details>
  );
}
