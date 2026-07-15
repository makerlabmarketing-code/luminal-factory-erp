'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, KeyRound, Mail, RefreshCcw } from 'lucide-react';
import { supabase } from '@/utils/supabase/client';
import { NO_WORKSPACE_PATH, validateNewPassword } from '@/utils/auth/flow';
import {
  cleanUpdatePasswordUrl,
  resolveUpdatePasswordViewState,
  type RecoverySessionStatus,
  type UpdatePasswordUrlState,
} from '@/utils/auth/update-password-state';

interface UpdatePasswordFormProps {
  initialUrlState?: UpdatePasswordUrlState;
}

export default function UpdatePasswordForm({ initialUrlState = {} }: UpdatePasswordFormProps) {
  const router = useRouter();
  const initialError = initialUrlState.error;
  const initialErrorCode = initialUrlState.errorCode;
  const mode = initialUrlState.mode === 'invite' ? 'invite' : 'recovery';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [sessionStatus, setSessionStatus] = useState<RecoverySessionStatus>('checking');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const viewState = resolveUpdatePasswordViewState(
    { error: initialError, errorCode: initialErrorCode },
    sessionStatus
  );

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const initialViewState = resolveUpdatePasswordViewState(
        { error: initialError, errorCode: initialErrorCode },
        'checking'
      );
      if (initialViewState.shouldCleanUrl) {
        router.replace(cleanUpdatePasswordUrl());
      }

      if (initialViewState.status === 'invalid') {
        setSessionStatus('invalid');
        return;
      }

      const { data, error: userError } = await supabase.auth.getUser();
      if (!isMounted) return;

      if (userError || !data.user) {
        setSessionStatus('invalid');
        return;
      }

      setSessionStatus('valid');
    }

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [initialError, initialErrorCode, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    const validation = validateNewPassword(password, confirmPassword);
    if (!validation.ok) {
      setError(validation.message || 'Mật khẩu chưa hợp lệ.');
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError('Không thể đặt mật khẩu. Vui lòng dùng lại link trong email.');
      setSaving(false);
      return;
    }

    setPassword('');
    setConfirmPassword('');
    setSuccess('Đặt mật khẩu thành công.');
    setSaving(false);

    window.setTimeout(async () => {
      try {
        const response = await fetch('/api/auth/workspaces', {
          method: 'POST',
          headers: { Accept: 'application/json' },
          credentials: 'include',
          cache: 'no-store',
        });
        const payload = (await response.json().catch(() => ({}))) as { redirectPath?: string };
        router.replace(payload.redirectPath || NO_WORKSPACE_PATH);
        router.refresh();
      } catch (_error) {
        router.replace(NO_WORKSPACE_PATH);
      }
    }, 700);
  };

  const disabled = saving;

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
      <section className="w-full max-w-sm bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl space-y-4">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
            {viewState.status === 'invalid' ? (
              <Mail className="w-5 h-5" />
            ) : (
              <KeyRound className="w-5 h-5" />
            )}
          </div>
          <h1 className="text-base font-bold">
            {mode === 'invite' ? 'Đặt mật khẩu lần đầu' : 'Đặt mật khẩu'}
          </h1>
          {viewState.status === 'valid' && (
            <p className="text-xs text-slate-400">Mật khẩu cần có ít nhất 8 ký tự.</p>
          )}
        </div>

        {viewState.status === 'checking' && (
          <p className="text-[11px] text-slate-400 text-center">Đang kiểm tra phiên đặt mật khẩu.</p>
        )}

        {viewState.status === 'invalid' && (
          <div className="space-y-3">
            <p className="text-[11px] text-red-400 text-center font-bold">
              {viewState.message}
            </p>
            <Link
              href={viewState.resendHref}
              className="w-full bg-blue-600 hover:bg-blue-700 font-bold text-xs p-3 rounded-xl transition flex items-center justify-center"
            >
              {mode === 'invite' ? 'Quay lại đăng nhập' : 'Gửi lại hướng dẫn'}
            </Link>
            <Link
              href={viewState.loginHref}
              className="block text-center text-xs text-slate-400 hover:text-slate-100"
            >
              Quay lại đăng nhập
            </Link>
          </div>
        )}

        {viewState.showForm && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300" htmlFor="new-password">
                Mật khẩu mới
              </label>
              <div className="relative">
                <input
                  id="new-password"
                  type={showPassword ? 'text' : 'password'}
                  className="w-full bg-slate-950 border border-slate-800 p-3 pr-10 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={disabled}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-2 text-slate-400 hover:text-slate-100"
                  onClick={() => setShowPassword((current) => !current)}
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-300" htmlFor="confirm-password">
                Nhập lại mật khẩu
              </label>
              <input
                id="confirm-password"
                type={showPassword ? 'text' : 'password'}
                className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-xs focus:outline-none focus:border-blue-600"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={disabled}
                autoComplete="new-password"
                required
              />
            </div>

            {error && <p className="text-[11px] text-red-400 text-center font-bold">{error}</p>}
            {success && <p className="text-[11px] text-emerald-400 text-center font-bold">{success}</p>}

            <button
              type="submit"
              disabled={disabled}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 font-bold text-xs p-3 rounded-xl transition flex items-center justify-center gap-1"
            >
              {saving ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : null}
              {saving ? 'Đang lưu' : 'Lưu mật khẩu'}
            </button>
            {saving && (
              <p className="text-[11px] text-slate-400 text-center flex items-center justify-center gap-1">
                <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                Đang lưu mật khẩu.
              </p>
            )}
          </form>
        )}
      </section>
    </main>
  );
}
