'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { createClient } from '@/utils/supabase/client';
import { navigateAfterLogout, signOutCurrentDevice } from '@/utils/auth/logout';

export default function AdminLogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState('');

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setError('');
    showGlobalLoading('Đang đăng xuất...');

    const result = await signOutCurrentDevice(supabase.auth);

    if (!result.ok) {
      setError(result.message);
      setLoggingOut(false);
      hideGlobalLoading();
      return;
    }

    router.replace('/');
    router.refresh();
    navigateAfterLogout('/');
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
        className="flex w-full items-center gap-3 px-4 py-3 text-slate-500 hover:text-red-400 disabled:opacity-60 text-xs font-bold transition"
      >
        {!loggingOut && <LogOut className="w-4 h-4" />}
        <ButtonLoadingState loading={loggingOut} loadingText="Đang đăng xuất..." idleText="Đăng xuất" />
      </button>
      {error && <p className="px-4 text-[11px] font-bold text-red-400">{error}</p>}
    </div>
  );
}
