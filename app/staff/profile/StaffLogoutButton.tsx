'use client';

import { useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { createClient } from '@/utils/supabase/client';
import { navigateAfterLogout, signOutCurrentDevice } from '@/utils/auth/logout';

export default function StaffLogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const logoutStartedRef = useRef(false);
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<{ message: string; supportId: string } | null>(null);

  const handleLogout = async () => {
    if (logoutStartedRef.current) return;
    logoutStartedRef.current = true;

    setLoggingOut(true);
    setError(null);
    showGlobalLoading('Đang đăng xuất...');

    const result = await signOutCurrentDevice(supabase.auth);
    if (!result.ok) {
      setError({
        message: result.message,
        supportId: crypto.randomUUID(),
      });
      logoutStartedRef.current = false;
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
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-bold text-red-200 transition hover:bg-red-500/15 disabled:cursor-wait disabled:opacity-60"
      >
        {!loggingOut && <LogOut className="h-4 w-4" />}
        <ButtonLoadingState loading={loggingOut} loadingText="Đang đăng xuất..." idleText="Đăng xuất" />
      </button>
      {error && (
        <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-center text-[11px] text-red-200">
          {error.message} Mã hỗ trợ: <span className="font-mono">{error.supportId}</span>
        </p>
      )}
    </div>
  );
}
