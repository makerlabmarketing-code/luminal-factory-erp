'use client';

import { useEffect, useState } from 'react';
import { raffleDateToVietnamInput } from '@/lib/commerce-admin/raffle-draft';
import { isRaffleDispatchResult, type RaffleDispatchRecord } from '@/lib/commerce-admin/raffle-operations';

function DispatchRecord({ url }: { url: string }) {
  const [record, setRecord] = useState<RaffleDispatchRecord | null>();
  const [error, setError] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(url, { cache: 'no-store', signal: controller.signal });
        const data: unknown = await response.json();
        if (!response.ok || !isRaffleDispatchResult(data)) throw new Error();
        if (!controller.signal.aborted) setRecord(data.tracking);
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void load();
    return () => controller.abort();
  }, [url]);

  async function copy(note: string) {
    try {
      await navigator.clipboard.writeText(note);
      setCopyStatus('Đã sao chép.');
    } catch {
      setCopyStatus('Hãy chọn và sao chép nội dung bên trên.');
    }
  }

  if (error) return <p role="alert" className="text-sm text-red-300">Không thể tải thông tin gửi hàng. Đóng rồi mở lại để thử.</p>;
  if (record === undefined) return <p role="status" className="text-sm text-slate-400">Đang tải thông tin gửi hàng…</p>;
  if (record === null) return <p className="text-sm text-slate-400">Chưa có lịch sử gửi hàng cho suất này.</p>;
  const { note } = record;
  const vietnamTime = raffleDateToVietnamInput(record.completedAt).slice(0, 16).replace('T', ' ');
  return <div className="space-y-2 text-sm">
    <p className="text-slate-400">Đã gửi {vietnamTime} (giờ Việt Nam)</p>
    {note ? <>
      <p className="max-w-prose whitespace-pre-wrap break-all">{note}</p>
      <button type="button" className="admin-button-secondary" onClick={() => void copy(note)}>Sao chép thông tin</button>
      <span role="status" className="block text-slate-400">{copyStatus}</span>
    </> : <p className="text-slate-400">Lần gửi này chưa lưu mã theo dõi.</p>}
  </div>;
}

export default function RaffleDispatchDetails({ endpoint, allocationId }: { endpoint: string; allocationId: string }) {
  const [open, setOpen] = useState(false);
  const panelId = `raffle-dispatch-${allocationId}`;
  const url = `${endpoint}?tracking=${encodeURIComponent(allocationId)}`;
  return <div className="space-y-2">
    <button type="button" className="admin-button-secondary" aria-expanded={open} aria-controls={panelId}
      onClick={() => setOpen(previous => !previous)}>{open ? 'Ẩn thông tin gửi hàng' : 'Xem thông tin gửi hàng'}</button>
    <div id={panelId} hidden={!open}>{open && <DispatchRecord key={url} url={url} />}</div>
  </div>;
}
