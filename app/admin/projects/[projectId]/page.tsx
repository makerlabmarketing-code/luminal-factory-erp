'use client';

import { CommonTable, TableRowActions } from '@/component/data-table/CommonTable';
import Link from 'next/link';
import { notFound, useParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Plus,
  Save,
} from 'lucide-react';
import { useNotification } from '@/component/NotificationContext';
import { ProjectWorkspaceTabs, type ProjectWorkspaceTab } from './ProjectWorkspaceTabs';
import { ProjectActionDialog } from './ProjectActionDialog';
import { PhaseMembersSection } from './PhaseMembersSection';
import { ProjectMembershipSection } from './ProjectMembershipSection';
import { ProjectTimelineSection } from './ProjectTimelineSection';
import { OperationalState } from '@/component/OperationalState';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { ProjectPageHeader, ProjectPanel } from '@/component/project/ProjectPagePatterns';
import type {
  ProjectMemberDTO,
  ProjectMembershipCapabilitiesDTO,
  ProjectMembershipResponseDTO,
  ProjectMembershipSummaryDTO,
} from '@/lib/types/project-membership';
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
import { isTaskOverdue, summarizeProjectExecution, taskDependencyLabel } from '@/lib/project-execution-summary';
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
  overdueTaskCount: number;
  progressPercent: number;
  lastActivityAt: string | null;
  gateMessage: string | null;
  canCompletePhase: boolean;
  isLocked: boolean;
  isCompleted: boolean;
}

interface ProjectDetailDTO {
  id: number;
  projectCode: string;
  name: string;
  status: string | null;
  projectDeadline: string | null;
  progressPercent: number;
  currentPhaseId: number | null;
  capabilities: ProjectMembershipCapabilitiesDTO;
  members: ProjectMemberDTO[];
  phases: PhaseRecord[];
  unassignedTasks: DisplayTask[];
}

interface TaskEditState {
  taskId: number;
  title: string;
  description: string;
  assigneeEmployeeId: string;
  deadline: string;
  status: TaskAssignmentStatus;
  comment: string;
}

interface TaskCreateState {
  phaseId: number;
  title: string;
  description: string;
  assigneeEmployeeId: string;
  deadline: string;
  comment: string;
}

interface MemberMutationIntent {
  action: 'CHANGE_ROLE' | 'REVOKE';
  member: ProjectMemberDTO;
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
  if (!value) return 'Chưa đặt hạn hoàn thành';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt hạn hoàn thành';

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
  phases: Array<Omit<PhaseRecord, 'status' | 'taskCount' | 'completedTaskCount' | 'overdueTaskCount' | 'progressPercent' | 'lastActivityAt' | 'gateMessage' | 'canCompletePhase' | 'isLocked' | 'isCompleted'>>
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

function getTaskPriorityLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return task.priority || 'Bình thường';
  return 'Bình thường';
}

function getTaskDependencyLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return taskDependencyLabel(task);
  return 'Không có phụ thuộc';
}

function getTaskLastUpdateLabel(task: DisplayTask): string {
  if (isTaskAssignmentDTO(task)) return formatDateTime(task.lastActivityAt);
  return 'Chưa có dữ liệu';
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

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { cache: 'no-store', signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  const { showToast, showConfirm } = useNotification();
  const projectId = Number(params.projectId);
  const [items, setItems] = useState<WorkflowSetting[]>([]);
  const [projectTasks, setProjectTasks] = useState<TaskAssignmentDTO[]>([]);
  const [taskLoadBlocked, setTaskLoadBlocked] = useState(false);
  const [canCreateTasks, setCanCreateTasks] = useState(false);
  const [taskActionLoading, setTaskActionLoading] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<TaskEditState | null>(null);
  const [creatingTask, setCreatingTask] = useState<TaskCreateState | null>(null);
  const [taskTitleError, setTaskTitleError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [notFoundConfirmed, setNotFoundConfirmed] = useState(false);
  const [phaseLoadFailed, setPhaseLoadFailed] = useState(false);
  const [memberLoadFailed, setMemberLoadFailed] = useState(false);
  const [isCancellingProject, setIsCancellingProject] = useState(false);
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [editingPhaseOrder, setEditingPhaseOrder] = useState('');
  const [driveLinkInput, setDriveLinkInput] = useState('');
  const [selectedPhaseId, setSelectedPhaseId] = useState<number | null>(null);
  const [members, setMembers] = useState<ProjectMemberDTO[]>([]);
  const [membershipSummary, setMembershipSummary] = useState<ProjectMembershipSummaryDTO | null>(null);
  const [membershipInitialLoading, setMembershipInitialLoading] = useState(true);
  const [membershipRefreshing, setMembershipRefreshing] = useState(false);
  const [candidatesLoading, setCandidatesLoading] = useState(false);
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [membershipAtomicMutationsEnabled, setMembershipAtomicMutationsEnabled] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [addMemberReason, setAddMemberReason] = useState('');
  const [addMemberError, setAddMemberError] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState<ProjectWorkspaceTab>('work');
  const [newPhaseOpen, setNewPhaseOpen] = useState(false);
  const [newPhaseName, setNewPhaseName] = useState('');
  const [newPhaseError, setNewPhaseError] = useState('');
  const [phaseSaving, setPhaseSaving] = useState(false);
  const phaseCreateLock = useRef(false);
  const [memberMutationIntent, setMemberMutationIntent] = useState<MemberMutationIntent | null>(null);
  const [memberMutationReason, setMemberMutationReason] = useState('');
  const [memberNextRoleCode, setMemberNextRoleCode] = useState<ProjectMemberDTO['roleCode']>('CONTRIBUTOR');
  const [candidateEmployees, setCandidateEmployees] = useState<Array<{ employeeId: number; fullName: string; title: string | null }>>([]);
  const [candidateEmployeesLoaded, setCandidateEmployeesLoaded] = useState(false);
  const candidateLoadPromiseRef = useRef<Promise<void> | null>(null);
  const memberMutationLockRef = useRef(false);
  const [memberEmployeeId, setMemberEmployeeId] = useState('');
  const [memberRoleCode, setMemberRoleCode] = useState<ProjectMemberDTO['roleCode']>('CONTRIBUTOR');
  const [projectCapabilities, setProjectCapabilities] = useState<ProjectMembershipCapabilitiesDTO>({
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

  const refreshTasks = useCallback(async () => {
    try {
      const tasksResponse = await fetchWithTimeout(`/api/admin/projects/${projectId}/tasks`);
      if (!tasksResponse.ok) throw new Error('task_load_failed');
      const payload = await tasksResponse.json() as { tasks?: TaskAssignmentDTO[]; capabilities?: { canCreateTasks?: boolean } };
      setProjectTasks(payload.tasks || []);
      setCanCreateTasks(Boolean(payload.capabilities?.canCreateTasks));
      setTaskLoadBlocked(false);
    } catch {
      setTaskLoadBlocked(true);
    }
  }, [projectId]);

  const refreshPhases = useCallback(async () => {
    try {
      const workflowItems = await Promise.race([
        getWorkflowItems({ includeClosedProjects: true }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('project_core_timeout')), 10_000)),
      ]);
      const matchingItems = workflowItems.filter((item) => item.project_id === projectId);
      if (matchingItems.length > 0) setItems(matchingItems);
      setPhaseLoadFailed(false);
    } catch {
      setPhaseLoadFailed(true);
    }
  }, [projectId]);

  const refreshMembers = useCallback(async (isInitialLoad = false) => {
    if (isInitialLoad) setMembershipInitialLoading(true);
    else setMembershipRefreshing(true);
    setMemberLoadFailed(false);

    try {
      const response = await fetchWithTimeout(`/api/admin/projects/${projectId}/members`);
      if (response.status === 401 || response.status === 403) {
        setForbidden(true);
        throw new Error('member_forbidden');
      }
      if (!response.ok) throw new Error('member_refresh_failed');
      const payload = await response.json() as ProjectMembershipResponseDTO;
      setMembers(payload.members || []);
      setMembershipSummary(payload.summary || null);
      setMembershipAtomicMutationsEnabled(payload.atomicMutationsEnabled === true);
      if (payload.capabilities) setProjectCapabilities(payload.capabilities);
      setCandidateEmployeesLoaded(false);
    } catch {
      setMemberLoadFailed(true);
    } finally {
      setMembershipInitialLoading(false);
      setMembershipRefreshing(false);
    }
  }, [projectId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    setForbidden(false);
    setNotFoundConfirmed(false);
    setPhaseLoadFailed(false);
    setMemberLoadFailed(false);
    setMembers([]);
    setMembershipSummary(null);
    setMembershipInitialLoading(true);
    if (!Number.isInteger(projectId) || projectId <= 0) {
      setMembershipInitialLoading(false);
      setLoading(false);
      return;
    }
    try {
      const coreResponse = await fetchWithTimeout(`/api/admin/projects/${projectId}`);
      const corePayload = await coreResponse.json().catch(() => null) as { project?: { id: number; projectCode: string; name: string; colorway: string | null; status: string | null; projectDeadline: string | null; driveLink: string | null; createdAt: string | null } } | null;
      if (coreResponse.status === 404) {
        setNotFoundConfirmed(true);
        return;
      }
      if (coreResponse.status === 401 || coreResponse.status === 403) {
        setForbidden(true);
        return;
      }
      if (!coreResponse.ok || !corePayload?.project) throw new Error('project_core_failed');
      const coreProject = corePayload.project;
      const coreItem: WorkflowSetting = {
        id: `project-${coreProject.id}-core`, key: `PROJECT_${coreProject.id}_CORE`, project_id: coreProject.id,
        value: coreProject.status, group_name: 'PRODUCTION_WORKFLOW_PROJECT_PLACEHOLDER',
        config_name: `${coreProject.name} - Chưa thiết lập giai đoạn`, param_type: coreProject.projectDeadline || '',
        description: JSON.stringify({ project_code: coreProject.projectCode, colorway_name: coreProject.colorway, project_drive_link: coreProject.driveLink || '', project_deadline: coreProject.projectDeadline || '', project_created_at: coreProject.createdAt, project_status: coreProject.status, stage_name: 'Chưa thiết lập giai đoạn', stage_type: 'WORKFLOW_NOT_CONFIGURED', tasks_list: [] }),
      };
      setItems([coreItem]);
      setLoading(false);

      void refreshPhases();
      void refreshMembers(true);
      void refreshTasks();
    } catch {
      setLoadFailed(true);
      showToast('Không thể tải dự án.', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  }, [projectId, refreshMembers, refreshPhases, refreshTasks, showToast]);

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
      .filter((phase) => !['WORKFLOW_NOT_CONFIGURED', 'PHASE_LOAD_FAILED'].includes(String(phase.description.stage_type || '')))
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
      const overdueTaskCount = tasks.filter((task) => isTaskOverdue({ deadline: getTaskDeadlineValue(task), status: getTaskStatusValue(task) })).length;
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
        overdueTaskCount,
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
  const executionMetrics = summarizeProjectExecution([...phasesWithGates.flatMap((phase) => phase.tasks), ...unassignedTasks].map((task) => ({
    taskId: isTaskAssignmentDTO(task) ? task.taskId : task.id ? Number(task.id) : null,
    parentTaskId: isTaskAssignmentDTO(task) ? task.parentTaskId : null,
    assigneeEmployeeId: isTaskAssignmentDTO(task) ? task.assigneeEmployeeId : task.assignee_id ? Number(task.assignee_id) : null,
    assigneeFullName: getTaskAssigneeLabel(task),
    deadline: getTaskDeadlineValue(task) || null,
    status: getTaskStatusValue(task) || null,
    lastActivityAt: isTaskAssignmentDTO(task) ? task.lastActivityAt : null,
  })));
  const nearestDeadline = [...phasesWithGates.flatMap((phase) => phase.tasks.map(getTaskDeadlineValue)), ...unassignedTasks.map(getTaskDeadlineValue)]
    .filter((value): value is string => Boolean(value))
    .sort()[0] || null;
  const memberCount = membershipSummary?.activeMemberCount ?? members.filter((member) => member.status === 'ACTIVE').length;
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
    (!editingCurrentTask || hasTaskEditChanges(editingTaskIntent) ||
      editingTask.title.trim() !== editingCurrentTask.title ||
      editingTask.description.trim() !== (editingCurrentTask.description || '') ||
      editingTask.comment.trim())
  );
  const projectDetail: ProjectDetailDTO = {
    id: projectId,
    projectCode: String((firstDescription as WorkflowDescription & { project_code?: string }).project_code || ''),
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
  const hasMemberManagementPermission = projectDetail.capabilities.canManageMembers && !isProjectCancelled;
  const canManageMembers = hasMemberManagementPermission && membershipAtomicMutationsEnabled;
  const canManageTasks = projectDetail.capabilities.canManageTasks && !isProjectCancelled;
  const phaseStatusPersistenceAvailable = phases.some((phase) => phase.description.phase_status_persistence_available === true);
  const phaseStatusMutationAvailable = phases.some((phase) => phase.description.phase_status_mutation_available === true);

  useEffect(() => {
    setDriveLinkInput(firstDescription.project_drive_link || '');
  }, [firstDescription.project_drive_link]);

  useEffect(() => {
    if (!selectedPhaseId && activePhase?.item.phase_id) {
      setSelectedPhaseId(activePhase.item.phase_id);
    }
  }, [activePhase?.item.phase_id, selectedPhaseId]);

  const hasInvalidProjectId = !Number.isInteger(projectId) || projectId <= 0;

  if (notFoundConfirmed) {
    notFound();
  }



  const loadCandidateEmployees = async () => {
    if (candidateEmployeesLoaded) return;
    if (candidateLoadPromiseRef.current) return candidateLoadPromiseRef.current;
    setCandidatesLoading(true);
    const request = (async () => {
      try {
      const response = await fetch(`/api/admin/projects/${projectId}/members?scope=candidates`, { cache: 'no-store' });
      if (!response.ok) throw new Error('employee_load_failed');
      const payload = await response.json() as { candidates?: Array<{ employeeId: number; fullName: string; title: string | null }> };
      setCandidateEmployees(payload.candidates || []);
      setCandidateEmployeesLoaded(true);
    } catch {
      showToast('Không thể tải danh sách nhân sự.', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setCandidatesLoading(false);
      candidateLoadPromiseRef.current = null;
    }
    })();
    candidateLoadPromiseRef.current = request;
    return request;
  };

  const openAddMemberModal = async () => {
    if (!canManageMembers) return;
    setAddMemberReason('Tham gia thực hiện dự án');
    setAddMemberError('');
    setMemberEmployeeId('');
    setMemberRoleCode('CONTRIBUTOR');
    setAddMemberOpen(true);
    await loadCandidateEmployees();
  };

  const handleAddMember = async () => {
    if (!canManageMembers || memberActionLoading || memberMutationLockRef.current) return;
    if (!memberEmployeeId || addMemberReason.trim().length < 10 || addMemberReason.trim().length > 500) {
      setAddMemberError('Chọn nhân sự và nhập lý do từ 10 đến 500 ký tự.');
      return;
    }
    setAddMemberError('');
    memberMutationLockRef.current = true;
    setMemberActionLoading(true);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId: Number(memberEmployeeId), roleCode: memberRoleCode, reason: addMemberReason }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'member_add_failed');
      showToast('Đã thêm thành viên.', 'Thành viên dự án đã được cập nhật.', 'success');
      setAddMemberOpen(false);
      setMemberEmployeeId('');
      setAddMemberReason('');
      setCandidateEmployeesLoaded(false);
      setCandidateEmployees([]);
      await refreshMembers();
    } catch (error) {
      setAddMemberError(error instanceof Error ? error.message : 'Không thể thêm thành viên. Vui lòng thử lại.');
    } finally {
      memberMutationLockRef.current = false;
      setMemberActionLoading(false);
    }
  };

  const handleChangeRole = (member: ProjectMemberDTO) => {
    if (!canManageMembers || memberActionLoading || memberMutationLockRef.current) return;
    setMemberNextRoleCode(member.roleCode);
    setMemberMutationReason('');
    setMemberMutationIntent({ action: 'CHANGE_ROLE', member });
  };

  const handleRevokeMember = (member: ProjectMemberDTO) => {
    if (!canManageMembers || memberActionLoading || memberMutationLockRef.current) return;
    setMemberMutationReason('');
    setMemberMutationIntent({ action: 'REVOKE', member });
  };

  const handleConfirmMemberMutation = async () => {
    if (!canManageMembers || !memberMutationIntent || memberActionLoading || memberMutationLockRef.current) return;
    const { action, member } = memberMutationIntent;
    memberMutationLockRef.current = true;
    setMemberActionLoading(true);
    try {
      const response = await fetch(
        action === 'CHANGE_ROLE'
          ? `/api/admin/projects/${projectId}/members/${member.membershipId}`
          : `/api/admin/projects/${projectId}/members/${member.membershipId}/revoke`,
        {
        method: action === 'CHANGE_ROLE' ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action === 'CHANGE_ROLE'
          ? { roleCode: memberNextRoleCode, reason: memberMutationReason }
          : { reason: memberMutationReason }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'member_mutation_failed');
      showToast(
        action === 'CHANGE_ROLE' ? 'Đã đổi vai trò.' : 'Đã thu hồi thành viên.',
        action === 'CHANGE_ROLE' ? 'Vai trò dự án đã được cập nhật.' : 'Lịch sử thành viên vẫn được giữ lại.',
        'success'
      );
      setMemberMutationIntent(null);
      setMemberMutationReason('');
      await refreshMembers();
    } catch (error) {
      showToast(
        action === 'CHANGE_ROLE' ? 'Không thể đổi vai trò.' : 'Không thể thu hồi thành viên.',
        error instanceof Error ? error.message : 'Vui lòng thử lại sau.',
        'error'
      );
    } finally {
      memberMutationLockRef.current = false;
      setMemberActionLoading(false);
    }
  };

  const openCreatePhase = () => {
    if (!projectCapabilities.canManagePhases || isProjectCancelled || phaseLoadFailed) return;
    setNewPhaseName('');
    setNewPhaseError('');
    setNewPhaseOpen(true);
  };

  const handleCreatePhase = async () => {
    if (!projectCapabilities.canManagePhases || isProjectCancelled || phaseCreateLock.current) return;
    if (!newPhaseName.trim()) { setNewPhaseError('Vui lòng nhập tên giai đoạn.'); return; }
    phaseCreateLock.current = true;
    setPhaseSaving(true);
    setNewPhaseError('');
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/phases`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseName: newPhaseName.trim(), orderIndex: Math.max(-1, ...projectDetail.phases.map(phase => phase.orderIndex)) + 1 }),
      });
      const payload = await response.json().catch(() => null) as { phaseId?: number; message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Không thể tạo giai đoạn. Vui lòng thử lại.');
      setNewPhaseOpen(false);
      await refreshPhases();
      if (payload?.phaseId) setSelectedPhaseId(payload.phaseId);
      showToast('Đã thêm giai đoạn.', 'Giai đoạn mới được đặt ở cuối danh sách.', 'success');
    } catch (error) {
      setNewPhaseError(error instanceof Error ? error.message : 'Không thể tạo giai đoạn. Vui lòng thử lại.');
    } finally { phaseCreateLock.current = false; setPhaseSaving(false); }
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
      title: task.title,
      description: task.description || '',
      assigneeEmployeeId: task.assigneeEmployeeId ? String(task.assigneeEmployeeId) : '',
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      status: task.status,
      comment: '',
    });
  };

  const handleStartCreateTask = (phase: PhaseRecord) => {
    if (!canCreateTasks || !phase.item.phase_id || isProjectCancelled) return;
    setTaskTitleError('');
    setCreatingTask({ phaseId: phase.item.phase_id, title: '', description: '', assigneeEmployeeId: '', deadline: '', comment: '' });
  };

  const handleCreateTask = async () => {
    if (!creatingTask || taskActionLoading) return;
    if (!creatingTask.title.trim()) {
      setTaskTitleError('Vui lòng nhập tên công việc.');
      return;
    }
    setTaskTitleError('');
    setTaskActionLoading(0);
    try {
      const response = await fetch(`/api/admin/projects/${projectId}/tasks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: creatingTask.title,
          description: creatingTask.description || null,
          phaseId: creatingTask.phaseId,
          assigneeEmployeeId: creatingTask.assigneeEmployeeId ? Number(creatingTask.assigneeEmployeeId) : null,
          deadline: creatingTask.deadline || null,
          comment: creatingTask.comment || null,
        }),
      });
      const payload = await response.json().catch(() => null) as { message?: string } | null;
      if (!response.ok) throw new Error(payload?.message || 'Không thể tạo công việc.');
      setCreatingTask(null);
      showToast('Đã thêm công việc.', 'Danh sách công việc của giai đoạn đã được cập nhật.', 'success');
      await refreshTasks();
    } catch (error) {
      showToast('Không thể thêm công việc.', error instanceof Error ? error.message : 'Vui lòng thử lại sau.', 'error');
    } finally {
      setTaskActionLoading(null);
    }
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
      : { hasAssigneeChange: true, hasDeadlineChange: true, hasStatusChange: true, changedLabels: ['người phụ trách', 'hạn hoàn thành', 'trạng thái'] };
    const hasContentChange = Boolean(currentTask && (
      editingTask.title.trim() !== currentTask.title ||
      editingTask.description.trim() !== (currentTask.description || '')
    ));
    const hasComment = Boolean(editingTask.comment.trim());

    if (currentTask && !hasTaskEditChanges(editIntent) && !hasContentChange && !hasComment) {
      showToast('Chưa có thay đổi.', 'Hãy chỉnh người phụ trách, hạn hoàn thành hoặc trạng thái trước khi lưu.', 'info');
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

      if (editIntent.hasDeadlineChange || hasContentChange || (hasComment && !editIntent.hasAssigneeChange && !editIntent.hasStatusChange)) {
        const updateResponse = await fetch(`/api/admin/projects/${projectId}/tasks/${editingTask.taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: editingTask.title, description: editingTask.description || null, deadline: nextDeadline, comment: editIntent.hasAssigneeChange ? null : editingTask.comment || null }),
        });
        const updatePayload = await updateResponse.json().catch(() => null) as { message?: string } | null;
        if (!updateResponse.ok) throw new Error(updatePayload?.message || 'Không thể cập nhật hạn hoàn thành.');
      }

      if (editIntent.hasStatusChange) {
        if (currentTask && !canTransitionTaskStatus(currentTask.status, editingTask.status)) {
          throw new Error('Chuyển trạng thái này chưa được hỗ trợ bởi luồng kiểm soát.');
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
      await refreshTasks();
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
    if (isProjectCancelled || isCancellingProject) return;
    showConfirm('Huỷ dự án này?', 'Dự án sẽ ngừng hoạt động và chuyển sang chế độ chỉ đọc. Thành viên, giai đoạn và công việc vẫn được giữ lại trong lịch sử.', async () => {
      setIsCancellingProject(true);
      try {
        await cancelWorkflowProject(projectId);
        setItems((currentItems) => currentItems.map((item) => {
          if (item.project_id !== projectId) return item;
          const description = parseDescription(item.description);
          return { ...item, description: JSON.stringify({ ...description, project_status: 'CANCELLED' }) };
        }));
        showToast('Đã huỷ dự án', 'Dự án đã được chuyển sang trạng thái Đã huỷ và vẫn được lưu trong lịch sử.', 'success');
      } catch {
        showToast('Không thể huỷ dự án', 'Vui lòng thử lại sau.', 'error');
      } finally {
        setIsCancellingProject(false);
      }
    }, { cancelLabel: 'Giữ dự án', confirmLabel: 'Xác nhận huỷ' });
  };

  if (hasInvalidProjectId) {
    return (
      <div className="admin-page text-slate-100"><div className="mx-auto max-w-3xl py-20"><OperationalState tone="warning" title="Mã dự án không hợp lệ." description="Đường dẫn dự án phải chứa một mã số nguyên dương." action={<Link href="/admin/projects" className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white">Quay lại danh sách</Link>} /></div></div>
    );
  }

  if (loading) {
    return <CenteredPageLoading message="Đang tải chi tiết dự án..." />;
  }

  if (loadFailed) {
    return (
      <div className="admin-page text-slate-100">
        <div className="mx-auto max-w-3xl py-20">
          <OperationalState
            tone="warning"
            title="Không thể tải thông tin dự án"
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

  if (forbidden) {
    return <div className="admin-page text-slate-100"><div className="mx-auto max-w-3xl py-20"><OperationalState tone="warning" title="Bạn không có quyền xem dự án này" description="Hãy liên hệ người quản lý dự án để được cấp quyền." action={<Link href="/admin/projects" className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white">Quay lại danh sách</Link>} /></div></div>;
  }

  return (
    <div className="admin-page text-slate-100">
      <div className="mx-auto max-w-7xl space-y-5">
        <ProjectPageHeader
          icon={<Layers className="h-5 w-5" />}
          eyebrow={(
            <Link href="/admin/projects" className="inline-flex items-center gap-1 text-xs font-bold text-slate-400 transition-colors hover:text-white">
              <ArrowLeft className="h-3.5 w-3.5" /> Quay lại danh sách
            </Link>
          )}
          title={projectDetail.name}
          description={<>Mã dự án {projectDetail.projectCode || `#${projectDetail.id}`} · Tạo lúc {formatDateTime(firstDescription.project_created_at)}</>}
          actions={<span className="rounded-full border border-slate-700 px-3 py-1.5 text-xs text-slate-300">{projectDetail.status || 'Chưa có dữ liệu'}</span>}
        />
        <ProjectPanel className="p-4">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-xs text-slate-400">
            <div className="flex min-w-48 flex-1 items-center gap-3">
              <span id="project-progress-label" className="shrink-0 font-bold text-cyan-200">{projectDetail.progressPercent}% hoàn thành</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-800" role="progressbar" aria-labelledby="project-progress-label" aria-valuemin={0} aria-valuemax={100} aria-valuenow={projectDetail.progressPercent}>
                <div className="h-full rounded-full bg-cyan-400" style={{ width: `${projectDetail.progressPercent}%` }} />
              </div>
            </div>
            <span>{completedPhaseCount}/{projectDetail.phases.length} giai đoạn xong</span>
            <span>Hạn tổng: <strong className="text-slate-200">{formatDate(firstDescription.project_deadline)}</strong></span>
            {executionMetrics.blockedTasks > 0 && <span className="text-amber-200">Bị vướng: {executionMetrics.blockedTasks}</span>}
            {executionMetrics.overdueTasks > 0 && <span className="text-red-200">Quá hạn: {executionMetrics.overdueTasks}</span>}
          </div>
        </ProjectPanel>

        <ProjectWorkspaceTabs active={workspaceTab} onChange={setWorkspaceTab} memberCount={memberCount} />

        {isProjectCancelled && (
          <section className="rounded-lg border border-red-900 bg-red-950/25 p-4 text-xs text-red-100">
            Dự án đã hủy. Màn hình này chỉ cho xem dữ liệu hiện có; các thao tác sửa giai đoạn, công việc và thông tin dự án đang bị khóa.
          </section>
        )}

        {workspaceTab === 'work' && taskLoadBlocked && (
          <section data-error-code="task_load_failed" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-900 bg-amber-950/25 p-4 text-xs text-amber-100">
            <span>Nền tảng giao việc chưa sẵn sàng. Dữ liệu công việc cũ vẫn hiển thị ở chế độ chỉ xem; thông tin cốt lõi và giai đoạn vẫn có thể xem.</span>
            <button type="button" onClick={() => void refreshTasks()} className="rounded border border-amber-700 px-3 py-1.5 font-bold">Thử tải lại công việc</button>
          </section>
        )}

        {phaseLoadFailed && (
          <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-900 bg-amber-950/25 p-4 text-xs text-amber-100">
            <span>Không thể tải giai đoạn dự án. Thông tin cốt lõi vẫn hiển thị.</span>
            <button type="button" onClick={() => void refreshPhases()} className="rounded border border-amber-700 px-3 py-1.5 font-bold">Thử tải lại giai đoạn</button>
          </section>
        )}

        {workspaceTab === 'work' && (
          <section role="tabpanel" id="project-panel-work" aria-labelledby="project-tab-work" tabIndex={0} className="grid items-start gap-4 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 lg:grid-cols-[240px_minmax(0,1fr)]">
            <nav aria-label="Giai đoạn dự án" className="min-w-0 rounded-lg border border-slate-800 bg-slate-900 p-3 lg:sticky lg:top-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-sm font-bold">Các giai đoạn</h2>
                <span className="text-xs text-slate-500">{projectDetail.phases.length}</span>
              </div>
              <button type="button" onClick={openCreatePhase} disabled={!projectCapabilities.canManagePhases || isProjectCancelled || phaseLoadFailed} className="mb-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg border border-cyan-800 bg-cyan-950/30 px-3 text-xs font-bold text-cyan-200 disabled:cursor-not-allowed disabled:opacity-40"><Plus className="h-4 w-4" />Thêm giai đoạn</button>
              <div className="flex gap-2 overflow-x-auto lg:flex-col">
                {projectDetail.phases.map((phase, index) => (
                  <button key={phase.item.key} type="button" onClick={() => setSelectedPhaseId(phase.item.phase_id || null)} aria-current={selectedPhase?.item.phase_id === phase.item.phase_id ? 'step' : undefined}
                    className={`flex min-w-40 shrink-0 items-start gap-3 rounded-lg border p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 lg:w-full ${selectedPhase?.item.phase_id === phase.item.phase_id ? 'border-cyan-800 bg-cyan-950/40' : 'border-transparent hover:bg-slate-800'}`}>
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs text-slate-300">
                      {phase.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : phase.status === 'LOCKED' ? <Lock className="h-4 w-4" /> : phase.status === 'BLOCKED' ? <AlertTriangle className="h-4 w-4 text-amber-300" /> : index + 1}
                    </span>
                    <span className="min-w-0"><span className="block break-words text-xs font-bold text-slate-100">{phase.phaseName}</span><span className="mt-1 block text-[11px] text-slate-400">{phaseStatusLabel(phase.status)}</span><span className="mt-1 block text-[11px] text-slate-500">{phase.completedTaskCount}/{phase.taskCount} việc xong</span></span>
                  </button>
                ))}
              </div>
              {projectDetail.phases.length === 0 && <p className="py-3 text-xs text-slate-500">Thêm giai đoạn đầu tiên để bắt đầu.</p>}
            </nav>
            <div className="min-w-0 space-y-4">
            {projectDetail.phases.length === 0 && <OperationalState title="Dự án chưa có giai đoạn." description="Chọn Thêm giai đoạn và nhập tên để bắt đầu." />}
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
                    </div>
                    <button type="button" onClick={() => handleStartCreateTask(selectedPhase)} disabled={!projectCapabilities.canManageTasks || !canCreateTasks || isProjectCancelled || selectedPhase.isLocked || taskLoadBlocked} className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">
                      <Plus className="h-4 w-4" /> Thêm công việc vào giai đoạn
                    </button>
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
                          aria-disabled="true"
                          data-rollout-state={phaseStatusMutationAvailable ? 'READY_FOR_UI_ACTIVATION' : 'BLOCKED_BY_PHASE_WORKFLOW_ROLLOUT'}
                          title={phaseStatusMutationAvailable ? 'API đã sẵn sàng; thao tác giao diện chờ bước kích hoạt sau rollout.' : 'BLOCKED_BY_PHASE_WORKFLOW_ROLLOUT'}
                          className="inline-flex cursor-not-allowed items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[11px] font-bold text-slate-500"
                        >
                          <Lock className="h-3.5 w-3.5" /> Mở khóa giai đoạn
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                <div className="space-y-4 p-4">
                  {editingPhaseId === selectedPhase.item.phase_id && (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_110px_auto]" aria-labelledby="edit-phase-title">
                      <p id="edit-phase-title" className="sr-only">Sửa thông tin giai đoạn đang chọn</p>
                      <div>
                        <label htmlFor="edit-phase-name" className="sr-only">Tên giai đoạn</label>
                        <input id="edit-phase-name" value={editingPhaseName} onChange={(event) => setEditingPhaseName(event.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" />
                      </div>
                      <div>
                        <label htmlFor="edit-phase-order" className="sr-only">Thứ tự giai đoạn</label>
                        <input id="edit-phase-order" type="number" min={0} value={editingPhaseOrder} onChange={(event) => setEditingPhaseOrder(event.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={() => handleSavePhase(selectedPhase)} className="rounded bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Lưu</button>
                        <button type="button" onClick={() => setEditingPhaseId(null)} className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button>
                      </div>
                    </div>
                  )}

                  <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
                    <ProjectDetailField label="Hạn hoàn thành" value={formatDate(selectedPhase.description.stage_deadline || selectedPhase.description.project_deadline)} />
                    <ProjectDetailField label="Công việc hoàn thành" value={`${selectedPhase.completedTaskCount}/${selectedPhase.taskCount}${selectedPhase.overdueTaskCount > 0 ? ` · ${selectedPhase.overdueTaskCount} quá hạn` : ''}`} />
                  </dl>

                  {selectedPhase.item.phase_id && <PhaseMembersSection key={selectedPhase.item.phase_id} projectId={projectId} phaseId={selectedPhase.item.phase_id} members={members} membersReady={!membershipInitialLoading && !memberLoadFailed} canManage={projectCapabilities.canManagePhases && !isProjectCancelled} closed={isProjectCancelled || selectedPhase.status === 'COMPLETED' || selectedPhase.status === 'CANCELLED'} legacyOwner={selectedPhase.description.stage_owner} />}

                  <details key={selectedPhase.item.key} className="rounded-lg border border-slate-800 text-xs">
                    <summary className="cursor-pointer px-3 py-2 font-bold text-slate-400 focus-visible:outline-cyan-300">Chi tiết giai đoạn</summary>
                    <div className="space-y-3 border-t border-slate-800 p-3 text-slate-400">
                      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <TaskMobileField label="Tiến độ" value={`${selectedPhase.progressPercent}%`} />
                        <TaskMobileField label="Hoạt động gần nhất" value={formatDateTime(selectedPhase.lastActivityAt)} />
                        <TaskMobileField label="Thứ tự" value={String(selectedPhase.orderIndex)} />
                        <TaskMobileField label="Ngày tạo" value={formatDateTime(selectedPhase.description.phase_created_at)} />
                      </dl>
                      {(selectedPhase.description.next_action || selectedPhase.description.stage_type) && (
                        <p>{selectedPhase.description.next_action || selectedPhase.description.stage_type}</p>
                      )}
                      {selectedPhase.gateMessage && <p>{selectedPhase.gateMessage}</p>}
                      {!phaseStatusPersistenceAvailable && <p>Chuyển trạng thái giai đoạn đang chờ kích hoạt.</p>}
                    </div>
                  </details>
                  {!canCreateTasks && <p className="text-xs text-slate-500">Chức năng thêm công việc đang chờ kích hoạt.</p>}

                  <div className="overflow-x-auto">
                    {selectedPhase.tasks.length > 0 && (
                    <>
                    <CommonTable className="hidden w-full min-w-[640px] text-left text-xs md:table">
                      <thead className="text-slate-500">
                        <tr className="border-b border-slate-800">
                          <th className="py-2 pr-3">Tên công việc</th>
                          <th className="py-2 pr-3">Người phụ trách</th>
                          <th className="py-2 pr-3">Hạn hoàn thành</th>
                          <th className="py-2 pr-3">Trạng thái</th>
                          <th className="py-2 pr-3">Chi tiết</th>
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
                            <td className="py-3 pr-3 align-top">
                              <details>
                                <summary className="cursor-pointer text-cyan-300 focus-visible:outline-cyan-300">Xem thêm<span className="sr-only">: {getTaskTitle(task)}</span></summary>
                                <dl className="mt-2 space-y-2">
                                  <TaskMobileField label="Ưu tiên" value={getTaskPriorityLabel(task)} />
                                  <TaskMobileField label="Phụ thuộc" value={getTaskDependencyLabel(task)} />
                                  <TaskMobileField label="Cập nhật cuối" value={getTaskLastUpdateLabel(task)} />
                                  <TaskMobileField label="Tiến độ" value={getTaskProgressLabel(task)} />
                                  <TaskMobileField label="Bình luận" value={getTaskCommentLabel(task)} />
                                </dl>
                              </details>
                            </td>
                            <td className="py-3"><TableRowActions renderActions={function renderRowActions() { return <>
                              {isTaskAssignmentDTO(task) && canManageTasks ? (
                                <button type="button" onClick={() => handleStartEditTask(task)} className="rounded border border-slate-700 px-2 py-1 font-bold text-slate-300">
                                  Sửa
                                </button>
                              ) : 'Chỉ xem'}
                            </>; }} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </CommonTable>
                    <div className="space-y-3 md:hidden">
                      {selectedPhase.tasks.map((task) => (
                        <article key={getTaskKey(task)} className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-xs">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="font-bold text-slate-100">{getTaskTitle(task)}</h3>
                            <span className="shrink-0 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300">{taskStatusLabel(getTaskStatusValue(task))}</span>
                          </div>
                          <dl className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <TaskMobileField label="Người phụ trách" value={getTaskAssigneeLabel(task)} />
                            <TaskMobileField label="Hạn hoàn thành" value={getTaskDeadlineLabel(task)} />
                          </dl>
                          <details className="mt-3">
                            <summary className="cursor-pointer text-cyan-300 focus-visible:outline-cyan-300">Chi tiết công việc<span className="sr-only">: {getTaskTitle(task)}</span></summary>
                            <dl className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <TaskMobileField label="Người đóng gói" value={getTaskPackerLabel(task) || 'Chưa gán'} />
                              <TaskMobileField label="Ưu tiên" value={getTaskPriorityLabel(task)} />
                              <TaskMobileField label="Phụ thuộc" value={getTaskDependencyLabel(task)} />
                              <TaskMobileField label="Cập nhật cuối" value={getTaskLastUpdateLabel(task)} />
                              <TaskMobileField label="Tiến độ" value={getTaskProgressLabel(task)} />
                              <TaskMobileField label="Bình luận" value={getTaskCommentLabel(task)} />
                            </dl>
                          </details>
                          {isTaskAssignmentDTO(task) && canManageTasks && (
                            <button type="button" onClick={() => handleStartEditTask(task)} className="mt-3 w-full rounded border border-slate-700 px-2 py-2 font-bold text-slate-300">
                              Sửa
                            </button>
                          )}
                        </article>
                      ))}
                    </div>
                    </>
                    )}
                    {selectedPhase.tasks.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Chưa có công việc trong giai đoạn này.</p>}
                  </div>
                </div>
              </section>
              )}

              {projectDetail.unassignedTasks.length > 0 && (
              <section className="rounded-lg border border-slate-800 bg-slate-900">
                <div className="border-b border-slate-800 px-4 py-3">
                  <h2 className="text-sm font-black text-slate-100">Công việc chưa phân giai đoạn</h2>
                  <p className="text-[11px] text-slate-500">Công việc cũ không có giai đoạn hiện tại khớp an toàn với tên giai đoạn đang dùng.</p>
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
                        <p>Giai đoạn: {isTaskAssignmentDTO(task) ? 'Chưa gán' : task.currentPhaseText || 'Chưa có'}</p>
                        <p>Hạn hoàn thành: {getTaskDeadlineLabel(task)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
              )}
            </div>
          </section>
        )}
        {workspaceTab === 'members' && <section role="tabpanel" id="project-panel-members" aria-labelledby="project-tab-members" tabIndex={0} className="outline-none focus-visible:ring-2 focus-visible:ring-cyan-300">
              <ProjectMembershipSection
                projectId={projectId}
                members={projectDetail.members}
                summary={membershipSummary}
                isInitialLoading={membershipInitialLoading}
                isRefreshing={membershipRefreshing}
                loadFailed={memberLoadFailed}
                canManageMembers={canManageMembers}
                mutationsEnabled={membershipAtomicMutationsEnabled}
                hasManagementPermission={hasMemberManagementPermission}
                memberActionLoading={memberActionLoading}
                onRetry={() => void refreshMembers(projectDetail.members.length === 0)}
                onAddMember={() => void openAddMemberModal()}
                onChangeRole={(member) => void handleChangeRole(member)}
                onRevokeMember={handleRevokeMember}
              />

        </section>}
        {workspaceTab === 'info' && <section role="tabpanel" id="project-panel-info" aria-labelledby="project-tab-info" tabIndex={0} className="grid items-start gap-4 outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 lg:grid-cols-2">

            <ProjectTimelineSection projectId={projectId} cancelled={isProjectCancelled} />
            <details open className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <summary className="cursor-pointer text-sm font-black text-slate-100 focus-visible:outline-cyan-300">Thông tin dự án &amp; tài liệu</summary>
              <dl className="mt-3 grid grid-cols-1 gap-3 text-xs sm:grid-cols-2 xl:grid-cols-1">
                <div>
                  <p className="text-slate-500">Mã dự án</p>
                  <p className="text-slate-100">{projectDetail.projectCode || `#${projectDetail.id}`}</p>
                </div>
                <div>
                  <p className="text-slate-500">Phối màu</p>
                  <p className="text-slate-100">{selectedPhase?.description.colorway_name || selectedPhase?.description.colorway_code || 'Chưa có dữ liệu'}</p>
                </div>
                <div>
                  <p className="text-slate-500">Hạn tổng</p>
                  <p className="text-slate-100">{formatDate(firstDescription.project_deadline)}</p>
                </div>
                <div>
                  <p className="text-slate-500">Hạn gần nhất</p>
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
                  <label htmlFor="project-drive-link" className="sr-only">Link Google Drive của dự án</label>
                  <input id="project-drive-link" disabled={!canManageProject} value={driveLinkInput} onChange={(event) => setDriveLinkInput(event.target.value)} className="w-full rounded border border-slate-800 bg-slate-950 px-3 py-2 text-xs outline-none disabled:cursor-not-allowed disabled:opacity-60" placeholder="Nhập link Drive" />
                  <button type="button" disabled={!canManageProject} onClick={handleSaveDriveLink} className="w-full rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">Lưu thông tin</button>
                </div>
              </dl>
            </details>

            <details open className="rounded-lg border border-slate-800 bg-slate-900 p-4">
              <summary className="cursor-pointer text-sm font-black text-slate-100 focus-visible:outline-cyan-300">Phân bổ công việc thành viên</summary>
              <div className="mt-3 space-y-2 text-xs">
                {executionMetrics.memberWorkload.slice(0, 5).map((workload) => (
                  <div key={workload.employeeId} className="flex items-center justify-between rounded border border-slate-800 bg-slate-950 px-3 py-2">
                    <span className="font-bold text-slate-200">{workload.assigneeFullName}</span>
                    <span className="text-slate-400">{workload.taskCount} việc · {workload.overdueCount} quá hạn</span>
                  </div>
                ))}
                {executionMetrics.memberWorkload.length === 0 && <p className="text-slate-500">Chưa có công việc được giao.</p>}
              </div>
            </details>


          <section className="rounded-lg border border-slate-800 p-4">
            <h2 className="text-sm font-bold">Quản lý dự án</h2>
            <p className="mt-2 text-xs text-slate-500">Hủy sẽ dừng thao tác mới; dữ liệu và lịch sử vẫn được giữ lại.</p>
            <button type="button" disabled={!projectCapabilities.canCancelProject || isProjectCancelled || isCancellingProject} onClick={handleCancelProject} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-lg border border-amber-800 px-3 text-xs font-bold text-amber-200 disabled:opacity-40"><Archive className="h-4 w-4" />Hủy dự án</button>
          </section>
        </section>}
      </div>
        {newPhaseOpen && <ProjectActionDialog titleId="create-phase-title" descriptionId="create-phase-description" busy={phaseSaving} onClose={() => setNewPhaseOpen(false)}>
          <h2 id="create-phase-title" className="pr-8 text-base font-bold">Thêm giai đoạn</h2>
          <p id="create-phase-description" className="mt-1 text-xs text-slate-400">Chỉ cần nhập tên. Giai đoạn sẽ được thêm ở cuối danh sách.</p>
          <form onSubmit={event => { event.preventDefault(); void handleCreatePhase(); }} className="mt-5 space-y-4">
            <div><label htmlFor="new-phase-name" className="mb-2 block text-xs font-bold">Tên giai đoạn</label><input id="new-phase-name" required value={newPhaseName} onChange={event => setNewPhaseName(event.target.value)} disabled={phaseSaving} placeholder="Ví dụ: In thử và kiểm tra" aria-invalid={Boolean(newPhaseError)} aria-describedby={newPhaseError ? 'new-phase-error' : undefined} className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm outline-none focus:border-cyan-500" /></div>
            {newPhaseError && <p id="new-phase-error" role="alert" className="text-xs text-red-300">{newPhaseError}</p>}
            <div className="flex justify-end gap-2"><button type="button" disabled={phaseSaving} onClick={() => setNewPhaseOpen(false)} className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-bold">Hủy</button><button type="submit" disabled={phaseSaving} className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-50">{phaseSaving ? 'Đang thêm…' : 'Thêm giai đoạn'}</button></div>
          </form>
        </ProjectActionDialog>}
        {addMemberOpen && (
          <ProjectActionDialog titleId="add-member-title" descriptionId="add-member-description" busy={memberActionLoading} onClose={() => setAddMemberOpen(false)}>
            <form onSubmit={event => { event.preventDefault(); void handleAddMember(); }}>
              <div className="mb-4">
                <h2 className="text-base font-black text-slate-100" id="add-member-title">Thêm thành viên dự án</h2>
                <p className="text-xs text-slate-500" id="add-member-description">Chọn người và vai trò để tham gia dự án.</p>
              </div>
              <div className="space-y-3">
                <label htmlFor="project-member-employee" className="block text-xs font-bold text-slate-300">Nhân sự</label>
                <select id="project-member-employee" required value={memberEmployeeId} onChange={(event) => setMemberEmployeeId(event.target.value)} disabled={candidatesLoading || memberActionLoading} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                  <option value="">Chọn nhân sự</option>
                  {candidateEmployees.map((employee) => <option key={employee.employeeId} value={employee.employeeId}>{employee.fullName}{employee.title ? ` · ${employee.title}` : ''}</option>)}
                </select>
                {candidateEmployeesLoaded && candidateEmployees.length === 0 && <p className="text-xs text-slate-500">Không còn nhân sự đang hoạt động nào chưa là thành viên đang hoạt động.</p>}
                <label htmlFor="project-member-role" className="block text-xs font-bold text-slate-300">Vai trò dự án</label>
                <select id="project-member-role" value={memberRoleCode} onChange={(event) => setMemberRoleCode(event.target.value as ProjectMemberDTO['roleCode'])} disabled={memberActionLoading} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100">
                  <option value="PROJECT_OWNER">Chủ dự án</option><option value="PROJECT_MANAGER">Quản lý dự án</option><option value="CREATIVE_LEAD">Lead sáng tạo</option><option value="CONTRIBUTOR">Thành viên</option>
                </select>
                <label htmlFor="project-member-add-reason" className="block text-xs font-bold text-slate-300">Lý do tham gia</label>
                <textarea id="project-member-add-reason" value={addMemberReason} onChange={(event) => setAddMemberReason(event.target.value)} required minLength={10} maxLength={500} aria-describedby="add-member-reason-help" aria-invalid={addMemberReason.trim().length < 10} disabled={memberActionLoading} className="min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100" placeholder="Ví dụ: Tham gia thực hiện dự án" />
                <p id="add-member-reason-help" className={`text-xs ${addMemberReason.trim().length < 10 ? 'text-amber-200' : 'text-slate-500'}`}>Lý do cần từ 10 đến 500 ký tự. Đã nhập {addMemberReason.trim().length}/500 ký tự; nội dung này sẽ được lưu vào lịch sử.</p>
                {candidatesLoading && <p className="text-xs text-slate-400" role="status">Đang tải nhân sự…</p>}
                {addMemberError && <p role="alert" className="text-xs text-red-300">{addMemberError}</p>}
              </div>
              <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={memberActionLoading} onClick={() => setAddMemberOpen(false)} className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button><button type="submit" disabled={!memberEmployeeId || memberActionLoading || candidatesLoading} className="min-h-11 rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">{memberActionLoading ? 'Đang lưu...' : 'Thêm thành viên'}</button></div>
            </form>
          </ProjectActionDialog>
        )}

        {memberMutationIntent && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="member-mutation-title" aria-describedby="member-mutation-description">
            <div className="w-full max-w-lg rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <h2 id="member-mutation-title" className="text-base font-black text-slate-100">{memberMutationIntent.action === 'CHANGE_ROLE' ? 'Đổi vai trò thành viên' : 'Thu hồi thành viên'}</h2>
              <p id="member-mutation-description" className="mt-1 text-xs text-slate-500">Thao tác với {memberMutationIntent.member.fullName} sẽ được ghi vào lịch sử kiểm toán.</p>
              <div className="mt-4 space-y-3">
                {memberMutationIntent.action === 'CHANGE_ROLE' && <><label htmlFor="project-member-next-role" className="block text-xs font-bold text-slate-300">Vai trò mới</label><select id="project-member-next-role" value={memberNextRoleCode} onChange={(event) => setMemberNextRoleCode(event.target.value as ProjectMemberDTO['roleCode'])} disabled={memberActionLoading} className="min-h-11 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100"><option value="PROJECT_OWNER">Chủ dự án</option><option value="PROJECT_MANAGER">Quản lý dự án</option><option value="CREATIVE_LEAD">Lead sáng tạo</option><option value="CONTRIBUTOR">Thành viên</option></select></>}
                <label htmlFor="project-member-mutation-reason" className="block text-xs font-bold text-slate-300">Lý do thay đổi</label>
                <textarea id="project-member-mutation-reason" autoFocus value={memberMutationReason} onChange={(event) => setMemberMutationReason(event.target.value)} minLength={10} maxLength={500} disabled={memberActionLoading} className="min-h-24 w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100" placeholder="Nhập ít nhất 10 ký tự." />
              </div>
              <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={memberActionLoading} onClick={() => setMemberMutationIntent(null)} className="min-h-11 rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button><button type="button" disabled={memberMutationReason.trim().length < 10 || memberActionLoading} onClick={handleConfirmMemberMutation} className="min-h-11 rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-slate-800 disabled:text-slate-500">{memberActionLoading ? 'Đang lưu...' : 'Xác nhận'}</button></div>
            </div>
          </div>
        )}

        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="edit-task-title" aria-describedby="edit-task-description">
            <div className="w-full max-w-xl rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <div className="mb-4">
                <h2 className="text-base font-black text-slate-100" id="edit-task-title">Sửa công việc con</h2>
                <p className="text-xs text-slate-500" id="edit-task-description">Người phụ trách phải là thành viên đang hoạt động của dự án.</p>
              </div>
              <div className="space-y-3 text-xs">
                <label htmlFor="edit-task-name" className="block font-bold text-slate-300">Tên công việc</label>
                <input id="edit-task-name" value={editingTask.title} onChange={(event) => setEditingTask({ ...editingTask, title: event.target.value })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                <label htmlFor="edit-task-note" className="block font-bold text-slate-300">Ghi chú</label>
                <textarea id="edit-task-note" value={editingTask.description} onChange={(event) => setEditingTask({ ...editingTask, description: event.target.value })} disabled={taskActionLoading !== null} rows={3} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                <label htmlFor="edit-task-assignee" className="block font-bold text-slate-300">Người phụ trách</label>
                <select id="edit-task-assignee" value={editingTask.assigneeEmployeeId} onChange={(event) => setEditingTask({ ...editingTask, assigneeEmployeeId: event.target.value })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  <option value="">Chưa phân công</option>
                  {activeProjectMembers.map((member) => <option key={member.employeeId} value={member.employeeId}>{member.fullName}{member.title ? ` · ${member.title}` : ''}</option>)}
                </select>
                <label htmlFor="edit-task-deadline" className="block font-bold text-slate-300">Hạn hoàn thành</label>
                <input id="edit-task-deadline" type="date" value={editingTask.deadline} onChange={(event) => setEditingTask({ ...editingTask, deadline: event.target.value })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                <label htmlFor="edit-task-status" className="block font-bold text-slate-300">Trạng thái</label>
                <select id="edit-task-status" value={editingTask.status} onChange={(event) => setEditingTask({ ...editingTask, status: event.target.value as TaskAssignmentStatus })} disabled={taskActionLoading !== null} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100">
                  {TASK_STATUS_OPTIONS.filter((option) => {
                    const currentTask = projectTasks.find((task) => task.taskId === editingTask.taskId);
                    return !currentTask || allowedNextTaskStatuses(currentTask.status).includes(option.value);
                  }).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <label htmlFor="edit-task-comment" className="block font-bold text-slate-300">Bình luận</label>
                <textarea id="edit-task-comment" value={editingTask.comment} onChange={(event) => setEditingTask({ ...editingTask, comment: event.target.value })} disabled={taskActionLoading !== null} rows={4} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 outline-none" placeholder="Nhập bình luận cho công việc" />
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3 text-slate-400" aria-live="polite">
                  {editingTaskIntent && (hasTaskEditChanges(editingTaskIntent) || editingTask.comment.trim())
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

        {creatingTask && selectedPhase && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true" aria-labelledby="create-task-title">
            <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
              <h2 id="create-task-title" className="text-base font-black text-slate-100">Thêm công việc</h2>
              <p className="mt-1 text-xs text-slate-500">Dự án: {projectDetail.name} · Giai đoạn: {selectedPhase.phaseName}</p>
              <div className="mt-4 space-y-3 text-xs">
                <label htmlFor="create-task-name" className="block font-bold text-slate-300">Tên công việc <span className="text-red-300">*</span></label>
                <input id="create-task-name" value={creatingTask.title} onChange={(event) => { setCreatingTask({ ...creatingTask, title: event.target.value }); setTaskTitleError(''); }} aria-invalid={Boolean(taskTitleError)} className={`w-full rounded border bg-slate-950 px-3 py-2 text-slate-100 ${taskTitleError ? 'border-red-500' : 'border-slate-700'}`} />
                {taskTitleError && <p className="text-red-300">{taskTitleError}</p>}
                <label htmlFor="create-task-assignee" className="block font-bold text-slate-300">Người phụ trách</label>
                <select id="create-task-assignee" value={creatingTask.assigneeEmployeeId} onChange={(event) => setCreatingTask({ ...creatingTask, assigneeEmployeeId: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100"><option value="">Chưa phân công</option>{activeProjectMembers.map((member) => <option key={member.employeeId} value={member.employeeId}>{member.fullName}{member.title ? ` · ${member.title}` : ''}</option>)}</select>
                <p className="text-slate-500">Người duyệt chưa được hỗ trợ bởi hợp đồng dữ liệu hiện tại.</p>
                <label htmlFor="create-task-deadline" className="block font-bold text-slate-300">Hạn hoàn thành</label>
                <input id="create-task-deadline" type="date" value={creatingTask.deadline} onChange={(event) => setCreatingTask({ ...creatingTask, deadline: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                <label htmlFor="create-task-note" className="block font-bold text-slate-300">Ghi chú</label>
                <textarea id="create-task-note" rows={3} value={creatingTask.description} onChange={(event) => setCreatingTask({ ...creatingTask, description: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
                <label htmlFor="create-task-comment" className="block font-bold text-slate-300">Bình luận</label>
                <textarea id="create-task-comment" rows={3} value={creatingTask.comment} onChange={(event) => setCreatingTask({ ...creatingTask, comment: event.target.value })} className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100" />
              </div>
              <div className="mt-5 flex justify-end gap-2"><button type="button" disabled={taskActionLoading !== null} onClick={() => setCreatingTask(null)} className="rounded border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button><button type="button" disabled={taskActionLoading !== null} onClick={handleCreateTask} className="rounded bg-cyan-600 px-3 py-2 text-xs font-bold text-white disabled:bg-slate-800">{taskActionLoading !== null ? 'Đang lưu...' : 'Thêm công việc'}</button></div>
            </div>
          </div>
        )}

    </div>
  );
}
