'use client';

import Link from 'next/link';
import { FormEvent, useState } from 'react';
import { Mail, RefreshCcw } from 'lucide-react';
import { supabase } from '@/utils/supabase/client';
import {
  getPasswordRecoveryConfigurationError,
  PASSWORD_RECOVERY_RATE_LIMIT_MESSAGE,
  PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE,
  sendPasswordRecoveryEmail,
} from '@/utils/auth/password-recovery';

const neutralMessage =
  'Nếu email tồn tại trong hệ thống, hướng dẫn đặt lại mật khẩu sẽ được gửi.';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; tone: 'error' | 'success' } | null>(
    null
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const configurationError = getPasswordRecoveryConfigurationError();
    if (configurationError) {
      setFeedback({ message: configurationError, tone: 'error' });
      setSubmitting(false);
      return;
    }

    const outcome = await sendPasswordRecoveryEmail(supabase.auth, email);

    if (outcome.ok) {
      setFeedback({ message: neutralMessage, tone: 'success' });
    } else {
      setFeedback({
        message:
          outcome.reason === 'rate_limited'
            ? PASSWORD_RECOVERY_RATE_LIMIT_MESSAGE
            : PASSWORD_RECOVERY_UNAVAILABLE_MESSAGE,
        tone: 'error',
      });
    }
    setSubmitting(false);
  };

  return (
    <main className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-100 font-sans">
      <form
        onSubmit={handleSubmit}
        className="admin-card w-full max-w-sm space-y-5 p-6 sm:p-8"
      >
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-2xl flex items-center justify-center mx-auto">
            <Mail className="w-5 h-5" />
          </div>
          <h1 className="text-base font-bold">Quên mật khẩu</h1>
          <p className="text-xs text-slate-400">Nhập email để nhận hướng dẫn đặt lại mật khẩu.</p>
        </div>

        <div className="space-y-2">
          <label className="block text-xs font-bold text-slate-300" htmlFor="reset-email">
            Email
          </label>
          <input
            id="reset-email"
            type="email"
            className="admin-field"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={submitting}
            autoComplete="email"
            required
          />
        </div>

        {feedback && (
          <p
            role={feedback.tone === 'error' ? 'alert' : 'status'}
            aria-live="polite"
            className={`text-[11px] text-center font-bold ${
              feedback.tone === 'error' ? 'text-red-400' : 'text-emerald-400'
            }`}
          >
            {feedback.message}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-purple-600 hover:bg-purple-700 disabled:opacity-60 p-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1"
        >
          {submitting ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : 'Gửi hướng dẫn'}
        </button>

        <Link href="/admin/dashboard" className="block text-center text-xs text-slate-400 hover:text-slate-100">
          Quay lại đăng nhập
        </Link>
      </form>
    </main>
  );
}
