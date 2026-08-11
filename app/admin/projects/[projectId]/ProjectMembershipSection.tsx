'use client';

import { AlertTriangle, History, RefreshCw, UserPlus, Users } from 'lucide-react';
import { OperationalState } from '@/component/OperationalState';
import type { ProjectMemberDTO, ProjectMembershipSummaryDTO } from '@/lib/types/project-membership';

interface ProjectMembershipSectionProps {
  members: ProjectMemberDTO[];
  summary: ProjectMembershipSummaryDTO | null;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  loadFailed: boolean;
  canManageMembers: boolean;
  memberActionLoading: boolean;
  onRetry: () => void;
  onAddMember: () => void;
  onChangeRole: (member: ProjectMemberDTO) => void;
  onRevokeMember: (member: ProjectMemberDTO) => void;
}

function formatDate(value?: string | null): string {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa có dữ liệu';
  return date.toLocaleDateString('vi-VN');
}

function RoleMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-lg font-black text-slate-100">{value}</dd>
    </div>
  );
}

function MembershipSkeleton() {
  return (
    <div className="space-y-4 p-4" aria-label="Đang tải thành viên dự án" role="status">
      <span className="sr-only">Đang tải thành viên dự án.</span>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((item) => <div key={item} className="h-[62px] animate-pulse rounded-lg bg-slate-800" />)}
      </div>
      <div className="h-28 animate-pulse rounded-lg bg-slate-800" />
    </div>
  );
}

function MemberActions({
  member,
  canManageMembers,
  memberActionLoading,
  onChangeRole,
  onRevokeMember,
}: Pick<ProjectMembershipSectionProps, 'canManageMembers' | 'memberActionLoading' | 'onChangeRole' | 'onRevokeMember'> & { member: ProjectMemberDTO }) {
  const disabled = !canManageMembers || memberActionLoading;
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <button type="button" disabled={disabled} onClick={() => onChangeRole(member)} className="min-h-11 rounded border border-slate-700 px-3 py-2 font-bold text-slate-300 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-40">
        Đổi vai trò
      </button>
      <button type="button" disabled={disabled} onClick={() => onRevokeMember(member)} className="min-h-11 rounded border border-amber-800 px-3 py-2 font-bold text-amber-200 hover:border-amber-600 disabled:cursor-not-allowed disabled:opacity-40">
        Thu hồi
      </button>
    </div>
  );
}

export function ProjectMembershipSection({
  members,
  summary,
  isInitialLoading,
  isRefreshing,
  loadFailed,
  canManageMembers,
  memberActionLoading,
  onRetry,
  onAddMember,
  onChangeRole,
  onRevokeMember,
}: ProjectMembershipSectionProps) {
  const activeMembers = members.filter((member) => member.status === 'ACTIVE');
  const revokedMembers = members.filter((member) => member.status === 'REVOKED');

  return (
    <section className="rounded-lg border border-slate-800 bg-slate-900" aria-labelledby="project-membership-title">
      <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Users className="h-4 w-4 text-cyan-300" aria-hidden="true" />
            <h2 id="project-membership-title" className="text-sm font-black text-slate-100">Thành viên dự án</h2>
            {summary?.projectCode && <span className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-400">{summary.projectCode}</span>}
            {isRefreshing && <RefreshCw className="h-3.5 w-3.5 animate-spin text-cyan-300" aria-label="Đang cập nhật thành viên" />}
          </div>
          <p className="mt-1 text-[11px] text-slate-500">{summary?.activeMemberCount ?? activeMembers.length} thành viên đang hoạt động · Lịch sử thu hồi được giữ lại.</p>
        </div>
        <button type="button" disabled={!canManageMembers || memberActionLoading || isInitialLoading} onClick={onAddMember} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
          <UserPlus className="h-4 w-4" aria-hidden="true" /> Thêm thành viên
        </button>
      </div>

      {isInitialLoading ? <MembershipSkeleton /> : (
        <div className="space-y-4 p-4">
          {loadFailed && (
            <div className="flex flex-col gap-3 rounded-lg border border-amber-900 bg-amber-950/25 p-3 text-xs text-amber-100 sm:flex-row sm:items-center sm:justify-between" role="alert">
              <span>{members.length > 0 ? 'Không thể cập nhật thành viên. Dữ liệu đã tải trước đó vẫn được giữ lại.' : 'Không thể tải thành viên dự án.'}</span>
              <button type="button" onClick={onRetry} disabled={isRefreshing} className="min-h-11 rounded border border-amber-700 px-3 py-2 font-bold disabled:cursor-not-allowed disabled:opacity-50">Thử lại</button>
            </div>
          )}

          {summary && (
            <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <RoleMetric label="Chủ dự án" value={summary.ownerCount} />
              <RoleMetric label="Quản lý" value={summary.managerCount} />
              <RoleMetric label="Trưởng nhóm sáng tạo" value={summary.creativeLeadCount} />
              <RoleMetric label="Thành viên" value={summary.contributorCount} />
            </dl>
          )}

          {summary && !summary.hasActiveOwner && (
            <div className="flex gap-3 rounded-lg border border-amber-900 bg-amber-950/25 p-3 text-xs text-amber-100" role="status">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <div><p className="font-bold">Dự án chưa có Chủ dự án đang hoạt động.</p><p className="mt-1 text-amber-200/80">Hãy phân vai Chủ dự án để trách nhiệm quản lý và quyền dự án được thể hiện rõ ràng.</p></div>
            </div>
          )}

          {!loadFailed && activeMembers.length === 0 ? (
            <OperationalState title="Chưa có thành viên đang hoạt động." description="Thêm thành viên trước khi giao việc trong dự án." />
          ) : activeMembers.length > 0 ? (
            <>
              <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[760px] text-left text-xs">
                <thead className="text-slate-500"><tr className="border-b border-slate-800"><th className="py-2 pr-3">Nhân viên</th><th className="py-2 pr-3">Chức vụ</th><th className="py-2 pr-3">Vai trò</th><th className="py-2 pr-3">Ngày tham gia</th><th className="py-2">Thao tác</th></tr></thead>
                <tbody className="divide-y divide-slate-800">
                  {activeMembers.map((member) => (
                    <tr key={member.membershipId}>
                      <td className="py-3 pr-3 font-bold text-slate-100">{member.fullName}</td>
                      <td className="py-3 pr-3 text-slate-300">{member.title || 'Chưa có'}</td>
                      <td className="py-3 pr-3 text-slate-300">{member.roleLabel}</td>
                      <td className="py-3 pr-3 text-slate-300">{formatDate(member.joinedAt)}</td>
                      <td className="py-3"><MemberActions member={member} canManageMembers={canManageMembers} memberActionLoading={memberActionLoading} onChangeRole={onChangeRole} onRevokeMember={onRevokeMember} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div className="space-y-3 md:hidden">
                {activeMembers.map((member) => (
                  <article key={member.membershipId} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                    <div className="flex items-start justify-between gap-3"><h3 className="font-bold text-slate-100">{member.fullName}</h3><span className="shrink-0 rounded border border-emerald-800 px-2 py-0.5 text-[10px] text-emerald-200">Đang hoạt động</span></div>
                    <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2"><div><dt className="text-slate-500">Chức vụ</dt><dd className="mt-1 text-slate-200">{member.title || 'Chưa có'}</dd></div><div><dt className="text-slate-500">Vai trò</dt><dd className="mt-1 text-slate-200">{member.roleLabel}</dd></div><div><dt className="text-slate-500">Ngày tham gia</dt><dd className="mt-1 text-slate-200">{formatDate(member.joinedAt)}</dd></div><div><dt className="text-slate-500">Khả dụng giao việc</dt><dd className="mt-1 text-slate-200">{member.isAssignable ? 'Có thể giao việc' : 'Không khả dụng'}</dd></div></dl>
                    <div className="mt-3"><MemberActions member={member} canManageMembers={canManageMembers} memberActionLoading={memberActionLoading} onChangeRole={onChangeRole} onRevokeMember={onRevokeMember} /></div>
                  </article>
                ))}
              </div>
            </>
          ) : null}

          {revokedMembers.length > 0 && (
            <details className="rounded-lg border border-slate-800 bg-slate-950">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs font-bold text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
                <History className="h-4 w-4 text-slate-500" aria-hidden="true" /> Lịch sử thu hồi ({revokedMembers.length})
              </summary>
              <ul className="divide-y divide-slate-800 border-t border-slate-800">
                {revokedMembers.map((member) => <li key={member.membershipId} className="flex flex-col gap-1 px-3 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold text-slate-300">{member.fullName}</p><p className="text-slate-500">{member.roleLabel} · Tham gia {formatDate(member.joinedAt)}</p></div><span className="text-slate-500">Thu hồi {formatDate(member.revokedAt)}</span></li>)}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
