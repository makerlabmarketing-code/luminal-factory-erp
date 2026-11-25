'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import RaffleDispatchDetails from './RaffleDispatchDetails';
import { raffleDateToVietnamInput } from '@/lib/commerce-admin/raffle-draft';
import { raffleActions, raffleAllocationLabels, raffleFulfillmentDueInput,
  type RaffleAction, type RaffleAllocation } from '@/lib/commerce-admin/raffle-operations';

type Candidate = { id: string; name: string; email: string; country: string };
type Operations = {
  allocations: RaffleAllocation[];
  candidates: Candidate[];
  canSelect: boolean;
  canConfirmPayment: boolean;
  canFulfill: boolean;
};
type Selection = { action: RaffleAction; allocation?: RaffleAllocation };

function vietnamTime(value: string | null) {
  const input = raffleDateToVietnamInput(value);
  return input ? input.slice(0, 16).replace('T', ' ') : '—';
}

export default function RaffleOperationsEditor({ raffleId, revision, onChanged }: {
  raffleId: string;
  revision: number;
  onChanged: () => void;
}) {
  const endpoint = `/api/admin/commerce/raffles/${raffleId}/operations`;
  const [operations, setOperations] = useState<Operations>();
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadedVersion, setLoadedVersion] = useState('');
  const version = `${endpoint}:${loadAttempt}:${revision}`;
  const loading = loadedVersion !== version;
  const [selection, setSelection] = useState<Selection>();
  const [search, setSearch] = useState('');
  const [candidateId, setCandidateId] = useState('');
  const [detail, setDetail] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const inFlight = useRef(false);
  const pending = useRef<{ fingerprint: string; operationId: string } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { cache: 'no-store', signal: controller.signal })
      .then(async response => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error();
        setOperations(result);
        setLoadError('');
      })
      .catch(() => { if (!controller.signal.aborted) setLoadError('Không thể tải danh sách suất trúng.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadedVersion(version); });
    return () => controller.abort();
  }, [endpoint, version]);

  function choose(action: RaffleAction, allocation?: RaffleAllocation) {
    setSelection({ action, allocation });
    setDetail(action === 'fulfillment' ? raffleFulfillmentDueInput(allocation?.paid_at ?? null) : '');
    setCandidateId('');
    setSearch('');
    setVerified(false);
    setActionError('');
    setNotice('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selection || inFlight.current || loading || loadError) return;
    const { action, allocation } = selection;
    const candidate = operations?.candidates.find(item => item.id === candidateId);
    if ((action === 'select' || action === 'reallocate') && !candidate) return;
    const inputs = {
      select: { entryId: candidateId },
      reallocate: { replacementEntryId: candidateId },
      cancel: { reason: detail.trim() },
      'confirm-payment': { paymentReference: detail.trim(), verified },
      fulfillment: { fulfillmentDue: detail },
      complete: { note: detail.trim() },
    };
    const payload = { action, allocationId: allocation?.id, ...inputs[action] };
    const fingerprint = JSON.stringify(payload);
    if (pending.current?.fingerprint !== fingerprint) {
      const target = allocation?.public_code ?? candidate?.name;
      const replacement = action === 'reallocate' ? ` → ${candidate?.name}` : '';
      if (!window.confirm(`${raffleActions[action].label} · ${target}${replacement}?`)) return;
      pending.current = { fingerprint, operationId: crypto.randomUUID() };
    }
    inFlight.current = true;
    setBusy(true);
    setActionError('');
    try {
      const response = await fetch(endpoint, {
        method: 'POST', cache: 'no-store', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, operationId: pending.current.operationId }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(response.status === 409 && typeof result.message === 'string'
          ? result.message : 'Không xác nhận được kết quả. Thử lại với cùng thông tin hoặc tải lại danh sách.');
      }
      pending.current = null;
      setSelection(undefined);
      setNotice('Đã cập nhật suất trúng.');
      setLoadAttempt(value => value + 1);
      onChanged();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Không thể cập nhật suất trúng.');
    } finally {
      setBusy(false);
      inFlight.current = false;
    }
  }

  const action = selection?.action;
  const pickCandidate = action === 'select' || action === 'reallocate';
  const candidateList = operations?.candidates ?? [];
  const query = search.trim().toLowerCase();
  const candidates = pickCandidate ? candidateList.filter(candidate => candidate.id === candidateId
    || `${candidate.name} ${candidate.email} ${candidate.country}`.toLowerCase().includes(query)) : [];
  const visibleCandidates = candidates.slice(0, 60);
  const chosenCandidate = candidates.find(candidate => candidate.id === candidateId);
  if (chosenCandidate && !visibleCandidates.includes(chosenCandidate)) visibleCandidates.push(chosenCandidate);
  const disabled = busy || loading || !!loadError;
  return <section className="admin-card space-y-4 p-4 sm:p-5" aria-labelledby="raffle-operations">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 className="font-bold" id="raffle-operations">Vận hành suất trúng</h2>
      <button type="button" className="admin-button-secondary" disabled={busy || loading} onClick={() => setLoadAttempt(value => value + 1)}>Tải lại</button>
    </div>
    {loadError && <p role="alert" className="text-sm text-red-300">{loadError}</p>}
    {loading && <p role="status" className="text-sm text-slate-400">Đang tải suất trúng…</p>}
    {notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}
    {operations && <>
      {operations.canSelect && <div className="space-y-2">
        <p className="text-sm text-slate-400">Ghi nhận kết quả đã bốc thăm sau khi đợt đóng.</p>
        <button type="button" className="admin-button-secondary" disabled={disabled || !candidateList.length} onClick={() => choose('select')}>{raffleActions.select.label}</button>
        {!candidateList.length && <p className="text-sm text-slate-400">Chưa có người tham gia đủ thông tin để chọn.</p>}
      </div>}
      {operations.allocations.length ? <ul className="divide-y divide-white/10">
        {operations.allocations.map(allocation => <li className="flex flex-wrap items-center justify-between gap-3 py-3" key={allocation.id}>
          <div className="space-y-1">
            <p className="text-sm font-semibold">{allocation.public_code} · {raffleAllocationLabels[allocation.status]}</p>
            {allocation.status === 'PAYMENT_PENDING' && <p className="text-xs text-slate-400">Hạn thanh toán {vietnamTime(allocation.payment_deadline_at)} (giờ Việt Nam)</p>}
            {allocation.fulfillment_due_at && <p className="text-xs text-slate-400">Hạn gửi {vietnamTime(allocation.fulfillment_due_at)} (giờ Việt Nam)</p>}
            {allocation.status === 'COMPLETED' && operations.canFulfill &&
              <RaffleDispatchDetails endpoint={endpoint} allocationId={allocation.id} />}
          </div>
          <div className="flex flex-wrap gap-2">
            {allocation.status === 'SELECTED' && <a className="admin-button-secondary" href="#raffle-payment-quotes">Soạn báo giá</a>}
            {allocation.status === 'PAYMENT_PENDING' && operations.canConfirmPayment &&
              <button type="button" className="admin-button-secondary" disabled={disabled} onClick={() => choose('confirm-payment', allocation)}>Xác nhận nhận tiền</button>}
            {allocation.status === 'PAID' && operations.canFulfill &&
              <button type="button" className="admin-button-secondary" disabled={disabled} onClick={() => choose('fulfillment', allocation)}>Chuẩn bị hàng</button>}
            {allocation.status === 'FULFILLING' && operations.canFulfill &&
              <button type="button" className="admin-button-secondary" disabled={disabled} onClick={() => choose('complete', allocation)}>Ghi nhận đã gửi</button>}
            {['SELECTED', 'CONFIRMED', 'PAYMENT_PENDING'].includes(allocation.status) &&
              <button type="button" className="admin-button-secondary" disabled={disabled} onClick={() => choose('cancel', allocation)}>Hủy suất</button>}
            {allocation.status === 'CANCELLED' && operations.canSelect && candidateList.length > 0 &&
              <button type="button" className="admin-button-secondary" disabled={disabled} onClick={() => choose('reallocate', allocation)}>Chọn người thay thế</button>}
          </div>
        </li>)}
      </ul> : <p className="text-sm text-slate-400">Chưa có suất trúng.</p>}
    </>}
    {selection && action && <form onSubmit={submit} className="space-y-3 border-t border-white/10 pt-4" aria-label={raffleActions[action].label}>
      <h3 className="text-sm font-semibold">{raffleActions[action].label}{selection.allocation && ` · ${selection.allocation.public_code}`}</h3>
      <fieldset disabled={disabled} className="space-y-3">
        {pickCandidate && <>
          <label className="admin-label">Tìm người tham gia
            <input type="search" className="admin-field mt-2" value={search} onChange={event => setSearch(event.target.value)} />
          </label>
          {candidates.length > 60 && <p className="text-xs text-slate-400">Có {candidates.length} kết quả. Nhập thêm tên hoặc email để thu gọn.</p>}
          <label className="admin-label">Người tham gia
          <select required className="admin-field mt-2" value={candidateId} onChange={event => setCandidateId(event.target.value)}>
            <option value="">Chọn người tham gia</option>
            {visibleCandidates.map(candidate => <option key={candidate.id} value={candidate.id}>{candidate.name} · {candidate.email} · {candidate.country}</option>)}
          </select>
        </label></>}
        {action === 'cancel' && <label className="admin-label">Lý do hủy
          <textarea required minLength={3} maxLength={500} className="admin-field mt-2" value={detail} onChange={event => setDetail(event.target.value)} />
        </label>}
        {action === 'confirm-payment' && <>
          <label className="admin-label">Mã giao dịch đã đối soát
            <input required maxLength={160} className="admin-field mt-2" value={detail} onChange={event => setDetail(event.target.value)} />
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" required checked={verified} onChange={event => setVerified(event.target.checked)} />Đã đối chiếu đúng giao dịch và số tiền thực nhận.</label>
        </>}
        {action === 'fulfillment' && <label className="admin-label">Hạn gửi hàng (giờ Việt Nam)
          <input type="datetime-local" step={1} required className="admin-field mt-2" value={detail} onChange={event => setDetail(event.target.value)} />
        </label>}
        {action === 'complete' && <label className="admin-label">Hãng vận chuyển và mã theo dõi
          <input required maxLength={500} className="admin-field mt-2" value={detail} onChange={event => setDetail(event.target.value)} />
          <span className="mt-1 block text-xs text-slate-400">Thông tin được lưu trong lịch sử thao tác.</span>
        </label>}
        <div className="flex flex-wrap gap-2">
          <button type="submit" className="admin-button-primary">{busy ? 'Đang cập nhật…' : 'Xác nhận'}</button>
          <button type="button" className="admin-button-secondary" onClick={() => { setSelection(undefined); setActionError(''); }}>Đóng</button>
        </div>
      </fieldset>
      {actionError && <p role="alert" className="text-sm text-red-300">{actionError}</p>}
    </form>}
  </section>;
}
