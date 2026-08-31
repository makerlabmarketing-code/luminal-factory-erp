'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { MouseEventHandler, RefObject } from 'react';
import Link, { type LinkProps } from 'next/link';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { CenteredPageLoading, LuminalLoadingMark } from '@/component/LuminalLoader';

export type GlobalLoadingMessage =
  | 'Đang đăng nhập...'
  | 'Đang mở khu vực quản trị...'
  | 'Đang mở khu vực nhân viên...'
  | 'Đang đăng xuất...'
  | 'Đang tải dữ liệu...'
  | 'Đang tải lệnh sản xuất...'
  | 'Đang tải chi tiết lệnh sản xuất...'
  | 'Đang lưu thay đổi...'
  | 'Đang gửi lời mời...'
  | 'Đang ghi nhận vào ca...'
  | 'Đang kết thúc ca...';

interface GlobalLoadingContextValue {
  showGlobalLoading: (message: GlobalLoadingMessage) => void;
  hideGlobalLoading: () => void;
  setGlobalLoadingMessage: (message: GlobalLoadingMessage) => void;
  isGlobalLoading: boolean;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextValue | undefined>(undefined);

export function GlobalLoadingProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const minTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [message, setMessage] = useState<GlobalLoadingMessage>('Đang tải dữ liệu...');
  const [requested, setRequested] = useState(false);
  const [visible, setVisible] = useState(false);
  const [shownAt, setShownAt] = useState<number | null>(null);

  const clearTimers = useCallback(() => {
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    if (minTimerRef.current) clearTimeout(minTimerRef.current);
    delayTimerRef.current = null;
    minTimerRef.current = null;
  }, []);

  const hideGlobalLoading = useCallback(() => {
    setRequested(false);
    if (delayTimerRef.current) {
      clearTimeout(delayTimerRef.current);
      delayTimerRef.current = null;
    }

    setVisible((currentVisible) => {
      if (!currentVisible || !shownAt) return false;

      const elapsed = Date.now() - shownAt;
      const remaining = Math.max(300 - elapsed, 0);
      if (remaining > 0) {
        minTimerRef.current = setTimeout(() => {
          setVisible(false);
          setShownAt(null);
        }, remaining);
        return currentVisible;
      }

      setShownAt(null);
      return false;
    });
  }, [shownAt]);

  const showGlobalLoading = useCallback(
    (nextMessage: GlobalLoadingMessage) => {
      clearTimers();
      setMessage(nextMessage);
      setRequested(true);
      delayTimerRef.current = setTimeout(() => {
        setVisible(true);
        setShownAt(Date.now());
      }, 180);
    },
    [clearTimers]
  );

  const setGlobalLoadingMessage = useCallback((nextMessage: GlobalLoadingMessage) => {
    setMessage(nextMessage);
  }, []);

  useEffect(() => {
    if (visible) overlayRef.current?.focus();
  }, [visible]);

  useEffect(() => {
    if (requested || visible) hideGlobalLoading();
    // Route transitions own this reset; loading-state changes must not retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => () => clearTimers(), [clearTimers]);

  const value = useMemo(
    () => ({
      showGlobalLoading,
      hideGlobalLoading,
      setGlobalLoadingMessage,
      isGlobalLoading: requested || visible,
    }),
    [hideGlobalLoading, requested, setGlobalLoadingMessage, showGlobalLoading, visible]
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      <GlobalLoadingOverlay visible={visible} message={message} overlayRef={overlayRef} />
    </GlobalLoadingContext.Provider>
  );
}

function GlobalLoadingOverlay({
  visible,
  message,
  overlayRef,
}: {
  visible: boolean;
  message: GlobalLoadingMessage;
  overlayRef: RefObject<HTMLDivElement | null>;
}) {
  if (!visible) return null;

  return (
    <div
      ref={overlayRef}
      role="dialog"
      aria-modal="true"
      aria-live="polite"
      aria-busy="true"
      tabIndex={-1}
      className="fixed inset-0 z-[999998] flex items-center justify-center bg-slate-950/80 p-4 text-slate-100 backdrop-blur-sm"
      onKeyDown={(event) => {
        if (event.key === 'Tab') event.preventDefault();
      }}
    >
      <div className="flex w-full max-w-xs flex-col items-center gap-5 rounded-2xl border border-blue-400/20 bg-slate-900/95 px-6 py-8 text-center shadow-2xl shadow-blue-950/40">
        <LuminalLoadingMark />
        <p className="text-sm font-bold text-white">{message}</p>
      </div>
    </div>
  );
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);
  if (!context) throw new Error('useGlobalLoading phải nằm trong GlobalLoadingProvider');

  return context;
}

export function ButtonLoadingState({
  loading,
  loadingText,
  idleText,
}: {
  loading: boolean;
  loadingText: string;
  idleText: string;
}) {
  return (
    <>
      {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
      {loading ? loadingText : idleText}
    </>
  );
}

export function PageLoadingState({ message = 'Đang tải dữ liệu...' }: { message?: GlobalLoadingMessage }) {
  return <CenteredPageLoading message={message} />;
}

export function LoadingLink({
  children,
  loadingMessage,
  onClick,
  ...props
}: LinkProps & {
  children: React.ReactNode;
  className?: string;
  loadingMessage: GlobalLoadingMessage;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const { isGlobalLoading, showGlobalLoading } = useGlobalLoading();

  return (
    <Link
      {...props}
      aria-disabled={isGlobalLoading}
      onClick={(event) => {
        if (isGlobalLoading) {
          event.preventDefault();
          return;
        }

        showGlobalLoading(loadingMessage);
        onClick?.(event);
      }}
    >
      {children}
    </Link>
  );
}
