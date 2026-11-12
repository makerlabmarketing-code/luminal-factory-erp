'use client';

import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { containModalFocus } from '@/lib/modal-focus';

export default function AdminSidePanel({
  title, description, onClose, busy = false, wide = false, children, actions,
}: {
  title: string;
  description?: string;
  onClose: () => void;
  busy?: boolean;
  wide?: boolean;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef(onClose);
  const saving = useRef(busy);

  useEffect(() => {
    close.current = onClose;
    saving.current = busy;
  }, [onClose, busy]);

  useEffect(() => {
    const root = panel.current;
    if (!root) return;
    return containModalFocus(root, {
      onEscape: () => { if (!saving.current) close.current(); },
    });
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/60">
      <section
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        aria-busy={busy}
        tabIndex={-1}
        className={`admin-side-panel flex h-full min-h-0 w-full flex-col border-slate-700 bg-slate-900 text-slate-100 shadow-2xl sm:border-l ${wide ? 'sm:max-w-4xl' : 'sm:max-w-lg'}`}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-800 px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-lg font-bold">{title}</h2>
            {description && <p id={descriptionId} className="mt-1 break-words text-sm text-slate-400">{description}</p>}
          </div>
          <button type="button" aria-label="Đóng panel" disabled={busy} onClick={onClose} className="admin-icon-button shrink-0 disabled:opacity-50">
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-6">{children}</div>
        {actions && <footer className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-slate-800 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">{actions}</footer>}
      </section>
    </div>,
    document.body,
  );
}
