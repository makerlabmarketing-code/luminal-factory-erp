'use client';

import { useEffect, useRef } from 'react';
import ActivityHistory from './ActivityHistory';

/** Native modal supplies focus containment, Escape and focus restoration. */
export default function ActivityHistoryDialog({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} onCancel={onClose} aria-label="Lịch sử giao dịch" className="admin-dialog m-auto max-w-2xl text-slate-200 backdrop:bg-slate-950/90 backdrop:backdrop-blur-sm">
    <button type="button" onClick={onClose} className="admin-button-secondary mb-3">Đóng lịch sử</button>
    <ActivityHistory entity="ledger" entityId={entityId} />
  </dialog>;
}
