'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { navigateAfterLogout, signOutCurrentDevice } from '@/utils/auth/logout';
import { createClient } from '@/utils/supabase/client';

export function StaffLogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const logoutInFlight = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<{ message: string; correlationId: string } | null>(null);

  const handleLogout = async () => {
    if (logoutInFlight.current) return;

    logoutInFlight.current = true;
    setLoggingOut(true);
    setError(null);
    showGlobalLoading('Đang đăng xuất...');

    const result = await signOutCurrentDevice(supabase.auth);
    if (!result.ok) {
      setError({ message: result.message, correlationId: crypto.randomUUID() });
      logoutInFlight.current = false;
      setLoggingOut(false);
      hideGlobalLoading();
      return;
    }

    router.replace('/login');
    router.refresh();
    navigateAfterLogout('/login');
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-400/30 bg-red-500/5 px-4 py-3 font-bold text-red-200 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 disabled:cursor-wait disabled:opacity-60"
      >
        {!loggingOut && <LogOut aria-hidden="true" className="h-4 w-4" />}
        <ButtonLoadingState
          loading={loggingOut}
          loadingText="Đang đăng xuất..."
          idleText="Đăng xuất"
        />
      </button>
      {error && (
        <p role="alert" className="text-center text-[11px] leading-5 text-red-200">
          {error.message}{' '}
          <span className="block font-mono text-red-300/80">
            Mã hỗ trợ: {error.correlationId}
          </span>
        </p>
      )}
    </div>
  );
}
