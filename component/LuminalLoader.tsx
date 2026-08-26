interface LuminalLoaderProps {
  message?: string;
  compact?: boolean;
}

export function LuminalLoadingMark({ compact = false }: Pick<LuminalLoaderProps, 'compact'>) {
  return (
    <div
      className={compact ? 'luminal-loader luminal-loader--compact' : 'luminal-loader'}
      aria-hidden="true"
    >
      <div className="luminal-loader__orbit">
        <span className="luminal-loader__tile luminal-loader__tile--one" />
        <span className="luminal-loader__tile luminal-loader__tile--two" />
        <span className="luminal-loader__tile luminal-loader__tile--three" />
        <span className="luminal-loader__tile luminal-loader__tile--four" />
      </div>
      <span className="luminal-loader__core">LF</span>
    </div>
  );
}

export function CenteredPageLoading({
  message = 'Đang tải dữ liệu...',
}: Omit<LuminalLoaderProps, 'compact'>) {
  return (
    <main
      className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-slate-950 px-4 py-12 text-slate-100"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="flex flex-col items-center gap-5 text-center">
        <LuminalLoadingMark />
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-100">{message}</p>
          <p className="text-xs text-slate-500">Luminal Factory ERP</p>
        </div>
      </div>
    </main>
  );
}
