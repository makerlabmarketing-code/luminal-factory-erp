export default function AccountsLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-24 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
        <div className="h-16 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
        <div className="space-y-2 rounded-lg border border-slate-800 bg-slate-900 p-4">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="h-12 animate-pulse rounded bg-slate-800/60" />
          ))}
        </div>
      </div>
    </main>
  );
}
