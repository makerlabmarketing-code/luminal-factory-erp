'use client';

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { containModalFocus } from '@/lib/modal-focus';

export function ProjectCreateDialog({ busy, onClose, children }: {
  busy: boolean; onClose: () => void; children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const state = useRef({ busy, onClose });
  useEffect(() => { state.current = { busy, onClose }; }, [busy, onClose]);
  useEffect(() => {
    if (!panel.current) return;
    return containModalFocus(panel.current, {
      initialFocus: '#project-name',
      onEscape: () => { if (!state.current.busy) state.current.onClose(); },
    });
  }, []);
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="project-create-title" aria-describedby="project-create-description" aria-busy={busy} tabIndex={-1} className="max-h-[90dvh] w-full max-w-2xl overflow-y-auto rounded-lg border border-slate-800 bg-slate-900 p-5 space-y-4">
        {children}
      </div>
    </div>, document.body,
  );
}
