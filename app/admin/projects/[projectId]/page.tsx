'use client';

import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  CheckCircle2,
  Clock,
  Eye,
  Layers,
  Lock,
  MessageSquare,
  Pencil,
} from 'lucide-react';
import { useNotification } from '@/component/NotificationContext';
import type { WorkflowDescription, WorkflowSetting, WorkflowTask } from '@/lib/types/workflow';
import {
  cancelWorkflowProject,
  getWorkflowItems,
  updateWorkflowPhase,
  updateWorkflowProjectDriveLink,
} from '@/services/workflowService';

type PhaseDisplayStatus = 'ACTIVE' | 'LOCKED' | 'COMPLETED' | 'BLOCKED' | 'REVIEW' | 'CANCELLED';
type PhaseTaskGroupKey = number | 'unassigned';

interface PhaseRecord {
  item: WorkflowSetting;
  description: WorkflowDescription;
  status: PhaseDisplayStatus;
  phaseName: string;
  orderIndex: number;
  tasks: WorkflowTask[];
  taskCount: number;
  completedTaskCount: number;
  isLocked: boolean;
  isCompleted: boolean;
}

interface ProjectDetailDTO {
  id: number;
  name: string;
  status: string | null;
  progressPercent: number;
  currentPhaseId: number | null;
  phases: PhaseRecord[];
  unassignedTasks: WorkflowTask[];
}

function parseDescription(raw?: string | null): WorkflowDescription {
  try {
    return JSON.parse(raw || '{}') as WorkflowDescription;
  } catch {
    return {};
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function formatDate(value?: string | null): string {
  if (!value) return 'Chưa có hạn';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString('vi-VN');
}

function phaseStatusLabel(status: PhaseDisplayStatus): string {
  const labels: Record<PhaseDisplayStatus, string> = {
    ACTIVE: 'Đang thực hiện',
    LOCKED: 'Đang khóa',
    COMPLETED: 'Hoàn thành',
    BLOCKED: 'Bị vướng',
    REVIEW: 'Chờ duyệt',
    CANCELLED: 'Đã hủy',
  };

  return labels[status];
}

function taskStatusLabel(status?: string | null): string {
  const normalized = String(status || '').toUpperCase();
  if (normalized === 'DONE' || normalized === 'COMPLETED') return 'Hoàn thành';
  if (normalized === 'BLOCKED') return 'Bị vướng';
  if (normalized === 'REVIEW' || normalized === 'PENDINGREVIEW') return 'Chờ duyệt';
  if (normalized === 'CANCELLED') return 'Đã hủy';
  if (normalized === 'DOING' || normalized === 'IN_PROGRESS' || normalized === 'INPROGRESS') return 'Đang làm';
  if (normalized === 'TODO' || normalized === 'BACKLOG' || normalized === 'READY') return 'Chưa làm';
  return status || 'Chưa có';
}

function persistedPhaseStatus(item: WorkflowSetting): PhaseDisplayStatus | null {
  const value = String(item.value || '').toUpperCase();
  if (value === 'COMPLETED' || value === 'DONE') return 'COMPLETED';
  if (value === 'BLOCKED') return 'BLOCKED';
  if (value === 'REVIEW') return 'REVIEW';
  if (value === 'CANCELLED') return 'CANCELLED';
  return null;
}

function deriveSequentialPhaseStatuses(
  phases: Array<Omit<PhaseRecord, 'status' | 'taskCount' | 'completedTaskCount' | 'isLocked' | 'isCompleted'>>
): PhaseDisplayStatus[] {
  let canOpenNext = true;
  let activeAssigned = false;

  return phases.map((phase) => {
    const persistedStatus = persistedPhaseStatus(phase.item);
    if (persistedStatus === 'COMPLETED') return 'COMPLETED';

    if (!canOpenNext || activeAssigned) {
      canOpenNext = false;
      return 'LOCKED';
    }

    activeAssigned = true;
    canOpenNext = false;
    return persistedStatus || 'ACTIVE';
  });
}

function normalizePhaseKey(value?: string | null): string {
  return String(value || '')
    .trim()
    .toLocaleLowerCase('vi-VN')
    .replace(/\s+/g, ' ');
}

function mapLegacyTasksToPhaseGroups(
  phases: Array<Pick<PhaseRecord, 'item' | 'phaseName'>>,
  tasks: WorkflowTask[]
): Map<PhaseTaskGroupKey, WorkflowTask[]> {
  const groups = new Map<PhaseTaskGroupKey, WorkflowTask[]>();
  const phaseByName = new Map<string, number>();

  phases.forEach((phase) => {
    if (!phase.item.phase_id) return;
    const key = normalizePhaseKey(phase.phaseName);
    if (key && !phaseByName.has(key)) {
      phaseByName.set(key, phase.item.phase_id);
    }
  });

  tasks.forEach((task) => {
    const phaseId = phaseByName.get(normalizePhaseKey(task.currentPhaseText || task.status));
    const groupKey: PhaseTaskGroupKey = phaseId || 'unassigned';
    groups.set(groupKey, [...(groups.get(groupKey) || []), task]);
  });

  return groups;
}

function getTaskAssigneeLabel(task: WorkflowTask): string {
  return task.assignedEmployee?.fullName || task.assignedToText || 'Chưa gán';
}

function getTaskPackerLabel(task: WorkflowTask): string | null {
  return task.packerEmployee?.fullName || task.packerAssignedText || null;
}

function isTaskCompleted(task: WorkflowTask): boolean {
  const status = String(task.status || task.currentPhaseText || '').toUpperCase();
  return status === 'DONE' || status === 'COMPLETED';
}

function isPhaseReadonly(phase: PhaseRecord, canManageProject = false): boolean {
  if (phase.status === 'LOCKED' || phase.status === 'CANCELLED') return true;
  if (phase.status === 'COMPLETED' && !canManageProject) return true;
  return false;
}

function canShowManualUnlockAction(canManageProject: boolean, phase: PhaseRecord): boolean {
  return canManageProject && phase.status === 'LOCKED';
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const projectId = Number(params.projectId);
  const [items, setItems] = useState<WorkflowSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [editingPhaseOrder, setEditingPhaseOrder] = useState('');
  const [driveLinkInput, setDriveLinkInput] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const canManageProject = true;

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const workflowItems = await getWorkflowItems();
      setItems(workflowItems);
    } catch {
      setLoadFailed(true);
      showToast('Không thể tải dự án.', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const projectItems = useMemo(
    () => items.filter((item) => item.project_id === projectId),
    [items, projectId]
  );
  const firstDescription = parseDescription(projectItems[0]?.description);
  const projectName = projectItems[0]?.config_name?.split(' - ')[0] || '';
  const legacyTaskItems = useMemo(
    () => items.filter((item) => item.group_name === 'PRODUCTION_WORKFLOW_LEGACY' && item.config_name?.split(' - ')[0] === projectName),
    [items, projectName]
  );
  const legacyTasks = useMemo(
    () => legacyTaskItems.flatMap((item) => parseDescription(item.description).tasks_list || []),
    [legacyTaskItems]
  );

  const phases = useMemo<PhaseRecord[]>(() => {
    const phaseDrafts = projectItems
      .map((item, index) => {
        const description = parseDescription(item.description);
        return {
          item,
          description,
          phaseName: description.stage_name || item.config_name?.split(' - ')[1] || `Giai đoạn ${index + 1}`,
          orderIndex: Number(description.phase_order_index ?? index),
          tasks: description.tasks_list || [],
        };
      })
      .sort((left, right) => left.orderIndex - right.orderIndex);
    const legacyTaskGroups = mapLegacyTasksToPhaseGroups(phaseDrafts, legacyTasks);
    const statuses = deriveSequentialPhaseStatuses(phaseDrafts);

    return phaseDrafts.map((phase, index) => {
      const mappedTasks = phase.item.phase_id ? legacyTaskGroups.get(phase.item.phase_id) || [] : [];
      const tasks = [...phase.tasks, ...mappedTasks];
      const completedTaskCount = tasks.filter(isTaskCompleted).length;
      const status = statuses[index] || 'LOCKED';

      return {
        ...phase,
        status,
        tasks,
        taskCount: tasks.length,
        completedTaskCount,
        isLocked: status === 'LOCKED',
        isCompleted: status === 'COMPLETED',
      };
    });
  }, [projectItems, legacyTasks]);

  const unassignedTasks = useMemo(
    () => mapLegacyTasksToPhaseGroups(phases, legacyTasks).get('unassigned') || [],
    [phases, legacyTasks]
  );
  const completedPhaseCount = phases.filter((phase) => phase.status === 'COMPLETED').length;
  const progressPercent = phases.length > 0 ? Math.round((completedPhaseCount / phases.length) * 100) : 0;
  const totalTaskCount = phases.reduce((sum, phase) => sum + phase.taskCount, 0) + unassignedTasks.length;
  const completedTaskCount = phases.reduce((sum, phase) => sum + phase.completedTaskCount, 0) + unassignedTasks.filter(isTaskCompleted).length;
  const nearestDeadline = [...phases.flatMap((phase) => phase.tasks.map((task) => task.deadline || task.estimationDate)), ...unassignedTasks.map((task) => task.estimationDate || task.deadline)]
    .filter((value): value is string => Boolean(value))
    .sort()[0] || null;
  const memberCount = 0;
  const activePhase = phases.find((phase) => phase.status === 'ACTIVE' || phase.status === 'BLOCKED' || phase.status === 'REVIEW') || phases.find((phase) => phase.status === 'COMPLETED') || phases[0] || null;
  const selectedPhase = phases.find((phase) => phase.item.phase_id === selectedPhaseId) || activePhase;
  const projectDetail: ProjectDetailDTO = {
    id: projectId,
    name: projectName,
    status: firstDescription.project_status || null,
    progressPercent,
    currentPhaseId: activePhase?.item.phase_id || null,
    phases,
    unassignedTasks,
  };

  useEffect(() => {
    setDriveLinkInput(firstDescription.project_drive_link || '');
  }, [firstDescription.project_drive_link]);

  useEffect(() => {
    if (!selectedPhaseId && activePhase?.item.phase_id) {
      setSelectedPhaseId(activePhase.item.phase_id);
    }
  }, [activePhase?.item.phase_id, selectedPhaseId]);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    notFound();
  }

  if (!loading && !loadFailed && projectItems.length === 0) {
    notFound();
  }

  const handleStartEditPhase = (phase: PhaseRecord) => {
    if (!phase.item.phase_id) return;
    setEditingPhaseId(phase.item.phase_id);
    setEditingPhaseName(phase.phaseName);
    setEditingPhaseOrder(String(phase.orderIndex));
  };

  const handleSavePhase = async (phase: PhaseRecord) => {
    if (!phase.item.project_id || !phase.item.phase_id) return;
    const orderIndex = Number(editingPhaseOrder);

    try {
      await updateWorkflowPhase({
        projectId: phase.item.project_id,
        phaseId: phase.item.phase_id,
        phaseName: editingPhaseName,
        orderIndex: Number.isInteger(orderIndex) && orderIndex >= 0 ? orderIndex : undefined,
      });
      setEditingPhaseId(null);
      showToast('Đã lưu giai đoạn.', 'Tên hoặc thứ tự giai đoạn đã được cập nhật.', 'success');
      await loadData();
    } catch {
      showToast('Không thể lưu giai đoạn.', 'Vui lòng thử lại sau.', 'error');
    }
  };

  const handleSaveDriveLink = async () => {
    try {
      await updateWorkflowProjectDriveLink({
        projectId,
        driveLink: driveLinkInput,
      });
      showToast('Đã lưu dự án.', 'Đường dẫn Google Drive đã được cập nhật.', 'success');
      await loadData();
    } catch {
      showToast('Không thể lưu dự án.', 'Vui lòng thử lại sau.', 'error');
    }
  };

  const handleCancelProject = () => {
    showConfirm('Hủy dự án', 'Dự án sẽ được đánh dấu hủy và giữ lại lịch sử.', async () => {
      try {
        await cancelWorkflowProject(projectId);
        showToast('Đã hủy dự án.', 'Dự án không bị xóa khỏi dữ liệu.', 'info');
        router.refresh();
        await loadData();
      } catch {
        showToast('Không thể hủy dự án.', 'Vui lòng thử lại sau.', 'error');
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
        <div className="mx-auto max-w-7xl space-y-5">
          <div className="h-16 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-28 animate-pulse rounded-lg bg-slate-900" />
          <div className="h-40 animate-pulse rounded-lg bg-slate-900" />
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Clock className="h-4 w-4 animate-spin" /> Đang tải dự án...
          </div>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
        <div className="mx-auto flex min-h-[50vh] max-w-3xl flex-col items-center justify-center gap-3 rounded-lg border border-slate-800 bg-slate-900 text-center">
          <AlertTriangle className="h-6 w-6 text-amber-300" />
          <h1 className="text-base font-black">Không thể tải chi tiết dự án.</h1>
          <button type="button" onClick={loadData} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500">
            Thử lại
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Link href="/admin/tasks" className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Quay lại danh sách
            </Link>
            <div>
              <h1 className="text-xl font-black text-slate-50">{projectDetail.name}</h1>
              <p className="mt-1 text-xs text-slate-400">Mã dự án #{projectDetail.id} · Tạo lúc {formatDateTime(firstDescription.project_created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
              Trạng thái: {projectDetail.status || 'Chưa có dữ liệu'}
            </span>
            <button type="button" onClick={handleCancelProject} className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40">
              <Archive className="h-4 w-4" /> Hủy dự án
            </button>
          </div>
        </div>

        <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500">Tiến độ dự án</p>
              <p className="mt-1 text-2xl font-black text-cyan-300">{projectDetail.progressPercent}%</p>
              <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800 lg:w-96">
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${projectDetail.progressPercent}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-slate-500">Giai đoạn</p>
                <p className="font-bold text-slate-100">{completedPhaseCount}/{projectDetail.phases.length}</p>
              </div>
              <div>
                <p className="text-slate-500">Trạng thái</p>
                <p className="font-bold text-slate-100">{projectDetail.status || 'Đang theo dõi'}</p>
              </div>
              <div>
                <p className="text-slate-500">Deadline tổng</p>
                <p className="font-bold text-slate-100">{formatDate(firstDescription.project_deadline)}</p>
              </div>
              <div>
                <p className="text-slate-500">Hiện tại</p>
                <p className="font-bold text-slate-100">{activePhase?.phaseName || 'Chưa có'}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-black text-slate-100">Stepper giai đoạn</h2>
                <p className="text-[11px] text-slate-500">Trạng thái đang derive read-only từ thứ tự phase và trạng thái hoàn thành hiện có.</p>
              </div>
              <div className="overflow-x-auto p-4 [scroll-snap-type:x_mandatory]">
                <div className="flex min-w-max items-start">
                  {projectDetail.phases.map((phase, index) => {
                    const isSelected = selectedPhase?.item.phase_id === phase.item.phase_id;
                    const circleClass = phase.status === 'COMPLETED'
                      ? 'border-emerald-400 bg-emerald-500 text-slate-950'
                      : phase.status === 'ACTIVE'
                        ? 'border-cyan-300 bg-cyan-500 text-slate-950 ring-4 ring-cyan-400/20'
                        : phase.status === 'BLOCKED'
                          ? 'border-amber-300 bg-amber-500 text-slate-950'
                          : phase.status === 'CANCELLED'
                            ? 'border-red-500 bg-red-950 text-red-200'
                            : 'border-slate-700 bg-slate-950 text-slate-500';
                    const labelClass = phase.status === 'LOCKED'
                      ? 'text-slate-500'
                      : phase.status === 'ACTIVE'
                        ? 'text-cyan-100'
                        : 'text-slate-100';

                    return (
                      <div key={phase.item.key} className="flex items-start scroll-ml-4 [scroll-snap-align:start]">
                        <button
                          type="button"
                          onClick={() => setSelectedPhaseId(phase.item.phase_id || null)}
                          className={`group flex w-36 shrink-0 flex-col items-center gap-2 rounded-lg px-2 py-1 text-center outline-none transition hover:bg-slate-800/60 focus-visible:ring-2 focus-visible:ring-cyan-300 sm:w-44 ${isSelected ? 'bg-slate-800/70' : ''}`}
                          aria-current={isSelected ? 'step' : undefined}
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-full border-2 text-xs font-black ${circleClass}`}>
                            {phase.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5" /> : phase.status === 'LOCKED' ? <Lock className="h-4 w-4" /> : phase.status === 'BLOCKED' ? <AlertTriangle className="h-4 w-4" /> : index + 1}
                          </span>
                          <span className={`line-clamp-2 min-h-[2.25rem] text-xs font-black leading-snug ${labelClass}`}>{phase.phaseName}</span>
                          <span className={`text-[10px] ${phase.status === 'LOCKED' ? 'text-slate-600' : 'text-slate-400'}`}>{phaseStatusLabel(phase.status)}</span>
                        </button>
                        {index < projectDetail.phases.length - 1 && (
                          <div className={`mt-5 h-0.5 w-10 shrink-0 sm:w-16 ${phase.status === 'COMPLETED' ? 'bg-emerald-400' : 'bg-slate-700'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>
                {projectDetail.phases.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500">Dự án chưa có giai đoạn.</div>
                )}
              </div>
            </section>

            {selectedPhase && (
              <section className="rounded-lg border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-4 py-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Layers className="h-4 w-4 text-cyan-300" />
                        <h2 className="text-sm font-black text-slate-100">{selectedPhase.phaseName}</h2>
                        <span className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{phaseStatusLabel(selectedPhase.status)}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-500">Thứ tự {selectedPhase.orderIndex} · Tạo lúc {formatDateTime(selectedPhase.description.phase_created_at)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {isPhaseReadonly(selectedPhase, canManageProject) && (
                        <span className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-400">
                          <Eye className="h-3.5 w-3.5" /> Chỉ xem
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={selectedPhase.isLocked}
                        onClick={() => handleStartEditPhase(selectedPhase)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <Pencil className="h-3.5 w-3.5" /> Sửa
                      </button>
                      {canShowManualUnlockAction(canManageProject, selectedPhase) && (
                        <button
                          type="button"
                          disabled
                          title="Server chưa có mutation mở khóa phase."
                          className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-500"
                        >
                          <Lock className="h-3.5 w-3.5" /> Mở khóa giai đoạn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  {selectedPhase.isLocked && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                      Hoàn thành giai đoạn trước để mở khóa.
                    </div>
                  )}

                  {editingPhaseId === selectedPhase.item.phase_id && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_auto]">
                      <input value={editingPhaseName} onChange={(event) => setEditingPhaseName(event.target.value)} className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" />
                      <input type="number" min={0} value={editingPhaseOrder} onChange={(event) => setEditingPhaseOrder(event.target.value)} className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" />
                      <div className="flex gap-2">
                        <button onClick={() => handleSavePhase(selectedPhase)} className="rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Lưu</button>
                        <button onClick={() => setEditingPhaseId(null)} className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <p className="text-slate-500">Deadline</p>
                      <p className="font-bold text-slate-100">{formatDate(selectedPhase.description.stage_deadline || selectedPhase.description.project_deadline)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Người phụ trách phase</p>
                      <p className="font-bold text-slate-100">{selectedPhase.description.stage_owner || 'Chưa gán'}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Tiến độ phase</p>
                      <p className="font-bold text-slate-100">{selectedPhase.completedTaskCount}/{selectedPhase.taskCount} công việc</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Comment gần nhất</p>
                      <p className="font-bold text-slate-100">Chưa có</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                    {selectedPhase.description.next_action || selectedPhase.description.stage_type || 'Chưa có mô tả giai đoạn.'}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="hidden w-full min-w-[900px] text-left text-xs md:table">
                      <thead className="text-slate-500">
                        <tr className="border-b border-slate-800">
                          <th className="py-2 pr-3">Tên công việc</th>
                          <th className="py-2 pr-3">Người thực hiện</th>
                          <th className="py-2 pr-3">Người đóng gói</th>
                          <th className="py-2 pr-3">Deadline</th>
                          <th className="py-2 pr-3">Trạng thái</th>
                          <th className="py-2 pr-3">Ghi chú</th>
                          <th className="py-2 pr-3">Comment gần nhất</th>
                          <th className="py-2">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {selectedPhase.tasks.map((task) => (
                          <tr key={task.id || `${task.name}-${task.deadline}`} className="text-slate-300">
                            <td className="py-3 pr-3 font-bold text-slate-100">{task.name || task.projectName || 'Công việc chưa đặt tên'}</td>
                            <td className="py-3 pr-3">{getTaskAssigneeLabel(task)}</td>
                            <td className="py-3 pr-3">{getTaskPackerLabel(task) || 'Chưa gán'}</td>
                            <td className="py-3 pr-3">{formatDate(task.estimationDate || task.deadline)}</td>
                            <td className="py-3 pr-3">{taskStatusLabel(task.status || task.currentPhaseText)}</td>
                            <td className="py-3 pr-3">{task.issueNote || task.note || 'Chưa có ghi chú'}</td>
                            <td className="py-3 pr-3">Chưa có</td>
                            <td className="py-3">{isPhaseReadonly(selectedPhase, canManageProject) ? 'Chỉ xem' : 'Sửa'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="space-y-3 md:hidden">
                      {selectedPhase.tasks.map((task) => (
                        <div key={task.id || `${task.name}-${task.deadline}`} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                          <p className="font-bold text-slate-100">{task.name || task.projectName || 'Công việc chưa đặt tên'}</p>
                          <div className="mt-2 space-y-1 text-slate-400">
                            <p>Người thực hiện: {getTaskAssigneeLabel(task)}</p>
                            <p>Người đóng gói: {getTaskPackerLabel(task) || 'Chưa gán'}</p>
                            <p>Deadline: {formatDate(task.estimationDate || task.deadline)}</p>
                            <p>Trạng thái: {taskStatusLabel(task.status || task.currentPhaseText)}</p>
                            <p>Ghi chú: {task.issueNote || task.note || 'Chưa có ghi chú'}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedPhase.tasks.length === 0 && (
                      <div className="p-6 text-center text-xs text-slate-500">Giai đoạn này chưa có công việc.</div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {projectDetail.unassignedTasks.length > 0 && (
              <section className="rounded-lg border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-4 py-3">
                  <h2 className="text-sm font-black text-slate-100">Công việc chưa phân giai đoạn</h2>
                  <p className="text-[11px] text-slate-500">Task legacy không có `current_phase` khớp an toàn với tên phase hiện tại.</p>
                </div>
                <div className="divide-y divide-slate-800">
                  {projectDetail.unassignedTasks.map((task) => (
                    <div key={task.id} className="grid grid-cols-1 gap-2 p-4 text-xs md:grid-cols-[1fr_180px_160px]">
                      <div>
                        <p className="font-bold text-slate-100">{task.name || task.projectName || 'Công việc chưa đặt tên'}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-slate-500"><MessageSquare className="h-3 w-3" /> {task.issueNote || task.note || 'Chưa có ghi chú'}</p>
                      </div>
                      <div className="text-slate-300">
                        <p>Người thực hiện: {getTaskAssigneeLabel(task)}</p>
                        <p>Người đóng gói: {getTaskPackerLabel(task) || 'Chưa gán'}</p>
                      </div>
                      <div className="text-slate-400">
                        <p>Phase: {task.currentPhaseText || 'Chưa có'}</p>
                        <p>Deadline: {formatDate(task.estimationDate || task.deadline)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-black text-slate-100">Thông tin dự án</h2>
              <div className="mt-3 space-y-3 text-xs">
                <div>
                  <p className="text-slate-500">Deadline tổng</p>
                  <p className="text-slate-100">{formatDate(firstDescription.project_deadline)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Deadline gần nhất</p>
                  <p className="text-slate-100">{formatDate(nearestDeadline)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Công việc</p>
                  <p className="text-slate-100">{completedTaskCount}/{totalTaskCount}</p>
                </div>
                <div>
                  <p className="text-slate-500">Thành viên</p>
                  <p className="text-slate-100">{memberCount}</p>
                </div>
                <div className="space-y-2">
                  <p className="text-slate-500">Google Drive</p>
                  <input value={driveLinkInput} onChange={(event) => setDriveLinkInput(event.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" placeholder="Nhập link Drive" />
                  <button onClick={handleSaveDriveLink} className="w-full rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white">Lưu thông tin</button>
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-amber-900 bg-amber-950/20 p-4 text-xs text-amber-100">
              <div className="flex gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p>Sequential workflow hiện là thiết kế read-only. Cần migration status/dependency trước khi cho mutate phase bị khóa.</p>
              </div>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
