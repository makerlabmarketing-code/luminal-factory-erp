'use client';

import { useEffect, useRef } from 'react';
import ActivityHistory from './ActivityHistory';

/** Native modal supplies focus containment, Escape and focus restoration. */
export default function ActivityHistoryDialog({ entityId, onClose }: { entityId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element?.showModal();
    return () => {
      element?.close();
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, []);

  return <dialog ref={dialog} onCancel={event => { event.preventDefault(); onClose(); }} aria-label="Lịch sử giao dịch" className="admin-dialog fixed inset-0 m-auto h-fit max-w-2xl text-slate-200 backdrop:bg-slate-950/90 backdrop:backdrop-blur-sm">
    <button type="button" onClick={onClose} className="admin-button-secondary mb-3">Đóng lịch sử</button>
    <ActivityHistory entity="ledger" entityId={entityId} />
  </dialog>;
}
