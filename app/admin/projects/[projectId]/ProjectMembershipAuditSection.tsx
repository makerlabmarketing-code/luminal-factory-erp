'use client';

import { useCallback, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, History, RefreshCw } from 'lucide-react';
import type {
  ProjectMembershipAuditDTO,
  ProjectMembershipAuditOperation,
  ProjectMembershipAuditResponseDTO,
  ProjectMembershipIntegrityDTO,
} from '@/lib/types/project-membership';

interface ProjectMembershipAuditSectionProps {
  projectId: number;
  enabled: boolean;
  canView: boolean;
}

const OPERATION_LABELS: Record<ProjectMembershipAuditOperation, string> = {
  ADD: 'Thêm thành viên',
  CHANGE_ROLE: 'Đổi vai trò',
  REVOKE: 'Thu hồi thành viên',
};

function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Chưa có dữ liệu'
    : date.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

function IntegritySummary({ integrity }: { integrity: ProjectMembershipIntegrityDTO }) {
  return (
    <div className={`rounded-lg border p-3 text-xs ${integrity.healthy ? 'border-emerald-900 bg-emerald-950/20 text-emerald-100' : 'border-amber-900 bg-amber-950/25 text-amber-100'}`} role="status">
      <div className="flex items-start gap-2">
        {integrity.healthy ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
        <div>
          <p className="font-bold">{integrity.healthy ? 'Dữ liệu thành viên đang nhất quán.' : 'Dữ liệu thành viên cần kiểm tra.'}</p>
          <p className="mt-1 opacity-80">{integrity.activeMemberCount} thành viên hoạt động · {integrity.activeOwnerCount} Chủ dự án · {integrity.duplicateActiveEmployeeCount} vai trò trùng · {integrity.activeTaskWithoutMembershipCount} công việc thiếu thành viên hợp lệ</p>
        </div>
      </div>
    </div>
  );
}

export function ProjectMembershipAuditSection({ projectId, enabled, canView }: ProjectMembershipAuditSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [events, setEvents] = useState<ProjectMembershipAuditDTO[]>([]);
  const [integrity, setIntegrity] = useState<ProjectMembershipIntegrityDTO | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const loadLockRef = useRef(false);

  const loadAudit = useCallback(async (cursor?: string | null) => {
    if (loadLockRef.current || !enabled || !canView) return;
    loadLockRef.current = true;
    setLoading(true);
    setLoadFailed(false);
    try {
      const query = new URLSearchParams({ limit: '20' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(`/api/admin/projects/${projectId}/members/audit?${query.toString()}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as (ProjectMembershipAuditResponseDTO & { message?: string }) | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message || 'Không thể tải lịch sử thành viên.');
      setEvents((current) => cursor ? [...current, ...payload.events] : payload.events);
      setIntegrity(payload.integrity);
      setNextCursor(payload.nextCursor);
      setLoaded(true);
    } catch {
      setLoadFailed(true);
    } finally {
      loadLockRef.current = false;
      setLoading(false);
    }
  }, [canView, enabled, projectId]);

  if (!canView || !enabled) return null;

  const toggleExpanded = () => {
    const nextExpanded = !expanded;
    setExpanded(nextExpanded);
    if (nextExpanded && !loaded) void loadAudit();
  };

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-950" aria-labelledby="membership-audit-title">
      <button type="button" onClick={toggleExpanded} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs font-bold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
        <span className="flex items-center gap-2"><History className="h-4 w-4 text-slate-500" aria-hidden="true" /><span id="membership-audit-title">Kiểm toán thay đổi thành viên</span></span>
        {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
      </button>

      {expanded && (
        <div className="space-y-3 border-t border-slate-800 p-3">
          {integrity && <IntegritySummary integrity={integrity} />}
          {loading && events.length === 0 && <div className="flex min-h-20 items-center justify-center gap-2 text-xs text-slate-500" role="status"><RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />Đang tải lịch sử...</div>}
          {loadFailed && <div className="flex flex-col gap-2 rounded-lg border border-amber-900 bg-amber-950/25 p-3 text-xs text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{events.length > 0 ? 'Không thể tải thêm lịch sử. Dữ liệu hiện tại vẫn được giữ lại.' : 'Không thể tải lịch sử thành viên.'}</span><button type="button" disabled={loading} onClick={() => void loadAudit(events.length > 0 ? nextCursor : null)} className="min-h-11 rounded border border-amber-700 px-3 py-2 font-bold disabled:opacity-50">Thử lại</button></div>}
          {!loading && !loadFailed && loaded && events.length === 0 && <p className="rounded-lg border border-slate-800 p-4 text-center text-xs text-slate-500">Chưa có thay đổi thành viên nào được ghi nhận.</p>}
          {events.length > 0 && <ol className="space-y-3">{events.map((event) => <li key={event.auditId} className="rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="font-bold text-slate-100">{OPERATION_LABELS[event.operation]} · {event.employeeName}</p><time className="text-slate-500" dateTime={event.occurredAt}>{formatDateTime(event.occurredAt)}</time></div><p className="mt-2 text-slate-300">{event.beforeRoleLabel || 'Chưa có vai trò'} → {event.afterRoleLabel || 'Không còn hoạt động'}</p><p className="mt-2 text-slate-400">Lý do: {event.reason}</p><p className="mt-2 text-slate-500">Người thao tác: {event.actorName}</p><code className="mt-2 block break-all text-[10px] text-slate-600">Mã đối chiếu: {event.correlationId}</code></li>)}</ol>}
          {nextCursor && <button type="button" disabled={loading} onClick={() => void loadAudit(nextCursor)} className="min-h-11 w-full rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50">{loading ? 'Đang tải...' : 'Tải thêm lịch sử'}</button>}
        </div>
      )}
    </section>
  );
}
