'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCcw } from 'lucide-react';

export const DATA_TABLE_PAGE_SIZE_OPTIONS = [5, 10, 20, 50] as const;

type DataTableHeight = 'compact' | 'standard' | 'tall' | 'viewport';

const heightClasses: Record<DataTableHeight, string> = {
  compact: 'min-h-[14rem]',
  standard: 'min-h-[22rem]',
  tall: 'min-h-[32rem]',
  viewport: 'min-h-[22rem] lg:min-h-[calc(100vh-24rem)]',
};

export function DataTableShell({
  children,
  height = 'standard',
  isRefreshing = false,
  label,
  className = '',
}: {
  children: ReactNode;
  height?: DataTableHeight;
  isRefreshing?: boolean;
  label: string;
  className?: string;
}) {
  return (
    <section
      aria-label={label}
      aria-busy={isRefreshing}
      className={`relative overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/40 ${heightClasses[height]} ${className}`}
    >
      {isRefreshing && (
        <div className="pointer-events-none absolute right-3 top-3 z-20 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900/95 px-3 py-1.5 text-[10px] font-bold text-slate-300" role="status" aria-live="polite">
          <RefreshCcw className="h-3 w-3 animate-spin" /> Đang cập nhật...
        </div>
      )}
      {children}
    </section>
  );
}

export function DataTableToolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">{children}</div>;
}

export function DataTableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="animate-pulse p-4" role="status" aria-live="polite">
      <span className="sr-only">Đang tải dữ liệu bảng...</span>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="grid gap-3 border-b border-slate-800/70 py-4" style={{ gridTemplateColumns: `repeat(${columns}, minmax(5rem, 1fr))` }}>
          {Array.from({ length: columns }).map((__, column) => <span key={column} className="h-3 rounded bg-slate-800" />)}
        </div>
      ))}
    </div>
  );
}

export function DataTableEmpty({ message }: { message: string }) {
  return <div className="flex min-h-[14rem] items-center justify-center p-6 text-center text-sm text-slate-400">{message}</div>;
}

export function DataTableError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex min-h-[14rem] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-red-200" role="alert">
      <AlertTriangle className="h-6 w-6 text-red-400" />
      <p>{message}</p>
      {onRetry && <button type="button" onClick={onRetry} className="rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-400">Thử lại</button>}
    </div>
  );
}

export function DataTablePagination({ page, pageSize, total, onPageChange, onPageSizeChange }: {
  page: number; pageSize: number; total: number; onPageChange: (page: number) => void; onPageSizeChange?: (size: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  return (
    <div className="flex flex-col gap-3 border-t border-slate-800 px-3 py-3 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
      <span>{total} kết quả · Trang {safePage}/{totalPages}</span>
      <div className="flex items-center gap-2">
        {onPageSizeChange && <label className="flex items-center gap-2">Số dòng<select aria-label="Số dòng mỗi trang" value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))} className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-slate-200">{DATA_TABLE_PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>}
        <button type="button" aria-label="Trang trước" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} className="rounded border border-slate-700 p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
        <button type="button" aria-label="Trang sau" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} className="rounded border border-slate-700 p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}
