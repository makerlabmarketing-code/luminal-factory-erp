// app/admin/gatekeeper.tsx
'use client';
import { useState, useEffect } from 'react';
import { KeyRound, RefreshCcw } from 'lucide-react';

export default function AdminGatekeeper({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    // Check session an toàn từ cookie hệ thống
    const cookies = document.cookie.split(';');
    const hasToken = cookies.some(c => c.trim().startsWith('hq_session_token='));
    setIsAuthenticated(hasToken);
  }, []);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError('');

    try {
      const res = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode })
      });
      const result = await res.json();

      if (res.ok && result.success) {
        setIsAuthenticated(true);
      } else {
        setError(`❌ ${result.error || 'Lỗi xác thực!'}`);
      }
    } catch (err) {
      setError('❌ Lỗi kết nối cổng an ninh!');
    } finally {
      setChecking(false);
    }
  };

  if (isAuthenticated === null) {
    return <div className="min-h-screen bg-slate-950 flex items-center justify-center font-mono text-xs text-slate-500"><RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mr-2" /> Đang quét cổng an ninh...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
        <form onSubmit={handleVerify} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto border border-blue-500/20"><KeyRound className="w-6 h-6" /></div>
            <h2 className="text-sm font-black uppercase tracking-wider">Hệ Thống Xác Thực</h2>
          </div>
          <div className="space-y-1.5">
            <input 
              type="password" 
              placeholder="Nhập mã mở khóa..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-center font-mono tracking-widest text-blue-400 focus:outline-none focus:border-blue-600 transition"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              disabled={checking}
            />
            {error && <p className="text-[10px] text-red-400 text-center font-bold">{error}</p>}
          </div>
          <button type="submit" disabled={checking} className="w-full bg-blue-600 hover:bg-blue-700 font-bold text-xs p-3 rounded-xl uppercase tracking-wider transition flex items-center justify-center gap-1">
            {checking ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : 'Kích hoạt phiên làm việc'}
          </button>
        </form>
      </div>
    );
  }

  return <>{children}</>;
}