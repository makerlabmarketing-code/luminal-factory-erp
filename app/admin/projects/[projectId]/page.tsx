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
  Save,
  UserPlus,
  Users,
} from 'lucide-react';
import { useNotification } from '@/component/NotificationContext';
import { OperationalState } from '@/component/OperationalState';
import type { TaskAssignmentDTO, TaskAssignmentStatus } from '@/lib/types/task-assignment';
import {
  allowedNextTaskStatuses,
  calculatePhaseProgress,
  calculateProjectProgress,
  canTransitionTaskStatus,
  describeTaskEditIntent,
  hasTaskEditChanges,
  phaseGateState,
  taskProgressPercent,
} from '@/lib/workflow-project-phase';
import type { WorkflowDescription, WorkflowSetting, WorkflowTask } from '@/lib/types/workflow';
import {
  cancelWorkflowProject,
  getWorkflowItems,
  updateWorkflowPhase,
  updateWorkflowProjectDriveLink,
} from '@/services/workflowService';

type PhaseDisplayStatus = 'ACTIVE' | 'LOCKED' | 'COMPLETED' | 'BLOCKED' | 'REVIEW' | 'CANCELLED';
type PhaseTaskGroupKey = number | 'unassigned';
type DisplayTask = WorkflowTask | TaskAssignmentDTO;

interface PhaseRecord {
  item: WorkflowSetting;
  description: WorkflowDescription;
  status: PhaseDisplayStatus;
  phaseName: string;
  orderIndex: number;
  tasks: DisplayTask[];
  taskCount: number;
  completedTaskCount: number;
  progressPercent: number;
  lastActivityAt: string | null;
  gateMessage: string | null;
  canCompletePhase: boolean;
  isLocked: boolean;
  isCompleted: boolean;
}

interface ProjectMemberDTO {
  membershipId: number;
  employeeId: number;
  fullName: string;
  title: string | null;
  roleCode: 'PROJECT_OWNER' | 'PROJECT_MANAGER' | 'CREATIVE_LEAD' | 'CONTRIBUTOR';
  roleLabel: string;
  status: 'ACTIVE' | 'REVOKED';
  joinedAt: string | null;
  revokedAt: string | null;
  isAssignable: boolean;
}

interface ProjectCapabilitiesDTO {
  canViewProject: boolean;
  canEditProject: boolean;
  canManageMembers: boolean;
  canManagePhases: boolean;
  canManageTasks: boolean;
  canCancelProject: boolean;
}

interface ProjectDetailDTO {
  id: number;
  name: string;
  status: string | null;
  projectDeadline: string | null;
  progressPercent: number;
  currentPhaseId: number | null;
  capabilities: ProjectCapabilitiesDTO;
  members: ProjectMemberDTO[];
  phases: PhaseRecord[];
  unassignedTasks: DisplayTask[];
}

interface TaskEditState {
  taskId: number;
  assigneeEmployeeId: string;
  deadline: string;
  status: TaskAssignmentStatus;
  comment: string;
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
  if (!value) return 'Chưa đặt deadline';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt deadline';

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

const TASK_STATUS_OPTIONS: Array<{ value: TaskAssignmentStatus; label: string }> = [
  { value: 'BACKLOG', label: 'Chưa xếp lịch' },
  { value: 'READY', label: 'Sẵn sàng' },
  { value: 'IN_PROGRESS', label: 'Đang làm' },
  { value: 'PENDING_REVIEW', label: 'Chờ duyệt' },
  { value: 'REVISION_REQUIRED', label: 'Cần sửa' },
  { value: 'APPROVED', label: 'Đã duyệt' },
  { value: 'BLOCKED', label: 'Bị vướng' },
  { value: 'ON_HOLD', label: 'Tạm dừng' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'CANCELLED', label: 'Đã hủy' },
];

function persistedPhaseStatus(item: WorkflowSetting): PhaseDisplayStatus | null {
  const value = String(item.value || '').toUpperCase();
  if (value === 'COMPLETED' || value === 'DONE') return 'COMPLETED';
  if (value === 'BLOCKED') return 'BLOCKED';
  if (value === 'REVIEW') return 'REVIEW';
  if (value === 'CANCELLED') return 'CANCELLED';
  return null;
}

function deriveSequentialPhaseStatuses(
  phases: Array<Omit<PhaseRecord, 'status' | 'taskCount' | 'completedTaskCount' | 'progressPercent' | 'lastActivityAt' | 'gateMessage' | 'canCompletePhase' | 'isLocked' | 'isCompleted'>>
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

function isTaskAssignmentDTO(task: DisplayTask): task is TaskAssignmentDTO {
  return 'taskId' in task;
}

function getTaskKey(task: DisplayTask): string {
  return isTaskAssignmentDTO(task) ? `task-${task.taskId}` : `legacy-${task.id || `${task.name}-${task.deadline}`}`;
}

function getTaskTitle(task: DisplayTask): string {
  return isTaskAssignmentDTO(task) ? task.title : task.name || task.projectName || 'Công việc chưa đặt tên';
}

function getTaskAssigneeLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return task.assigneeFullName || 'Chưa phân công';
  return task.assignedEmployee?.fullName || task.assignedToText || 'Chưa phân công';
}

function getTaskPackerLabel(task: DisplayTask): string | null {
  if (isTaskAssignmentDTO(task)) return null;
  return task.packerEmployee?.fullName || task.packerAssignedText || null;
}

function getTaskDeadlineLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return formatDate(task.deadline);
  return formatDate(task.estimationDate || task.deadline);
}

function getTaskDeadlineValue(task: DisplayTask): string | null | undefined {
  return isTaskAssignmentDTO(task) ? task.deadline : task.estimationDate || task.deadline;
}

function getTaskStatusValue(task: DisplayTask): string | null | undefined {
  return isTaskAssignmentDTO(task) ? task.status : task.status || task.currentPhaseText;
}

function getTaskProgressLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return `${taskProgressPercent(task.status)}%`;
  return isTaskCompleted(task) ? '100%' : '0%';
}

function getTaskCommentLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return `${task.commentCount} bình luận`;
  return task.issueNote || task.note || 'Chưa có ghi chú';
}

function isTaskCompleted(task: DisplayTask): boolean {
  if (isTaskAssignmentDTO(task)) return task.status === 'COMPLETED';
  const status = String(task.status || task.currentPhaseText || '').toUpperCase();
  return status === 'DONE' || status === 'COMPLETED';
}

function isPhaseReadonly(phase: PhaseRecord, canManageProject = false): boolean {
  if (!canManageProject) return true;
  if (phase.status === 'LOCKED' || phase.status === 'CANCELLED') return true;
  if (phase.status === 'COMPLETED' && !canManageProject) return true;
  return false;
}

function canShowManualUnlockAction(canManageProject: boolean, phase: PhaseRecord): boolean {
  return canManageProject && phase.status === 'LOCKED';
}

function ProjectDetailField({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/70 p-3">
      <dt className="text-[11px] font-bold text-slate-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-bold text-slate-100">{value}</dd>
    </div>
  );
}

function TaskMobileField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold text-slate-500">{label}</dt>
      <dd className="mt-0.5 break-words text-xs text-slate-300">{value}</dd>
    </div>
  );
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const router = useRouter();
  const { showToast, showConfirm } = useNotification();
  const projectId = Number(params.projectId);
  const [items, setItems] = useState<WorkflowSetting[]>([]);
  const [projectTasks, setProjectTasks] = useState<TaskAssignmentDTO[]>([]);
  const [taskLoadBlocked, setTaskLoadBlocked] = useState(false);
  const [taskActionLoading, setTaskActionLoading] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<TaskEditState | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [editingPhaseOrder, setEditingPhaseOrder] = useState('');
  const [driveLinkInput, setDriveLinkInput] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [members, setMembers] = useState<ProjectMemberDTO[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [candidateEmployees, setCandidateEmployees] = useState<Array<{ employeeId: number; fullName: string; title: string | null }>>([]);
  const [candidateEmployeesLoaded, setCandidateEmployeesLoaded] = useState(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState('');
  const [memberRoleCode, setMemberRoleCode] = useState<ProjectMemberDTO['roleCode']>('CONTRIBUTOR');
  const [projectCapabilities, setProjectCapabilities] = useState<ProjectCapabilitiesDTO>({
    canViewProject: false,
    canEditProject: false,
    canManageMembers: false,
    canManagePhases: false,
    canManageTasks: false,
    canCancelProject: false,
  });
  const hasProjectMutationAccess = projectCapabilities.canManagePhases || projectCapabilities.canEditProject || projectCapabilities.canCancelProject;
  const activeProjectMembers = useMemo(
    () => members.filter((member) => member.status === 'ACTIVE' && member.isAssignable),
    [members]
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [workflowItems, membersResponse, tasksResponse] = await Promise.all([
        getWorkflowItems({ includeClosedProjects: true }),
        fetch(`/api/admin/projects/${projectId}/members`, { cache: 'no-store' }),
        fetch(`/api/admin/projects/${projectId}/tasks`, { cache: 'no-store' }),
      ]);
      setItems(workflowItems);
      if (membersResponse.ok) {
        const payload = await membersResponse.json() as { members?: ProjectMemberDTO[]; capabilities?: ProjectCapabilitiesDTO };
        setMembers(payload.members || []);
        if (payload.capabilities) setProjectCapabilities(payload.capabilities);
      }
      if (tasksResponse.ok) {
        const payload = await tasksResponse.json() as { tasks?: TaskAssignmentDTO[] };
        setProjectTasks(payload.tasks || []);
        setTaskLoadBlocked(false);
      } else if (tasksResponse.status === 409 || tasksResponse.status === 403 || tasksResponse.status === 401) {
        setProjectTasks([]);
        setTaskLoadBlocked(true);
      } else {
        throw new Error('task_load_failed');
      }
    } catch {
      setLoadFailed(true);
      showToast('Không thể tải dự án.', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, showToast]);

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
    const assignmentTaskGroups = new Map<number, TaskAssignmentDTO[]>();
    projectTasks.forEach((task) => {
      if (!task.phaseId) return;
      assignmentTaskGroups.set(task.phaseId, [...(assignmentTaskGroups.get(task.phaseId) || []), task]);
    });
    const statuses = deriveSequentialPhaseStatuses(phaseDrafts);

    return phaseDrafts.map((phase, index) => {
      const assignmentTasks = phase.item.phase_id ? assignmentTaskGroups.get(phase.item.phase_id) || [] : [];
      const mappedTasks = phase.item.phase_id && assignmentTasks.length === 0 ? legacyTaskGroups.get(phase.item.phase_id) || [] : [];
      const tasks: DisplayTask[] = [...assignmentTasks, ...phase.tasks, ...mappedTasks];
      const completedTaskCount = tasks.filter(isTaskCompleted).length;
      const status = statuses[index] || 'LOCKED';
      const progressValues = tasks.map((task) => isTaskAssignmentDTO(task) ? task.progressPercent : isTaskCompleted(task) ? 100 : 0);
      const progressPercent = calculatePhaseProgress(progressValues, status === 'COMPLETED');
      const lastActivityAt = tasks
        .map((task) => isTaskAssignmentDTO(task) ? task.lastActivityAt : null)
        .filter((value): value is string => Boolean(value))
        .sort()
        .at(-1) || null;
      const gate = phaseGateState({ status, taskCount: tasks.length, completedTaskCount, orderIndex: phase.orderIndex }, false);

      return {
        ...phase,
        status,
        tasks,
        taskCount: tasks.length,
        completedTaskCount,
        progressPercent,
        lastActivityAt,
        gateMessage: gate.gatingMessage,
        canCompletePhase: gate.canCompletePhase,
        isLocked: status === 'LOCKED',
        isCompleted: status === 'COMPLETED',
      };
    });
  }, [projectItems, legacyTasks, projectTasks]);

  const unassignedTasks = useMemo(
    () => projectTasks.filter((task) => !task.phaseId).length > 0
      ? projectTasks.filter((task) => !task.phaseId)
      : mapLegacyTasksToPhaseGroups(phases, legacyTasks).get('unassigned') || [],
    [phases, legacyTasks, projectTasks]
  );
  const isProjectCancelled = String(firstDescription.project_status || '').toUpperCase() === 'CANCELLED';
  const canManageProject = hasProjectMutationAccess && !isProjectCancelled;
  const phasesWithGates = useMemo(() => phases.map((phase) => {
    const gate = phaseGateState({ status: phase.status, taskCount: phase.taskCount, completedTaskCount: phase.completedTaskCount, orderIndex: phase.orderIndex }, canManageProject);
    return { ...phase, gateMessage: gate.gatingMessage, canCompletePhase: gate.canCompletePhase };
  }), [phases, canManageProject]);
  const completedPhaseCount = phasesWithGates.filter((phase) => phase.status === 'COMPLETED').length;
  const progressPercent = calculateProjectProgress(phasesWithGates.map((phase) => phase.progressPercent));
  const totalTaskCount = phasesWithGates.reduce((sum, phase) => sum + phase.taskCount, 0) + unassignedTasks.length;
  const completedTaskCount = phasesWithGates.reduce((sum, phase) => sum + phase.completedTaskCount, 0) + unassignedTasks.filter(isTaskCompleted).length;
  const nearestDeadline = [...phasesWithGates.flatMap((phase) => phase.tasks.map(getTaskDeadlineValue)), ...unassignedTasks.map(getTaskDeadlineValue)]
    .filter((value): value is string => Boolean(value))
    .sort()[0] || null;
  const memberCount = members.filter((member) => member.status === 'ACTIVE').length;
  const activePhase = phasesWithGates.find((phase) => phase.status === 'ACTIVE' || phase.status === 'BLOCKED' || phase.status === 'REVIEW') || phases.find((phase) => phase.status === 'COMPLETED') || phases[0] || null;
  const selectedPhase = phasesWithGates.find((phase) => phase.item.phase_id === selectedPhaseId) || activePhase;
  const editingCurrentTask = editingTask ? projectTasks.find((task) => task.taskId === editingTask.taskId) || null : null;
  const editingTaskIntent = editingTask && editingCurrentTask
    ? describeTaskEditIntent({
      currentTask: editingCurrentTask,
      nextAssigneeEmployeeId: editingTask.assigneeEmployeeId ? Number(editingTask.assigneeEmployeeId) : null,
      nextDeadline: editingTask.deadline || null,
      nextStatus: editingTask.status,
    })
    : null;
  const canSaveEditingTask = Boolean(
    editingTask &&
    taskActionLoading === null &&
    (!editingCurrentTask || hasTaskEditChanges(editingTaskIntent))
  );
  const projectDetail: ProjectDetailDTO = {
    id: projectId,
    name: projectName,
    status: firstDescription.project_status || null,
    projectDeadline: firstDescription.project_deadline || null,
    progressPercent,
    currentPhaseId: activePhase?.item.phase_id || null,
    capabilities: projectCapabilities,
    members,
    phases: phasesWithGates,
    unassignedTasks,
  };
  const canManageMembers = projectDetail.capabilities.canManageMembers && !isProjectCancelled;
  const canManageTasks = projectDetail.capabilities.canManageTasks && !isProjectCancelled;

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



  const loadCandidateEmployees = async () => {
    if (candidateEmployeesLoaded || membersLoading) return;
    setMembersLoading(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/members?scope=candidates`, { cache: 'no-store' });
      if (!response.ok) throw new Error('employee_load_failed');
      const payload = await response.json() as { candidates?: Array<{ employeeId: number; fullName: string; title: string | null }> };
      setCandidateEmployees(payload.candidates || []);
      setCandidateEmployeesLoaded(true);
    } catch {
      showToast('Không thể tải danh sách nhân sự.', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setMembersLoading(false);
    }
  };

  const openAddMemberModal = async () => {
    if (!canManageMembers) return;
    setAddMemberOpen(true);
    await loadCandidateEmployees();
  };

  const refreshMembers = async () => {
    const response = await fetch(`/api/admin/projects/${projectId}/members`, { cache: 'no-store' });
    if (!response.ok) throw new Error('member_refresh_failed');
    const payload = await response.json() as { members?: ProjectMemberDTO[]; capabilities?: ProjectCapabilitiesDTO };
    setMembers(payload.members || []);
    if (payload.capabilities) setProjectCapabilities(payload.capabilities);
    setCandidateEmployeesLoaded(false);
  };

  const handleAddMember = async () => {
    if (!canManageMembers || memberActionLoading) return;
    setMemberActionLoading(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: Number(memberEmployeeId), roleCode: memberRoleCode }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'member_add_failed');
      showToast('Đã thêm thành viên.', 'Thành viên dự án đã được cập nhật.', 'success');
      setAddMemberOpen(false);
      setMemberEmployeeId('');
      await refreshMembers();
    } catch (error) {
      showToast('Không thể thêm thành viên.', error instanceof Error ? error.message : 'Vui lòng thử lại sau.', 'error');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleChangeRole = async (member: ProjectMemberDTO) => {
    if (!canManageMembers || memberActionLoading) return;
    const nextRole = window.prompt('Nhập role mới: PROJECT_OWNER, PROJECT_MANAGER, CREATIVE_LEAD hoặc CONTRIBUTOR', member.roleCode);
    if (!nextRole) return;
    setMemberActionLoading(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/members/${member.membershipId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleCode: nextRole }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'member_update_failed');
      showToast('Đã đổi vai trò.', 'Vai trò dự án đã được cập nhật.', 'success');
      await refreshMembers();
    } catch (error) {
      showToast('Không thể đổi vai trò.', error instanceof Error ? error.message : 'Vui lòng thử lại sau.', 'error');
    } finally {
      setMemberActionLoading(false);
    }
  };

  const handleRevokeMember = (member: ProjectMemberDTO) => {
    if (!canManageMembers || memberActionLoading) return;
    showConfirm('Thu hồi thành viên', 'Thành viên sẽ không còn ACTIVE trong dự án, lịch sử vẫn được giữ lại.', async () => {
      setMemberActionLoading(true);
      try {
        const response = await fetch(`/api/admin/projects/${projectId}/members/${member.membershipId}/revoke`, { method: 'POST' });
        const payload = await response.json().catch(() => null) as { message?: string } | null;
        if (!response.ok) throw new Error(payload?.message || 'member_revoke_failed');
        showToast('Đã thu hồi thành viên.', 'Lịch sử membership vẫn được giữ lại.', 'success');
        await refreshMembers();
      } catch (error) {
        showToast('Không thể thu hồi thành viên.', error instanceof Error ? error.message : 'Vui lòng thử lại sau.', 'error');
      } finally {
        setMemberActionLoading(false);
      }
    });
  };

  const handleStartEditPhase = (phase: PhaseRecord) => {
    if (!canManageProject) return;
    if (!phase.item.phase_id) return;
    setEditingPhaseId(phase.item.phase_id);
    setEditingPhaseName(phase.phaseName);
    setEditingPhaseOrder(String(phase.orderIndex));
  };

  const handleStartEditTask = (task: DisplayTask) => {
    if (!canManageTasks || !isTaskAssignmentDTO(task)) return;
    setEditingTask({
      taskId: task.taskId,
      assigneeEmployeeId: task.assigneeEmployeeId ? String(task.assigneeEmployeeId) : '',
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      status: task.status,
      comment: '',
    });
  };

  const handleSaveTask = async () => {
    if (!canManageTasks || !editingTask || taskActionLoading) return;
    const currentTask = projectTasks.find((task) => task.taskId === editingTask.taskId);
    const nextAssigneeEmployeeId = editingTask.assigneeEmployeeId ? Number(editingTask.assigneeEmployeeId) : null;
    const nextDeadline = editingTask.deadline || null;
    const editIntent = currentTask
      ? describeTaskEditIntent({
        currentTask,
        nextAssigneeEmployeeId,
        nextDeadline,
        nextStatus: editingTask.status,
      })
      : { hasAssigneeChange: true, hasDeadlineChange: true, hasStatusChange: true, changedLabels: ['người phụ trách', 'deadline', 'trạng thái'] };

    if (currentTask && !hasTaskEditChanges(editIntent)) {
      showToast('Chưa có thay đổi.', 'Hãy chỉnh người phụ trách, deadline hoặc trạng thái trước khi lưu.', 'info');
      return;
    }

    setTaskActionLoading(editingTask.taskId);
    try {
      if (editIntent.hasAssigneeChange) {
        const assignResponse = await fetch(`/api/admin/projects/${projectId}/tasks/${editingTask.taskId}/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assigneeEmployeeId: nextAssigneeEmployeeId,
            comment: editingTask.comment || null,
          }),
        });
        const assignPayload = await assignResponse.json().catch(() => null) as { message?: string } | null;
        if (!assignResponse.ok) throw new Error(assignPayload?.message || 'Không thể giao công việc.');
      }

      if (editIntent.hasDeadlineChange) {
        const updateResponse = await fetch(`/api/admin/projects/${projectId}/tasks/${editingTask.taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deadline: nextDeadline }),
        });
        const updatePayload = await updateResponse.json().catch(() => null) as { message?: string } | null;
        if (!updateResponse.ok) throw new Error(updatePayload?.message || 'Không thể cập nhật deadline.');
      }

      if (editIntent.hasStatusChange) {
        if (currentTask && !canTransitionTaskStatus(currentTask.status, editingTask.status)) {
          throw new Error('Chuyển trạng thái này chưa được hỗ trợ bởi state machine.');
        }

        const statusResponse = await fetch(`/api/admin/projects/${projectId}/tasks/${editingTask.taskId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: editingTask.status }),
        });
        const statusPayload = await statusResponse.json().catch(() => null) as { message?: string } | null;
        if (!statusResponse.ok) throw new Error(statusPayload?.message || 'Không thể đổi trạng thái.');
      }

      setEditingTask(null);
      showToast('Đã lưu công việc.', 'Công việc con đã được cập nhật.', 'success');
      await loadData();
    } catch (error) {
      showToast('Không thể lưu công việc.', error instanceof Error ? error.message : 'Vui lòng thử lại sau.', 'error');
    } finally {
      setTaskActionLoading(null);
    }
  };

  const handleSavePhase = async (phase: PhaseRecord) => {
    if (!canManageProject) return;
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
    if (!canManageProject) return;
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
    if (isProjectCancelled) return;
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
        <div className="mx-auto max-w-7xl space-y-5" aria-busy="true" aria-label="Đang tải chi tiết dự án">
          <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="h-4 w-36 animate-pulse rounded bg-slate-800" />
              <div className="h-7 w-72 animate-pulse rounded bg-slate-800" />
              <div className="h-4 w-56 animate-pulse rounded bg-slate-900" />
            </div>
            <div className="flex gap-2">
              <div className="h-9 w-32 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
              <div className="h-9 w-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
            </div>
          </div>
          <div className="h-28 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              <div className="h-44 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
              <div className="h-56 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
            </div>
            <div className="h-64 animate-pulse rounded-lg border border-slate-800 bg-slate-900" />
          </div>
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Clock className="h-4 w-4 animate-spin" /> Đang tải chi tiết dự án...
          </div>
        </div>
      </div>
    );
  }

  if (loadFailed) {
    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-100 sm:p-6">
        <div className="mx-auto max-w-3xl py-20">
          <OperationalState
            tone="warning"
            title="Không thể tải chi tiết dự án."
            description="Dữ liệu dự án chưa sẵn sàng hoặc kết nối bị gián đoạn. Vui lòng thử tải lại."
            action={(
              <button type="button" onClick={loadData} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500">
                Thử lại
              </button>
            )}
          />
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
            <span className={`rounded-lg border px-3 py-2 text-xs ${isProjectCancelled ? 'border-red-800 bg-red-950/40 text-red-200' : 'border-slate-700 text-slate-300'}`}>
              Trạng thái: {projectDetail.status || 'Chưa có dữ liệu'}
            </span>
            <button type="button" disabled={isProjectCancelled} onClick={handleCancelProject} className="inline-flex items-center gap-2 rounded-lg border border-amber-800 bg-amber-950/40 px-3 py-2 text-xs font-bold text-amber-200 hover:bg-amber-900/40 disabled:cursor-not-allowed disabled:border-slate-800 disabled:bg-slate-900 disabled:text-slate-500">
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

        {isProjectCancelled && (
          <section className="rounded-lg border border-red-900 bg-red-950/25 p-4 text-xs text-red-100">
            Dự án đã hủy. Màn hình này chỉ cho xem dữ liệu hiện có; các thao tác sửa phase, task và thông tin dự án đang bị khóa.
          </section>
        )}

        {taskLoadBlocked && (
          <section className="rounded-lg border border-amber-900 bg-amber-950/25 p-4 text-xs text-amber-100">
            Task Assignment Foundation chưa sẵn sàng hoặc bạn chỉ có quyền xem giới hạn. Dữ liệu công việc legacy vẫn hiển thị ở chế độ chỉ xem.
          </section>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
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
                  <OperationalState
                    title="Dự án chưa có giai đoạn."
                    description="Hãy thêm giai đoạn khi quy trình sản xuất đã được duyệt."
                  />
                )}
              </div>
            </section>



            <section className="rounded-lg border border-slate-800 bg-slate-900">
              <div className="flex flex-col gap-3 border-b border-slate-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-cyan-300" />
                    <h2 className="text-sm font-black text-slate-100">Thành viên dự án</h2>
                  </div>
                  <p className="text-[11px] text-slate-500">{memberCount} thành viên đang hoạt động · Không hard delete membership.</p>
                </div>
                <button type="button" disabled={!canManageMembers || memberActionLoading} onClick={openAddMemberModal} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                  <UserPlus className="h-4 w-4" /> Thêm thành viên
                </button>
              </div>
              <div className="overflow-x-auto p-4">
                {projectDetail.members.length === 0 ? (
                  <OperationalState
                    title="Chưa có thành viên dự án."
                    description="Thêm thành viên ACTIVE trước khi giao việc bằng mã nhân sự ổn định."
                  />
                ) : (
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="text-slate-500"><tr className="border-b border-slate-800"><th className="py-2 pr-3">Nhân viên</th><th className="py-2 pr-3">Chức vụ</th><th className="py-2 pr-3">Vai trò</th><th className="py-2 pr-3">Trạng thái</th><th className="py-2 pr-3">Ngày tham gia</th><th className="py-2">Thao tác</th></tr></thead>
                    <tbody className="divide-y divide-slate-800">
                      {projectDetail.members.map((member) => (
                        <tr key={member.membershipId}>
                          <td className="py-3 pr-3 font-bold text-slate-100">{member.fullName}</td>
                          <td className="py-3 pr-3 text-slate-300">{member.title || 'Chưa có'}</td>
                          <td className="py-3 pr-3 text-slate-300">{member.roleLabel}</td>
                          <td className="py-3 pr-3"><span className={`rounded border px-2 py-1 ${member.status === 'ACTIVE' ? 'border-emerald-800 text-emerald-200' : 'border-slate-700 text-slate-400'}`}>{member.status === 'ACTIVE' ? 'Đang hoạt động' : 'Đã thu hồi'}</span></td>
                          <td className="py-3 pr-3 text-slate-300">{formatDate(member.joinedAt)}</td>
                          <td className="py-3"><div className="flex gap-2"><button type="button" disabled={!canManageMembers || member.status !== 'ACTIVE' || memberActionLoading} onClick={() => handleChangeRole(member)} className="rounded border border-slate-700 px-2 py-1 font-bold text-slate-300 disabled:opacity-40">Đổi vai trò</button><button type="button" disabled={!canManageMembers || member.status !== 'ACTIVE' || memberActionLoading} onClick={() => handleRevokeMember(member)} className="rounded border border-amber-800 px-2 py-1 font-bold text-amber-200 disabled:opacity-40">Thu hồi</button></div></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                        disabled={selectedPhase.isLocked || !canManageProject}
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
                  {selectedPhase.gateMessage && (
                    <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                      {selectedPhase.gateMessage}
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

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                    Công việc con dùng Task Assignment Foundation khi đã bật migration gate. Nếu chưa bật, màn hình giữ dữ liệu legacy ở chế độ chỉ xem.
                  </div>

                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:grid-cols-4">
                    <ProjectDetailField label="Deadline" value={formatDate(selectedPhase.description.stage_deadline || selectedPhase.description.project_deadline)} />
                    <ProjectDetailField label="Người phụ trách phase" value={selectedPhase.description.stage_owner || 'Chưa gán'} />
                    <ProjectDetailField label="Tiến độ phase" value={`${selectedPhase.progressPercent}% · ${selectedPhase.completedTaskCount}/${selectedPhase.taskCount} công việc`} />
                    <ProjectDetailField label="Hoạt động gần nhất" value={formatDateTime(selectedPhase.lastActivityAt)} />
                  </dl>

                  <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs text-slate-400">
                    {selectedPhase.description.next_action || selectedPhase.description.stage_type || 'Chưa có mô tả giai đoạn.'}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="hidden w-full min-w-[900px] text-left text-xs md:table">
                      <thead className="text-slate-500">
                        <tr className="border-b border-slate-800">
                          <th className="py-2 pr-3">Tên công việc</th>
                          <th className="py-2 pr-3">Người phụ trách</th>
                          <th className="py-2 pr-3">Deadline</th>
                          <th className="py-2 pr-3">Trạng thái</th>
                          <th className="py-2 pr-3">Tiến độ</th>
                          <th className="py-2 pr-3">Bình luận</th>
                          <th className="py-2">Thao tác</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {selectedPhase.tasks.map((task) => (
                          <tr key={getTaskKey(task)} className="text-slate-300">
                            <td className="py-3 pr-3 font-bold text-slate-100">{getTaskTitle(task)}</td>
                            <td className="py-3 pr-3">{getTaskAssigneeLabel(task)}</td>
                            <td className="py-3 pr-3">{getTaskDeadlineLabel(task)}</td>
                            <td className="py-3 pr-3">{taskStatusLabel(getTaskStatusValue(task))}</td>
                            <td className="py-3 pr-3">{getTaskProgressLabel(task)}</td>
                            <td className="py-3 pr-3">{getTaskCommentLabel(task)}</td>
                            <td className="py-3">
                              {isTaskAssignmentDTO(task) && canManageTasks ? (
                                <button type="button" onClick={() => handleStartEditTask(task)} className="rounded border border-slate-700 px-2 py-1 font-bold text-slate-300">
                                  Sửa
                                </button>
                              ) : 'Chỉ xem'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="space-y-3 md:hidden">
                      {selectedPhase.tasks.map((task) => (
                        <article key={getTaskKey(task)} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-slate-100">{getTaskTitle(task)}</h3>
                            <span className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{taskStatusLabel(getTaskStatusValue(task))}</span>
                          </div>
                          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <TaskMobileField label="Người phụ trách" value={getTaskAssigneeLabel(task)} />
                            <TaskMobileField label="Người đóng gói" value={getTaskPackerLabel(task) || 'Chưa gán'} />
                            <TaskMobileField label="Deadline" value={getTaskDeadlineLabel(task)} />
                            <TaskMobileField label="Tiến độ" value={getTaskProgressLabel(task)} />
                            <TaskMobileField label="Bình luận" value={getTaskCommentLabel(task)} />
                          </dl>
                          {isTaskAssignmentDTO(task) && canManageTasks && (
                            <button type="button" onClick={() => handleStartEditTask(task)} className="mt-3 w-full rounded border border-slate-700 px-2 py-2 font-bold text-slate-300">
                              Sửa
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                    {selectedPhase.tasks.length === 0 && (
                      <OperationalState
                        title="Giai đoạn này chưa có công việc."
                        description="Công việc con sẽ hiển thị ở đây sau khi Task Assignment Foundation trả về dữ liệu theo phase."
                      />
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
                    <div key={getTaskKey(task)} className="grid grid-cols-1 gap-2 p-4 text-xs md:grid-cols-[1fr_180px_160px]">
                      <div>
                        <p className="font-bold text-slate-100">{getTaskTitle(task)}</p>
                        <p className="mt-1 inline-flex items-center gap-1 text-slate-500"><MessageSquare className="h-3 w-3" /> {getTaskCommentLabel(task)}</p>
                      </div>
                      <div className="text-slate-300">
                        <p>Người phụ trách: {getTaskAssigneeLabel(task)}</p>
                        <p>Người đóng gói: {getTaskPackerLabel(task) || 'Chưa gán'}</p>
                      </div>
                      <div className="text-slate-400">
                        <p>Phase: {isTaskAssignmentDTO(task) ? 'Chưa gán' : task.currentPhaseText || 'Chưa có'}</p>
                        <p>Deadline: {getTaskDeadlineLabel(task)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          <aside className="space-y-4 xl:sticky xl:top-4 xl:self-start">
            <section className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <h2 className="text-sm font-black text-slate-100">Thông tin dự án</h2>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:grid-cols-1">
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
                  <input disabled={!canManageProject} value={driveLinkInput} onChange={(event) => setDriveLinkInput(event.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Nhập link Drive" />
                  <button disabled={!canManageProject} onClick={handleSaveDriveLink} className="w-full rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">Lưu thông tin</button>
                </div>
              </dl>
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
        {addMemberOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Thêm thành viên dự án">
            <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-4"><h2 className="text-base font-black text-slate-100">Thêm thành viên dự án</h2><p className="text-xs text-slate-500">Chỉ tải danh sách nhân sự ACTIVE khi mở modal.</p></div>
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-300">Nhân sự</label>
                <select value={memberEmployeeId} onChange={(event) => setMemberEmployeeId(event.target.value)} disabled={membersLoading || memberActionLoading} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                  <option value="">Chọn nhân sự</option>
                  {candidateEmployees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}{employee.title ? ` · ${employee.title}` : ''}</option>)}
                </select>
                {candidateEmployeesLoaded && candidateEmployees.length === 0 && <p className="text-xs text-slate-500">Không còn nhân sự ACTIVE nào chưa có membership ACTIVE.</p>}
                <label className="block text-xs font-bold text-slate-300">Vai trò dự án</label>
                <select value={memberRoleCode} onChange={(event) => setMemberRoleCode(event.target.value as ProjectMemberDTO['roleCode'])} disabled={memberActionLoading} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                  <option value="PROJECT_OWNER">Chủ dự án</option><option value="PROJECT_MANAGER">Quản lý dự án</option><option value="CREATIVE_LEAD">Lead sáng tạo</option><option value="CONTRIBUTOR">Thành viên</option>
                </select>
              </div>
              <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={memberActionLoading} onClick={() => setAddMemberOpen(false)} className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button><button type="button" disabled={!memberEmployeeId || memberActionLoading || membersLoading} onClick={handleAddMember} className="rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">{memberActionLoading ? 'Đang lưu...' : 'Thêm thành viên'}</button></div>
            </div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-label="Sửa công việc con">
            <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-4">
                <h2 className="text-base font-black text-slate-100">Sửa công việc con</h2>
                <p className="text-xs text-slate-500">Người phụ trách phải là thành viên ACTIVE của dự án.</p>
              </div>
              <div className="space-y-3 text-xs">
                <label className="block font-bold text-slate-300">Người phụ trách</label>
                <select value={editingTask.assigneeEmployeeId} onChange={(event) => setEditingTask({ ...editingTask, assigneeEmployeeId: event.target.value })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  <option value="">Chưa phân công</option>
                  {activeProjectMembers.map((member) => <option key={member.employeeId} value={member.employeeId}>{member.fullName}{member.title ? ` · ${member.title}` : ''}</option>)}
                </select>
                <label className="block font-bold text-slate-300">Deadline</label>
                <input type="date" value={editingTask.deadline} onChange={(event) => setEditingTask({ ...editingTask, deadline: event.target.value })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                <label className="block font-bold text-slate-300">Trạng thái</label>
                <select value={editingTask.status} onChange={(event) => setEditingTask({ ...editingTask, status: event.target.value as TaskAssignmentStatus })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  {TASK_STATUS_OPTIONS.filter((option) => {
                    const currentTask = projectTasks.find((task) => task.taskId === editingTask.taskId);
                    return !currentTask || allowedNextTaskStatuses(currentTask.status).includes(option.value);
                  }).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label className="block font-bold text-slate-300">Bình luận</label>
                <textarea value={editingTask.comment} onChange={(event) => setEditingTask({ ...editingTask, comment: event.target.value })} disabled={taskActionLoading !== null} rows={4} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none" placeholder="Nhập bình luận cho công việc" />
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-400" aria-live="polite">
                  {editingTaskIntent && hasTaskEditChanges(editingTaskIntent)
                    ? `Sẽ cập nhật ${editingTaskIntent.changedLabels.join(', ')}.`
                    : 'Chưa có thay đổi để lưu.'}
                </div>
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <button type="button" disabled={taskActionLoading !== null} onClick={() => setEditingTask(null)} className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button>
                <button type="button" disabled={!canSaveEditingTask} onClick={handleSaveTask} className="inline-flex items-center gap-2 rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                  <Save className="h-4 w-4" /> {taskActionLoading !== null ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </div>
          </div>
        )}

    </div>
  );
}
