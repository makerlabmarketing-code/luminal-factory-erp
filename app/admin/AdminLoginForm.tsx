'use client';

import { FormEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { KeyRound } from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { createClient } from '@/utils/supabase/client';
import {
  ADMIN_LOGIN_STEP_MESSAGES,
  AdminLoginStep,
  navigateToAdminDashboard,
  submitAdminLogin,
  verifyAdminSessionWithApi,
} from '@/utils/auth/admin-login';

interface AdminLoginFormProps {
  message?: string;
}

export default function AdminLoginForm({ message }: AdminLoginFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { hideGlobalLoading, setGlobalLoadingMessage, showGlobalLoading } = useGlobalLoading();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(message || '');
  const [checking, setChecking] = useState(false);
  const [authStep, setAuthStep] = useState<AdminLoginStep | null>(null);
  const [authStepStatus, setAuthStepStatus] = useState<number | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checking) return;

    setChecking(true);
    setError('');
    setAuthStep(null);
    setAuthStepStatus(null);
    showGlobalLoading('Đang đăng nhập...');

    const loginResult = await submitAdminLogin({
      auth: supabase.auth,
      email,
      password,
      verifyAdminSession: verifyAdminSessionWithApi,
      onStep: (step, status) => {
        setAuthStep(step);
        setAuthStepStatus(status ?? null);
      },
    });

    if (!loginResult.ok) {
      setError(loginResult.message);
      setChecking(false);
      hideGlobalLoading();
      return;
    }

    try {
      setAuthStep('navigation_started');
      setGlobalLoadingMessage(
        loginResult.redirectPath.startsWith('/staff')
          ? 'Đang mở khu vực nhân viên...'
          : 'Đang mở khu vực quản trị...'
      );
      router.replace(loginResult.redirectPath);
      router.refresh();
      navigateToAdminDashboard(loginResult.redirectPath);
    } catch {
      setError('Không thể chuyển tới bảng điều khiển. Vui lòng thử lại.');
      setChecking(false);
      hideGlobalLoading();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 font-sans text-white">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center mx-auto border border-blue-500/20">
            <KeyRound className="w-6 h-6" />
          </div>
          <h2 className="text-sm font-bold">Đăng nhập ERP</h2>
        </div>

        <div className="space-y-2">
          <input
            type="email"
            placeholder="Email"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-600 transition"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={checking}
            autoComplete="email"
            required
          />
          <input
            type="password"
            placeholder="Mật khẩu"
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-600 transition"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={checking}
            autoComplete="current-password"
            required
          />
          {error && <p className="text-[11px] text-red-400 text-center font-bold">{error}</p>}
          {checking && authStep && !error && (
            <p className="text-[11px] text-slate-400 text-center font-bold" data-auth-step={authStep}>
              {ADMIN_LOGIN_STEP_MESSAGES[authStep]}
              {authStep === 'admin_verify_response_status' && authStepStatus ? ` (${authStepStatus})` : ''}
            </p>
          )}
        </div>

        <button type="submit" disabled={checking} className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 font-bold text-xs p-3 rounded-xl transition flex items-center justify-center gap-1">
          <ButtonLoadingState loading={checking} loadingText="Đang đăng nhập..." idleText="Đăng nhập" />
        </button>

        <Link href="/auth/forgot-password" className="block text-center text-xs text-slate-400 hover:text-slate-100">
          Quên mật khẩu?
        </Link>
      </form>
    </div>
  );
}
