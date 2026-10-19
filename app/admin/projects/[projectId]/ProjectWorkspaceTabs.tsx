'use client';

export type ProjectWorkspaceTab = 'work' | 'members' | 'info';
const TABS: Array<{ id: ProjectWorkspaceTab; label: string }> = [
  { id: 'work', label: 'Công việc' },
  { id: 'members', label: 'Thành viên' },
  { id: 'info', label: 'Thông tin dự án' },
];

export function ProjectWorkspaceTabs({ active, onChange, memberCount }: {
  active: ProjectWorkspaceTab;
  onChange: (tab: ProjectWorkspaceTab) => void;
  memberCount: number;
}) {
  return <div role="tablist" aria-label="Nội dung dự án" className="flex gap-1 overflow-x-auto border-b border-slate-800">
    {TABS.map((tab, index) => <button key={tab.id} id={`project-tab-${tab.id}`} type="button" role="tab" aria-selected={active === tab.id} aria-controls={`project-panel-${tab.id}`} tabIndex={active === tab.id ? 0 : -1}
      onClick={() => onChange(tab.id)}
      onKeyDown={event => {
        const next = event.key === 'ArrowRight' ? (index + 1) % TABS.length : event.key === 'ArrowLeft' ? (index + TABS.length - 1) % TABS.length : event.key === 'Home' ? 0 : event.key === 'End' ? TABS.length - 1 : null;
        if (next === null) return;
        event.preventDefault();
        onChange(TABS[next].id);
        document.getElementById(`project-tab-${TABS[next].id}`)?.focus();
      }}
      className={`min-h-12 shrink-0 border-b-2 px-4 text-sm font-bold outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-300 ${active === tab.id ? 'border-cyan-400 text-cyan-200' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
      {tab.label}{tab.id === 'members' && <span className="ml-2 rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-300">{memberCount}</span>}
    </button>)}
  </div>;
}
