'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Body portal keeps dialogs outside animated panels; notifications stay above it. */
export function ProjectActionDialog({ titleId, descriptionId, busy, onClose, children }: {
  titleId: string;
  descriptionId?: string;
  busy: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose);
  const saving = useRef(busy);
  useEffect(() => { close.current = onClose; saving.current = busy; }, [onClose, busy]);

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const root = panel.current;
    const focusable = () => Array.from(root?.querySelectorAll<HTMLElement>('input:not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled), [tabindex="0"]') || []);
    focusable().find(element => element.tagName !== 'BUTTON')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        if (!saving.current) close.current();
      }
      if (event.key !== 'Tab') return;
      const targets = focusable();
      const first = targets[0];
      const last = targets.at(-1);
      if (!first) { event.preventDefault(); root?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !root?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !root?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/85 p-4">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} aria-busy={busy} tabIndex={-1} className="relative max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-xl border border-slate-700 bg-slate-900 p-5 text-slate-100 shadow-2xl">
        <button type="button" onClick={onClose} disabled={busy} aria-label="Đóng hộp thoại" className="absolute right-3 top-3 rounded p-2 text-slate-400 hover:bg-slate-800 focus-visible:outline-cyan-300 disabled:opacity-40"><X className="h-4 w-4" /></button>
        {children}
      </div>
    </div>, document.body
  );
}
