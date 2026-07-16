// component/NotificationContext.tsx
'use client';
import React, { createContext, useContext, useEffect, useState } from 'react';
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
        onConfirm();
        setConfirm(p => ({ ...p, show: false }));
      }
    });
  };

  useEffect(() => {
    if (!toast.show) return;
    if (toast.type === 'error') return;

    const timeout = window.setTimeout(() => {
      setToast((currentToast) => ({ ...currentToast, show: false }));
    }, toast.durationMs ?? (toast.type === 'success' ? 4500 : 9000));

    return () => window.clearTimeout(timeout);
  }, [toast.show, toast.type, toast.durationMs, toast.title, toast.desc]);

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {toast.show && (
        <div className="fixed right-3 top-3 z-[999999] w-[calc(100vw-1.5rem)] max-w-sm font-sans sm:right-5 sm:top-5">
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
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fadeIn" style={{ zIndex: 999999 }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm text-center space-y-4 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center mx-auto"><HelpCircle className="w-6 h-6" /></div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide">{confirm.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium">{confirm.desc}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 font-sans pt-1">
              <button onClick={() => setConfirm(p => ({ ...p, show: false }))} className="bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-bold hover:bg-slate-850 text-slate-400 transition">Hủy bỏ</button>
              <button onClick={confirm.onConfirm} className="bg-red-600 hover:bg-red-700 text-white font-bold p-2.5 rounded-xl text-xs transition shadow-lg">Xác Nhận</button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification bắt buộc phải nằm trong NotificationProvider');
  return context;
}
