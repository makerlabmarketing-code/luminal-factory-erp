import type { ProjectChecklistStage } from '@/lib/project-checklist';
import { removeChecklistTask } from '@/lib/project-checklist';

interface Props {
  stages: ProjectChecklistStage[];
  onChange: (stages: ProjectChecklistStage[]) => void;
  employees: Array<{ employeeId: number; fullName: string }>;
  managerEmployeeId: string;
  projectDeadline: string;
}

export function ProjectChecklistEditor({ stages, onChange, employees, managerEmployeeId, projectDeadline }: Props) {
  const update = (index: number, patch: Partial<ProjectChecklistStage>) => onChange(stages.map((stage, position) => position === index ? { ...stage, ...patch } : stage));
  return <div className="space-y-3">
    <p className="text-xs text-slate-400">Mỗi giai đoạn phân công một lần. Các mục bên trong dùng cùng người làm và hạn; chỉ mở tùy chỉnh khi khác.</p>
    {stages.map((stage, index) => <details key={stage.type} className="rounded-xl border border-slate-700 bg-slate-950">
      <summary className="cursor-pointer p-3 text-sm font-semibold text-slate-200">{index + 1}. {stage.name} <span className="font-normal text-slate-400">· {stage.taskNames.length} mục{stage.requiresReview ? ' · Cần duyệt' : ''}</span></summary>
      <div className="space-y-3 border-t border-slate-800 p-3">
        <label className="block text-xs text-slate-400">Tên giai đoạn<input aria-label={`Tên giai đoạn ${index + 1}`} value={stage.name} onChange={(event) => update(index, { name: event.target.value })} className="admin-field mt-1 w-full" /></label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-xs text-slate-400">Người phụ trách<select value={stage.employeeId || ''} onChange={(event) => update(index, { employeeId: event.target.value })} className="admin-field mt-1 w-full"><option value="">Theo người phụ trách dự án</option>{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}</option>)}</select></label>
          <label className="text-xs text-slate-400">Hạn riêng (tùy chọn)<input type="date" max={projectDeadline || undefined} value={stage.deadline || ''} onChange={(event) => update(index, { deadline: event.target.value })} className="admin-field mt-1 w-full" /></label>
        </div>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={stage.requiresReview === true} onChange={(event) => update(index, { requiresReview: event.target.checked })} />Giai đoạn cần quản lý duyệt</label>
        <ul className="space-y-2">{stage.taskNames.map((name, taskIndex) => <li key={taskIndex} className="rounded-lg border border-slate-800 p-2">
          <div className="flex items-center gap-2"><span aria-hidden="true" className="text-slate-500">☐</span><input aria-label={`Công việc ${taskIndex + 1} của ${stage.name}`} value={name} onChange={(event) => update(index, { taskNames: stage.taskNames.map((task, position) => position === taskIndex ? event.target.value : task) })} className="admin-field min-w-0 flex-1" /><button type="button" aria-label={`Bỏ ${name}`} onClick={() => onChange(stages.map((item, position) => position === index ? removeChecklistTask(item, taskIndex) : item))} className="p-2 text-xs text-red-300">Bỏ</button></div>
          <details className="mt-2 text-xs text-slate-400"><summary className="cursor-pointer">Người làm hoặc hạn khác</summary><div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label>Người làm<select value={stage.taskOverrides?.[taskIndex]?.employeeId || ''} onChange={(event) => update(index, { taskOverrides: { ...stage.taskOverrides, [taskIndex]: { ...stage.taskOverrides?.[taskIndex], employeeId: event.target.value } } })} className="admin-field mt-1 w-full"><option value="">Theo giai đoạn{stage.employeeId || managerEmployeeId ? '' : ' (chưa phân công)'}</option>{employees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}</option>)}</select></label>
            <label>Hạn riêng<input type="date" max={projectDeadline || undefined} value={stage.taskOverrides?.[taskIndex]?.deadline || ''} onChange={(event) => update(index, { taskOverrides: { ...stage.taskOverrides, [taskIndex]: { ...stage.taskOverrides?.[taskIndex], deadline: event.target.value } } })} className="admin-field mt-1 w-full" /></label>
          </div></details>
        </li>)}</ul>
        <div className="flex flex-wrap gap-3"><button type="button" onClick={() => update(index, { taskNames: [...stage.taskNames, 'Công việc mới'] })} className="p-2 text-xs text-cyan-300">Thêm mục</button><button type="button" disabled={index === 0} onClick={() => { const next = [...stages]; [next[index - 1], next[index]] = [next[index], next[index - 1]]; onChange(next); }} className="p-2 text-xs disabled:opacity-40">Đưa lên trước</button><button type="button" onClick={() => onChange(stages.filter((_, position) => position !== index))} className="p-2 text-xs text-red-300">Bỏ giai đoạn</button></div>
      </div>
    </details>)}
    <button type="button" onClick={() => onChange([...stages, { name: 'Giai đoạn mới', type: `CUSTOM_${crypto.randomUUID()}`, weight: 1, taskNames: [] }])} className="admin-button-secondary">Thêm giai đoạn</button>
  </div>;
}
