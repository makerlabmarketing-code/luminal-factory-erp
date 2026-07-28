'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { LogOut, RefreshCcw } from 'lucide-react';
import { ButtonLoadingState, useGlobalLoading } from '@/component/GlobalLoading';
import { createClient } from '@/utils/supabase/client';
import { navigateAfterLogout, signOutCurrentDevice } from '@/utils/auth/logout';

interface StaffPortalRecoveryActionsProps {
  retryable: boolean;
  action: 'login' | 'retry' | 'none';
}

export default function StaffPortalRecoveryActions({
  retryable,
  action,
}: StaffPortalRecoveryActionsProps) {
  const supabase = useMemo(() => createClient(), []);
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState('');

  const reloadPage = () => {
    window.location.reload();
  };

  const logout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    setLogoutError('');
    showGlobalLoading('Đang đăng xuất...');

    const result = await signOutCurrentDevice(supabase.auth);
    if (!result.ok) {
      setLogoutError(result.message);
      setLoggingOut(false);
      hideGlobalLoading();
      return;
    }

    navigateAfterLogout('/');
  };

  return (
    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-center">
      {retryable && (
        <button
          type="button"
          onClick={reloadPage}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-500/40 px-4 py-2 text-xs font-bold text-blue-200 hover:bg-blue-500/10"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Thử lại
        </button>
      )}
      {action === 'login' && (
        <>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/40 px-4 py-2 text-xs font-bold text-red-200 hover:bg-red-500/10 disabled:opacity-60"
          >
            {!loggingOut && <LogOut className="h-3.5 w-3.5" />}
            <ButtonLoadingState loading={loggingOut} loadingText="Đang đăng xuất..." idleText="Đăng xuất" />
          </button>
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700"
          >
            Đăng nhập lại
          </Link>
        </>
      )}
      {logoutError && (
        <p role="alert" className="text-center text-[11px] font-bold text-red-300 sm:basis-full">
          {logoutError}
        </p>
      )}
    </div>
  );
}
