'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import { raffleVietnamInputToDate } from '@/lib/commerce-admin/raffle-draft';
import { parseShippingUsd } from '@/lib/commerce-admin/raffle-shipping';

type Winner = { id: string; public_code: string; status: string };
type Quote = { to: string; subject: string; text: string };

export default function RafflePaymentQuoteEditor({ raffleId }: { raffleId: string }) {
  const endpoint = `/api/admin/commerce/raffles/${raffleId}/shipping-quotes`;
  const [winners, setWinners] = useState<Winner[]>([]);
  const [allocationId, setAllocationId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [override, setOverride] = useState(false);
  const [carrier, setCarrier] = useState('');
  const [covered, setCovered] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const pending = useRef<{ fingerprint: string; operationId: string } | null>(null);
  const inFlight = useRef(false);
  const selected = winners.find(winner => winner.id === allocationId);
  const carrierMinor = parseShippingUsd(carrier);
  const coveredMinor = parseShippingUsd(covered);
  const paymentDeadlineAt = raffleVietnamInputToDate(deadline);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.winners)) throw new Error('Báo giá không khả dụng.');
        setWinners(result.winners);
      })
      .catch(() => { if (!controller.signal.aborted) setError('Không thể tải danh sách người trúng.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [endpoint]);

  async function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setQuote(null);
    setError('');
    try {
      let response: Response;
      if (selected.status === 'PAYMENT_PENDING') {
        response = await fetch(`${endpoint}?allocation=${encodeURIComponent(allocationId)}`, { cache: 'no-store' });
      } else {
        if (!paymentDeadlineAt || (override && (carrierMinor === null || coveredMinor === null))) {
          throw new Error('Kiểm tra hạn thanh toán và số tiền.');
        }
        const input = { allocationId, paymentDeadlineAt, override: override ? { carrierMinor, coveredMinor } : undefined };
        const fingerprint = JSON.stringify(input);
        if (pending.current?.fingerprint !== fingerprint) pending.current = { fingerprint, operationId: crypto.randomUUID() };
        response = await fetch(endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...input, operationId: pending.current.operationId }),
        });
      }
      const result = await response.json();
      if (!response.ok || !result.quote) throw new Error('Không thể lấy báo giá. Kiểm tra phí tuyến và hạn thanh toán.');
      setWinners(previous => previous.map(winner => winner.id === allocationId ? { ...winner, status: 'PAYMENT_PENDING' } : winner));
      setQuote(result.quote);
      pending.current = null;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lấy báo giá.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  return <section className="admin-card space-y-4 p-4 sm:p-5" aria-labelledby="raffle-payment-quotes">
    <h2 id="raffle-payment-quotes" className="font-bold">Báo giá người trúng</h2>
    {loading && <p role="status">Đang tải danh sách người trúng…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && winners.length === 0 && <p className="text-sm text-slate-400">Chưa có người trúng cần báo giá.</p>}
    {winners.length > 0 && <form onSubmit={prepare}>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
        <label className="admin-label">Người trúng<select className="admin-field mt-2" value={allocationId} onChange={event => {
          setAllocationId(event.target.value);
          setQuote(null);
          setError('');
          setOverride(false);
          setCarrier('');
          setCovered('');
        }}>
          <option value="">Chọn mã người trúng</option>
          {winners.map(winner => <option key={winner.id} value={winner.id}>{winner.public_code} · {winner.status === 'PAYMENT_PENDING' ? 'Chờ thanh toán' : 'Chờ xác nhận'}</option>)}
        </select></label>
        {selected?.status === 'SELECTED' && <>
          <label className="admin-label">Hạn thanh toán (giờ Việt Nam)
            <input type="datetime-local" required className="admin-field mt-2" value={deadline} onChange={event => setDeadline(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input type="checkbox" checked={override} onChange={event => setOverride(event.target.checked)} />
            Dùng mức phí riêng cho đơn này
          </label>
          {override && <>
            <label className="admin-label">Cước hãng (USD)<input required inputMode="decimal" className="admin-field mt-2" value={carrier} onChange={event => setCarrier(event.target.value)} /></label>
            <label className="admin-label">Luminal hỗ trợ (USD)<input required inputMode="decimal" className="admin-field mt-2" value={covered} onChange={event => setCovered(event.target.value)} /></label>
          </>}
        </>}
        <div className="sm:col-span-2">
          <button className="admin-button-primary" disabled={!selected}>
            {busy ? 'Đang xử lý…' : selected?.status === 'PAYMENT_PENDING' ? 'Mở bản nháp email' : 'Xác nhận và soạn email'}
          </button>
        </div>
      </fieldset>
    </form>}
    {quote && <div className="space-y-3">
      <p>{quote.subject}</p>
      <textarea className="admin-field min-h-48 w-full" aria-label="Nội dung email báo giá" readOnly value={quote.text} />
      <a className="admin-button-secondary" href={`mailto:${encodeURIComponent(quote.to)}?subject=${encodeURIComponent(quote.subject)}&body=${encodeURIComponent(quote.text)}`}>Mở bản nháp trong ứng dụng email</a>
    </div>}
  </section>;
}
