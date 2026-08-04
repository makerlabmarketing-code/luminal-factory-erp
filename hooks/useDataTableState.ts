'use client';

import { useEffect, useRef, useState } from 'react';

export function clampDataTablePage(page: number, total: number, pageSize: number): number {
  return Math.min(Math.max(1, page), Math.max(1, Math.ceil(total / pageSize)));
}

export function useDataTableState({ initialPageSize = 10, queryKey, total }: { initialPageSize?: number; queryKey: string; total: number }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeValue] = useState(initialPageSize);
  const previousQueryKey = useRef(queryKey);

  useEffect(() => {
    if (previousQueryKey.current !== queryKey) {
      previousQueryKey.current = queryKey;
      setPage(1);
    }
  }, [queryKey]);

  useEffect(() => { setPage((current) => clampDataTablePage(current, total, pageSize)); }, [pageSize, total]);

  const setPageSize = (size: number) => { setPageSizeValue(size); setPage(1); };
  return { page, pageSize, setPage, setPageSize };
}
