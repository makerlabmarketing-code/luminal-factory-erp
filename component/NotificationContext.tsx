// component/NotificationContext.tsx
'use client';
import React, { createContext, useContext, useState } from 'react';
import { X, Info, CheckCircle2, HelpCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface NotificationContextType {
  showToast: (title: string, desc: string, type?: ToastType) => void;
  showConfirm: (title: string, desc: string, onConfirm: () => void) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<{ show: boolean; title: string; desc: string; type: ToastType }>({
    show: false, title: '', desc: '', type: 'info'
  });

  const [confirm, setConfirm] = useState<{ show: boolean; title: string; desc: string; onConfirm: () => void }>({
    show: false, title: '', desc: '', onConfirm: () => {}
  });

  const showToast = (title: string, desc: string, type: ToastType = 'success') => {
    setToast({ show: true, title, desc, type });
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

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* 🔥 FIX TRIỆT ĐỂ: Dùng inline style zIndex siêu cao để ép đè lên mọi form */}
      {toast.show && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 font-sans animate-fadeIn" style={{ zIndex: 999999 }}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm text-center space-y-4 shadow-2xl relative">
            <button onClick={() => setToast(p => ({ ...p, show: false }))} className="absolute right-4 top-4 text-slate-500 hover:text-white"><X className="w-4 h-4"/></button>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mx-auto border ${toast.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : toast.type === 'error' ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
              {toast.type === 'success' && <CheckCircle2 className="w-6 h-6" />}
              {toast.type === 'error' && <X className="w-6 h-6" />}
              {toast.type === 'info' && <Info className="w-6 h-6" />}
            </div>
            <div className="space-y-1">
              <h4 className="text-sm font-black text-slate-100 uppercase tracking-wide">{toast.title}</h4>
              <p className="text-xs text-slate-400 leading-relaxed font-medium whitespace-pre-line">{toast.desc}</p>
            </div>
            <button onClick={() => setToast(p => ({ ...p, show: false }))} className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl text-xs font-bold hover:bg-slate-850 text-slate-200 transition">Xác Nhận</button>
          </div>
        </div>
      )}

      {/* 🔥 HỘP THOẠI CONFIRM CŨNG ÉP Z-INDEX CAO NHẤT */}
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