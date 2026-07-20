// component/NotificationContext.tsx
'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Info, CheckCircle2, HelpCircle, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';
interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

interface NotificationContextType {
  showToast: (title: string, desc: string, type?: ToastType, options?: ToastOptions) => void;
  showConfirm: (title: string, desc: string, onConfirm: () => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<{
    show: boolean;
    title: string;
    desc: string;
    type: ToastType;
    actionLabel?: string;
    onAction?: () => void;
    durationMs?: number;
  }>({
    show: false, title: '', desc: '', type: 'info'
  });

  const [confirm, setConfirm] = useState<{ show: boolean; title: string; desc: string; onConfirm: () => void }>({
    show: false, title: '', desc: '', onConfirm: () => {}
  });

  const showToast = (
    title: string,
    desc: string,
    type: ToastType = 'success',
    options: ToastOptions = {}
  ) => {
    setToast({
      show: true,
      title,
      desc,
      type,
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      durationMs: options.durationMs,
    });
  };

  const showConfirm = (title: string, desc: string, onConfirm: () => void) => {
    setConfirm({
      show: true,
      title,
      desc,
      onConfirm: () => {
        void onConfirm();
        setConfirm((currentConfirm) => ({ ...currentConfirm, show: false }));
      }
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!toast.show) return;
    if (toast.type === 'error') return;

    const timeout = window.setTimeout(() => {
      setToast((currentToast) => ({ ...currentToast, show: false }));
    }, toast.durationMs ?? (toast.type === 'success' ? 4500 : 9000));

    return () => window.clearTimeout(timeout);
  }, [toast.show, toast.type, toast.durationMs, toast.title, toast.desc]);

  useEffect(() => {
    if (!confirm.show) return undefined;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setConfirm((currentConfirm) => ({ ...currentConfirm, show: false }));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [confirm.show]);

  const notificationLayer = (
    <>
      {toast.show && (
        <div className="fixed right-3 top-3 z-[999999] isolate w-[calc(100vw-1.5rem)] max-w-sm font-sans sm:right-5 sm:top-5">
          <div className={`rounded-lg border p-4 shadow-2xl ${
            toast.type === 'success'
              ? 'border-emerald-800 bg-emerald-950 text-emerald-50'
              : toast.type === 'error'
                ? 'border-red-800 bg-red-950 text-red-50'
                : 'border-amber-800 bg-amber-950 text-amber-50'
          }`}>
            <div className="flex items-start gap-3">
              <div className="pt-0.5">
                {toast.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-300" />}
                {toast.type === 'error' && <AlertCircle className="h-5 w-5 text-red-300" />}
                {toast.type === 'info' && <Info className="h-5 w-5 text-amber-300" />}
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <h4 className="text-sm font-bold">{toast.title}</h4>
                <p className="text-xs leading-relaxed opacity-80 whitespace-pre-line">{toast.desc}</p>
                {toast.actionLabel && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.onAction?.();
                      setToast((currentToast) => ({ ...currentToast, show: false }));
                    }}
                    className="mt-2 rounded border border-white/20 px-2.5 py-1 text-[11px] font-bold hover:bg-white/10"
                  >
                    {toast.actionLabel}
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setToast((currentToast) => ({ ...currentToast, show: false }))}
                className="text-white/60 hover:text-white"
                aria-label="Đóng thông báo"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {confirm.show && (
        <div
          className="fixed inset-0 z-[999999] isolate flex items-center justify-center bg-black/85 p-4 font-sans backdrop-blur-sm animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="global-confirm-title"
          aria-describedby="global-confirm-desc"
        >
          <div className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-700 bg-slate-900 p-5 text-center shadow-2xl">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-amber-500/20 bg-amber-500/10 text-amber-400">
              <HelpCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h4 id="global-confirm-title" className="text-sm font-black uppercase tracking-wide text-slate-100">{confirm.title}</h4>
              <p id="global-confirm-desc" className="text-xs font-medium leading-relaxed text-slate-300">{confirm.desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 font-sans">
              <button onClick={() => setConfirm((currentConfirm) => ({ ...currentConfirm, show: false }))} className="rounded-xl border border-slate-800 bg-slate-950 p-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-850">Hủy bỏ</button>
              <button onClick={confirm.onConfirm} className="rounded-xl bg-red-600 p-2.5 text-xs font-bold text-white shadow-lg transition hover:bg-red-700">Xác nhận</button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}
      {mounted ? createPortal(notificationLayer, document.body) : null}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification bắt buộc phải nằm trong NotificationProvider');
  return context;
}
