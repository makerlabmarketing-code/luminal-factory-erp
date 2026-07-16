'use client';

import Link from 'next/link';
import { notFound, useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  Archive,
  Calendar,
  CheckCircle2,
  Clock,
  Layers,
  Lock,
  MessageSquare,
  Pencil,
  User,
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

interface PhaseRecord {
  item: WorkflowSetting;
  description: WorkflowDescription;
  status: PhaseDisplayStatus;
  phaseName: string;
  orderIndex: number;
  tasks: WorkflowTask[];
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

function derivePhaseStatus(index: number, item: WorkflowSetting): PhaseDisplayStatus {
  const value = String(item.value || '').toUpperCase();
  if (value === 'COMPLETED' || value === 'DONE') return 'COMPLETED';
  if (value === 'BLOCKED') return 'BLOCKED';
  if (value === 'REVIEW') return 'REVIEW';
  if (value === 'CANCELLED') return 'CANCELLED';
  return index === 0 ? 'ACTIVE' : 'LOCKED';
}

function taskAssigneeText(task: WorkflowTask): string {
  return task.assignedToText || task.assignee_name || task.assignee || 'Chưa có người phụ trách';
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const projectId = Number(params.projectId);
  const [items, setItems] = useState<WorkflowSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [editingPhaseOrder, setEditingPhaseOrder] = useState('');
  const [driveLinkInput, setDriveLinkInput] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const workflowItems = await getWorkflowItems();
      setItems(workflowItems);
    } catch {
      showToast('Không thể tải dự án.', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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

  const phases = useMemo<PhaseRecord[]>(() => (
    projectItems
      .map((item, index) => {
        const description = parseDescription(item.description);
        return {
          item,
          description,
          status: derivePhaseStatus(index, item),
          phaseName: description.stage_name || item.config_name?.split(' - ')[1] || `Giai đoạn ${index + 1}`,
          orderIndex: Number(description.phase_order_index ?? index),
          tasks: description.tasks_list || [],
        };
      })
      .sort((left, right) => left.orderIndex - right.orderIndex)
  ), [projectItems]);

  const legacyTasks = legacyTaskItems.flatMap((item) => parseDescription(item.description).tasks_list || []);
  const completedPhaseCount = phases.filter((phase) => phase.status === 'COMPLETED').length;
  const progressPercent = phases.length > 0 ? Math.round((completedPhaseCount / phases.length) * 100) : 0;
  const totalTaskCount = phases.reduce((sum, phase) => sum + phase.tasks.length, 0) + legacyTasks.length;
  const completedTaskCount = phases.reduce(
    (sum, phase) => sum + phase.tasks.filter((task) => String(task.status || '').toUpperCase() === 'DONE').length,
    0
  );
  const nearestDeadline = [...phases.flatMap((phase) => phase.tasks.map((task) => task.deadline || task.estimationDate)), ...legacyTasks.map((task) => task.estimationDate || task.deadline)]
    .filter((value): value is string => Boolean(value))
    .sort()[0] || null;
  const memberCount = 0;

  useEffect(() => {
    setDriveLinkInput(firstDescription.project_drive_link || '');
  }, [firstDescription.project_drive_link]);

  if (!Number.isInteger(projectId) || projectId <= 0) {
    notFound();
  }

  if (!loading && projectItems.length === 0) {
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
        await loadData();
      } catch {
        showToast('Không thể hủy dự án.', 'Vui lòng thử lại sau.', 'error');
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-xs gap-2">
        <Clock className="h-4 w-4 animate-spin" /> Đang tải dự án...
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
              <h1 className="text-xl font-black text-slate-50">{projectName}</h1>
              <p className="mt-1 text-xs text-slate-400">Mã dự án #{projectId} · Tạo lúc {formatDateTime(firstDescription.project_created_at)}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300">
              Trạng thái: {firstDescription.project_status || 'Chưa có dữ liệu'}
            </span>
            <button type="button" onClick={handleCancelProject} className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40">
              <Archive className="h-4 w-4" /> Hủy dự án
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-bold text-slate-500">Tiến độ</p>
            <p className="mt-1 text-2xl font-black text-cyan-300">{progressPercent}%</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-bold text-slate-500">Số giai đoạn</p>
            <p className="mt-1 text-2xl font-black text-purple-300">{phases.length}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-bold text-slate-500">Giai đoạn xong</p>
            <p className="mt-1 text-2xl font-black text-emerald-300">{completedPhaseCount}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-bold text-slate-500">Công việc</p>
            <p className="mt-1 text-2xl font-black text-slate-100">{completedTaskCount}/{totalTaskCount}</p>
          </div>
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
            <p className="text-[10px] font-bold text-slate-500">Thành viên</p>
            <p className="mt-1 text-2xl font-black text-slate-100">{memberCount}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <section className="rounded-lg border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-black text-slate-100">Timeline giai đoạn</h2>
                <p className="text-[11px] text-slate-500">Phase sau đang khóa ở tầng UI cho đến khi có status/dependency schema.</p>
              </div>
              <div className="space-y-3 p-4">
                {phases.map((phase) => {
                  const isLocked = phase.status === 'LOCKED';
                  const isEditing = editingPhaseId === phase.item.phase_id;
                  return (
                    <div key={phase.item.key} className={`rounded-lg border p-4 ${isLocked ? 'border-slate-800 bg-slate-950 text-slate-500' : 'border-cyan-800 bg-cyan-950/10'}`}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isLocked ? <Lock className="h-4 w-4" /> : <Layers className="h-4 w-4 text-cyan-300" />}
                            <h3 className="text-sm font-black text-slate-100">{phase.phaseName}</h3>
                            <span className="rounded border border-slate-700 px-2 py-0.5 text-[10px]">{phaseStatusLabel(phase.status)}</span>
                          </div>
                          <p className="text-[11px] text-slate-500">Thứ tự {phase.orderIndex} · Tạo lúc {formatDateTime(phase.description.phase_created_at)}</p>
                        </div>
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => handleStartEditPhase(phase)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Pencil className="h-3.5 w-3.5" /> Sửa phase
                        </button>
                      </div>

                      {isEditing && (
                        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_auto]">
                          <input value={editingPhaseName} onChange={(event) => setEditingPhaseName(event.target.value)} className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" />
                          <input type="number" min={0} value={editingPhaseOrder} onChange={(event) => setEditingPhaseOrder(event.target.value)} className="rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" />
                          <div className="flex gap-2">
                            <button onClick={() => handleSavePhase(phase)} className="rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Lưu</button>
                            <button onClick={() => setEditingPhaseId(null)} className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button>
                          </div>
                        </div>
                      )}

                      <div className="mt-3 grid grid-cols-1 gap-2 text-[11px] text-slate-400 sm:grid-cols-4">
                        <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" /> Deadline: Chưa hỗ trợ</span>
                        <span className="inline-flex items-center gap-1"><User className="h-3 w-3" /> Người phụ trách: Chưa hỗ trợ</span>
                        <span>Task: {phase.tasks.length}</span>
                        <span>Comment gần nhất: Chưa có</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="rounded-lg border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-4 py-3">
                <h2 className="text-sm font-black text-slate-100">Công việc legacy</h2>
                <p className="text-[11px] text-slate-500">Hiển thị từ `tasks.assigned_to`, `packer_assigned`, `current_phase`, `estimation_date`, `issue_note`.</p>
              </div>
              <div className="divide-y divide-slate-800">
                {legacyTasks.map((task) => (
                  <div key={task.id} className="grid grid-cols-1 gap-2 p-4 text-xs md:grid-cols-[1fr_180px_160px]">
                    <div>
                      <p className="font-bold text-slate-100">{task.name || task.projectName}</p>
                      <p className="mt-1 inline-flex items-center gap-1 text-slate-500"><MessageSquare className="h-3 w-3" /> {task.issueNote || task.note || 'Chưa có ghi chú'}</p>
                    </div>
                    <div className="text-slate-300">
                      <p>Phụ trách: {taskAssigneeText(task)}</p>
                      <p>Đóng gói: {task.packerAssignedText || 'Chưa có'}</p>
                    </div>
                    <div className="text-slate-400">
                      <p>Phase: {task.currentPhaseText || task.status || 'Chưa có'}</p>
                      <p>Deadline: {formatDate(task.estimationDate || task.deadline)}</p>
                    </div>
                  </div>
                ))}
                {legacyTasks.length === 0 && (
                  <div className="p-6 text-center text-xs text-slate-500">Chưa có công việc legacy cho dự án này.</div>
                )}
              </div>
            </section>
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
