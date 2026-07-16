import { supabase } from '@/utils/supabase/client';
import type {
  WorkflowPhase,
  WorkflowProject,
  WorkflowTask,
} from '@/lib/types/workflow';

type GenericRow = Record<string, unknown>;
type LegacyWorkflowTask = WorkflowTask & {
  project_name?: string;
  current_phase?: string;
};

export class WorkflowRequestError extends Error {
  status: number;
  code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'WorkflowRequestError';
    this.status = status;
    this.code = code;
  }
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function pickFirstText(row: GenericRow, keys: string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return '';
}

function pickFirstNumber(row: GenericRow, keys: string[]): number | null {
  for (const key of keys) {
    const value = toNumber(row[key]);
    if (value !== null) return value;
  }
  return null;
}

function assertKnownFields(row: GenericRow, allowedFields: readonly string[], context: string): void {
  const allowed = new Set(allowedFields);
  const unknownFields = Object.keys(row).filter((key) => !allowed.has(key));

  if (unknownFields.length > 0) {
    throw new Error(`${context}: unknown fields ${unknownFields.join(', ')}`);
  }
}

export function normalizeProjectRow(row: GenericRow): WorkflowProject | null {
  const id = pickFirstNumber(row, ['id']);
  if (id === null) return null;

  return {
    id,
    name: pickFirstText(row, ['name', 'project_name', 'title']) || `Project ${id}`,
    status: pickFirstText(row, ['status']) || null,
    created_at: pickFirstText(row, ['created_at']) || null,
    project_deadline: pickFirstText(row, ['project_deadline', 'deadline', 'due_date']) || null,
    drive_link: pickFirstText(row, ['drive_url', 'drive_link', 'project_drive_link', 'google_drive_link']) || null,
  };
}

export function normalizePhaseRow(row: GenericRow): WorkflowPhase | null {
  assertKnownFields(row, ['id', 'project_id', 'name', 'order_index', 'created_at'], 'phase_row');

  const id = pickFirstNumber(row, ['id']);
  const projectId = pickFirstNumber(row, ['project_id']);
  if (id === null || projectId === null) return null;

  return {
    id,
    project_id: projectId,
    name: pickFirstText(row, ['name']) || `Giai doan ${id}`,
    order_index: pickFirstNumber(row, ['order_index']) ?? 0,
    created_at: pickFirstText(row, ['created_at']) || null,
    status: null,
    colorway_name: null,
    colorway_code: null,
    stage_type: null,
    stage_owner: null,
    planned_start_date: null,
    planned_end_date: null,
    actual_start_date: null,
    actual_end_date: null,
    progress: null,
    next_action: null,
    required_review: null,
  };
}

export function normalizeTaskRow(row: GenericRow): WorkflowTask | null {
  const id = pickFirstNumber(row, ['id']);
  if (id === null) return null;

  const assignedToText = pickFirstText(row, ['assigned_to']);
  const packerAssignedText = pickFirstText(row, ['packer_assigned']);
  const currentPhaseText = pickFirstText(row, ['current_phase']);
  const estimationDate = pickFirstText(row, ['estimation_date']) || null;
  const issueNote = pickFirstText(row, ['issue_note']) || null;
  const createdAt = pickFirstText(row, ['created_at']) || null;
  const projectName = pickFirstText(row, ['project_name']) || null;
  const assigneeName = assignedToText || packerAssignedText;

  return {
    id,
    phase_id: null,
    name: projectName || '',
    projectName,
    assignee_id: null,
    assignee_name: assigneeName,
    assignee: assigneeName,
    assignedToText,
    packerAssignedText,
    currentPhaseText,
    estimationDate,
    issueNote,
    createdAt,
    deadline: estimationDate || '',
    note: issueNote || '',
    status: currentPhaseText || 'TODO',
  };
}

export function normalizeLegacyTaskRow(row: GenericRow): WorkflowTask | null {
  const id = pickFirstNumber(row, ['id']);
  if (id === null) return null;

  const assignedToText = pickFirstText(row, ['assigned_to']);
  const packerAssignedText = pickFirstText(row, ['packer_assigned']);
  const currentPhaseText = pickFirstText(row, ['current_phase']);
  const estimationDate = pickFirstText(row, ['estimation_date']) || null;
  const issueNote = pickFirstText(row, ['issue_note']) || null;
  const createdAt = pickFirstText(row, ['created_at']) || null;
  const projectName = pickFirstText(row, ['project_name']) || null;
  const assigneeName = assignedToText || packerAssignedText;

  return {
    id,
    phase_id: null,
    name: projectName || `Task ${id}`,
    projectName,
    assignee_id: null,
    assignee_name: assigneeName,
    assignee: assigneeName,
    assignedToText,
    packerAssignedText,
    currentPhaseText,
    estimationDate,
    issueNote,
    createdAt,
    deadline: estimationDate || '',
    note: issueNote || '',
    status: currentPhaseText || 'TODO',
  };
}

async function tryUpdateById(
  table: 'phases' | 'tasks',
  id: number,
  payloads: GenericRow[]
): Promise<void> {
  let lastError: Error | null = null;

  for (const payload of payloads) {
    const { error } = await supabase.from(table).update(payload).eq('id', id);
    if (!error) return;
    lastError = error;
  }

  throw lastError || new Error(`Khong cap nhat duoc bang ${table}.`);
}

async function requestProjectMutation<TResponse>(
  path: string,
  init: RequestInit
): Promise<TResponse> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const payload = (await response.json().catch(() => null)) as TResponse | {
    message?: string;
    code?: string;
  } | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : null;

    const code =
      payload &&
      typeof payload === 'object' &&
      'code' in payload &&
      typeof payload.code === 'string'
        ? payload.code
        : undefined;

    throw new WorkflowRequestError(
      message || 'Khong the cap nhat du an.',
      response.status,
      code
    );
  }

  return payload as TResponse;
}

export class WorkflowRepository {
  async listProjects(): Promise<WorkflowProject[]> {
    const { data, error } = await supabase.from('projects').select('id, project_name, drive_url, status, created_at')
      .order('id', { ascending: false });
    if (error) throw error;

    return (data || [])
      .map((row) => normalizeProjectRow(row as GenericRow))
      .filter((row): row is WorkflowProject => row !== null);
  }

  async listPhasesByProjectIds(projectIds: number[]): Promise<WorkflowPhase[]> {
    if (projectIds.length === 0) return [];

    const result = await requestProjectMutation<{ phases: GenericRow[] }>(
      '/api/admin/phases',
      {
        method: 'POST',
        body: JSON.stringify({ projectIds }),
      }
    );

    return (result.phases || [])
      .map((row) => normalizePhaseRow(row as GenericRow))
      .filter((row): row is WorkflowPhase => row !== null);
  }

  async listTasksByPhaseIds(phaseIds: number[]): Promise<WorkflowTask[]> {
    void phaseIds;
    return [];
  }

  async listLegacyTasks(): Promise<LegacyWorkflowTask[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, project_name, assigned_to, current_phase, estimation_date, issue_note, packer_assigned, created_at')
      .order('id', { ascending: true });

    if (error) throw error;

    const tasks: LegacyWorkflowTask[] = [];

    for (const row of data || []) {
      const task = normalizeLegacyTaskRow(row as GenericRow);
      if (!task) continue;

      tasks.push({
        ...task,
        project_name: task.projectName || '',
        current_phase: task.currentPhaseText || '',
      });
    }

    return tasks;
  }

  async insertProject(params: {
    projectName: string;
    projectDeadline: string;
  }): Promise<number> {
    const result = await requestProjectMutation<{ projectId: number }>(
      '/api/admin/projects',
      {
        method: 'POST',
        body: JSON.stringify({
          projectName: params.projectName.trim(),
          targetDate: params.projectDeadline,
          status: 'PROCESSING',
        }),
      }
    );

    return result.projectId;
  }

  async insertPhase(params: {
    projectId: number;
    phaseName: string;
    orderIndex: number;
  }): Promise<number> {
    const result = await requestProjectMutation<{ phaseId: number }>(
      `/api/admin/projects/${params.projectId}/phases`,
      {
        method: 'POST',
        body: JSON.stringify({
          phaseName: params.phaseName,
          orderIndex: params.orderIndex,
        }),
      }
    );

    return result.phaseId;
  }

  async updatePhase(params: {
    projectId: number;
    phaseId: number;
    phaseName?: string;
    orderIndex?: number;
  }): Promise<void> {
    await requestProjectMutation(
      `/api/admin/projects/${params.projectId}/phases/${params.phaseId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          ...(params.phaseName !== undefined ? { phaseName: params.phaseName } : {}),
          ...(params.orderIndex !== undefined ? { orderIndex: params.orderIndex } : {}),
        }),
      }
    );
  }

  async insertTasks(tasks: GenericRow[]): Promise<void> {
    if (tasks.length === 0) return;

    const legacyTasks = tasks
      .map((task) => ({
        project_name: pickFirstText(task, ['project_name']),
        assigned_to: pickFirstText(task, ['assigned_to', 'assignee_name', 'assignee']),
        current_phase: pickFirstText(task, ['current_phase', 'status']) || 'IN_PROG',
        estimation_date: pickFirstText(task, ['estimation_date', 'deadline']) || null,
        issue_note: pickFirstText(task, ['issue_note', 'note']) || null,
        packer_assigned: pickFirstText(task, ['packer_assigned']) || null,
      }))
      .filter((task) => task.project_name && task.assigned_to);

    if (legacyTasks.length === 0) return;

    const { error } = await supabase.from('tasks').insert(legacyTasks);
    if (error) throw error;
  }

  async updatePhaseStatus(phaseId: number, status: string): Promise<void> {
    if (!Number.isFinite(phaseId) || !status) {
      throw new Error('Thong tin giai doan khong hop le.');
    }
  }

  async updateProjectDriveLink(projectId: number, driveLink: string): Promise<void> {
    await requestProjectMutation(`/api/admin/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify({ driveLink }),
    });
  }

  async updateTaskField(params: {
    taskId: number;
    field: 'assignee' | 'deadline' | 'note' | 'status' | 'assignee_id' | 'assignee_name';
    value: string | number | null;
  }): Promise<void> {
    const payloadsByField: Record<string, GenericRow[]> = {
      assignee: [{ assigned_to: params.value || '' }],
      assignee_id: [],
      assignee_name: [{ assigned_to: params.value || '' }],
      deadline: [{ estimation_date: params.value || null }],
      note: [{ issue_note: params.value || null }],
      status: [{ current_phase: params.value || 'IN_PROG' }],
    };

    const payloads = payloadsByField[params.field] || [{ [params.field]: params.value }];
    if (payloads.length === 0) return;

    await tryUpdateById('tasks', params.taskId, payloads);
  }

  async updateTask(params: {
    taskId: number;
    status: string;
    deadline: string;
    note: string;
  }): Promise<void> {
    await tryUpdateById('tasks', params.taskId, [
      {
        current_phase: params.status || 'IN_PROG',
        estimation_date: params.deadline || null,
        issue_note: params.note,
      },
    ]);
  }

  async deleteProject(projectId: number): Promise<void> {
    await requestProjectMutation(`/api/admin/projects/${projectId}/archive`, {
      method: 'POST',
    });
  }
}

export const workflowRepository = new WorkflowRepository();
