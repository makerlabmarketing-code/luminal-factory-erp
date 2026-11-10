import { Search } from 'lucide-react';
import type { ReactNode } from 'react';

export const peopleFilterClassName = 'rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200';

export function PeopleListToolbar({ title, count, children }: { title: string; count?: number; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-slate-800 bg-slate-950/40 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
      <h2 className="text-xs font-bold uppercase text-slate-400">
        {title}{count !== undefined && ` (${count})`}
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">{children}</div>
    </div>
  );
}

export function PeopleSearch({ value, onChange, placeholder }: {
  value: string; onChange: (value: string) => void; placeholder: string;
}) {
  return (
    <div className="relative sm:w-72">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" aria-hidden="true" />
      <input type="search" aria-label={placeholder} value={value} onChange={event => onChange(event.target.value)}
        placeholder={placeholder} className={`${peopleFilterClassName} w-full pl-9`} />
    </div>
  );
}
