export default function EmployeeDetailLoading() {
  return (
    <main className="min-h-screen bg-slate-950 p-6 text-slate-100">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="h-24 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="h-40 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
          <div className="h-40 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
          <div className="h-40 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
        </div>
        <div className="h-72 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
      </div>
    </main>
  );
}
