'use client';
import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { ProjectActionDialog } from './ProjectActionDialog';
import type { ProjectMemberDTO } from '@/lib/types/project-membership';
import { samePhaseMemberIds, type PhaseMember, type PhaseMembersResponse } from '@/lib/phase-members';

export function PhaseMembersSection({ projectId, phaseId, members, membersReady, canManage, closed, legacyOwner }: {
  projectId: number; phaseId: number; members: ProjectMemberDTO[];
  membersReady: boolean; canManage: boolean; closed: boolean; legacyOwner?: string;
}) {
  const [roster, setRoster] = useState<PhaseMember[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [stale, setStale] = useState(false);
  const [saved, setSaved] = useState(false);
  const eligible = members.filter(member => member.status === 'ACTIVE' && member.isAssignable);
  const options: Array<PhaseMember & { eligible: boolean }> = [
    ...eligible.map(member => ({ employeeId: member.employeeId, fullName: member.fullName, eligible: true })),
    ...roster.filter(member => !eligible.some(candidate => candidate.employeeId === member.employeeId)).map(member => ({ ...member, eligible: false })),
  ];
  useEffect(() => {
    const controller = new AbortController();
    const load = async () => {
      setLoading(true); setLoadError(false);
      try {
        const response = await fetch(`/api/admin/projects/${projectId}/phases/${phaseId}/members`, { cache: 'no-store', signal: controller.signal });
        if (!response.ok) throw new Error('load');
        const result = await response.json() as PhaseMembersResponse;
        if (controller.signal.aborted) return;
        setEnabled(result.enabled); setRoster(result.members); setSaved(false);
      } catch { if (!controller.signal.aborted) setLoadError(true); }
      finally { if (!controller.signal.aborted) setLoading(false); }
    };
    void load();
    return () => controller.abort();
  }, [projectId, phaseId, reload]);

  const save = async () => {
    if (saving || stale || !enabled || !canManage || closed) return;
    setSaving(true); setSaveError('');
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/phases/${phaseId}/members`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeIds: selected, expectedEmployeeIds: roster.map(member => member.employeeId) }),
      });
      const result = await response.json().catch(() => null) as { message?: string; code?: string; employeeIds?: number[] } | null;
      if (!response.ok) {
        setStale(result?.code === 'phase_members_stale');
        setSaveError(result?.message || 'Không thể lưu phân công. Vui lòng thử lại.'); return;
      }
      const ids = result?.employeeIds;
      if (!ids) { setStale(true); setSaveError('Chưa xác nhận được kết quả lưu. Đóng và tải lại danh sách trước khi thử tiếp.'); return; }
      setRoster(options.filter(member => ids.includes(member.employeeId)).map(({ employeeId, fullName }) => ({ employeeId, fullName })));
      setOpen(false); setSaved(true);
    } catch { setSaveError('Kết nối bị gián đoạn. Vui lòng thử lại.'); }
    finally { setSaving(false); }
  };
  return <section className="rounded-lg border border-slate-800 p-3" aria-label="Người thực hiện giai đoạn">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="inline-flex items-center gap-2 text-xs font-bold text-slate-300"><Users className="h-4 w-4" />Người thực hiện</h3>
      {canManage && <button type="button" disabled={!enabled || loading || loadError || !membersReady || closed} onClick={() => { setSelected(roster.map(member => member.employeeId)); setSaveError(''); setStale(false); setOpen(true); }} className="rounded-lg border border-cyan-800 px-3 py-2 text-xs font-bold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40">Phân người</button>}
    </div>
    {loading ? <p role="status" className="mt-2 text-xs text-slate-500">Đang tải người thực hiện…</p> : loadError ? <div className="mt-2 flex items-center gap-3 text-xs text-amber-200" role="alert">Không thể tải phân công.<button type="button" onClick={() => setReload(value => value + 1)} className="underline">Thử lại</button></div> : !enabled ? <p className="mt-2 text-xs text-slate-500">Phân người theo giai đoạn đang chờ kích hoạt.</p> : <div className="mt-2 flex flex-wrap gap-2 text-xs">
      {roster.map(member => <span key={member.employeeId} className="rounded-full bg-slate-800 px-3 py-1.5 text-slate-200">{member.fullName}{membersReady && !eligible.some(candidate => candidate.employeeId === member.employeeId) && ' · Đã ngừng tham gia'}</span>)}
      {roster.length === 0 && <p className="text-slate-500">Chưa phân người cho giai đoạn này.</p>}
    </div>}
    {legacyOwner && <p className="mt-2 text-xs text-slate-500">Thông tin phụ trách cũ: {legacyOwner}. Chưa chuyển sang danh sách phân người.</p>}
    {saved && <p role="status" className="mt-2 text-xs text-emerald-300">Đã lưu phân công.</p>}
    {open && <ProjectActionDialog titleId="phase-members-title" descriptionId="phase-members-description" busy={saving} onClose={() => setOpen(false)}>
      <h2 id="phase-members-title" className="pr-8 text-base font-bold">Phân người cho giai đoạn</h2>
      <p id="phase-members-description" className="mt-1 text-xs text-slate-400">Tích chọn nhiều thành viên cùng làm. Bỏ chọn để rút người khỏi giai đoạn.</p>
      <div className="my-4 space-y-2">
        {options.map(member => <label key={member.employeeId} className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-800 px-3 py-3 text-sm">
          <input type="checkbox" checked={selected.includes(member.employeeId)} disabled={saving || (!member.eligible && !selected.includes(member.employeeId))} onChange={event => setSelected(current => event.target.checked ? [...current, member.employeeId] : current.filter(id => id !== member.employeeId))} className="h-4 w-4 accent-cyan-500" />
          <span>{member.fullName}{!member.eligible && <span className="block text-xs text-amber-200">Không còn tham gia dự án. Bỏ chọn trước khi lưu.</span>}</span>
        </label>)}
        {options.length === 0 && <p className="text-sm text-slate-400">Chưa có thành viên để chọn. Thêm người ở tab Thành viên trước.</p>}
      </div>
      <p className="text-xs text-slate-500">Đã chọn {selected.length} người. Phân người không tự tạo hoặc đổi người nhận công việc con.</p>
      {saveError && <p role="alert" className="mt-3 text-xs text-red-300">{saveError}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button type="button" disabled={saving} onClick={() => setOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold">Hủy</button>
        {stale ? <button type="button" onClick={() => { setOpen(false); setReload(value => value + 1); }} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold">Tải lại phân công</button> : <button type="button" onClick={() => void save()} disabled={saving || samePhaseMemberIds(selected, roster.map(member => member.employeeId))} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">{saving ? 'Đang lưu…' : 'Lưu phân công'}</button>}
      </div>
    </ProjectActionDialog>}
  </section>;
}
