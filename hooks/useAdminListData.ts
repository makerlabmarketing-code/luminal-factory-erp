'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type AdminListErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'employee_list_load_failed'
  | 'account_list_load_failed'
  | 'facility_list_load_failed'
  | 'facility_schema_unavailable'
  | 'request_timeout'
  | 'service_unavailable';

export function useAdminListData<T>({
  initialData,
  initialError = null,
  request,
  timeoutMs = 12_000,
}: {
  initialData?: T;
  initialError?: AdminListErrorCode | null;
  request: (signal: AbortSignal) => Promise<T>;
  timeoutMs?: number;
}) {
  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<AdminListErrorCode | null>(initialError);
  const [isLoading, setIsLoading] = useState(initialData === undefined && !initialError);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const requestRef = useRef(request);
  const sequenceRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => { requestRef.current = request; }, [request]);

  const refresh = useCallback(async () => {
    const sequence = ++sequenceRef.current;
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    data === undefined ? setIsLoading(true) : setIsRefreshing(true);
    setError(null);
    let timedOut = false;
    const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);

    try {
      const nextData = await requestRef.current(controller.signal);
      if (sequence === sequenceRef.current && !controller.signal.aborted) setData(nextData);
    } catch (requestError) {
      if (sequence !== sequenceRef.current) return;
      if (timedOut) setError('request_timeout');
      else if (!controller.signal.aborted) setError(requestError instanceof AdminListRequestError ? requestError.code : 'service_unavailable');
    } finally {
      window.clearTimeout(timeout);
      if (sequence === sequenceRef.current) { setIsLoading(false); setIsRefreshing(false); }
    }
  }, [data, timeoutMs]);

  useEffect(() => {
    if (initialData === undefined && !initialError) void refresh();
    return () => { sequenceRef.current += 1; controllerRef.current?.abort(); };
    // Initial request must run once; refresh remains available for local retries.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { data, error, isLoading, isRefreshing, refresh };
}

export class AdminListRequestError extends Error {
  constructor(public readonly code: AdminListErrorCode) { super(code); }
}
