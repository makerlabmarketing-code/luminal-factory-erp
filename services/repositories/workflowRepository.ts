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
    project_deadline: pickFirstText(row, ['project_deadline', 'deadline', 'due_date']) || null,
    drive_link: pickFirstText(row, ['drive_link', 'project_drive_link', 'google_drive_link']) || null,
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
  const phaseId = pickFirstNumber(row, ['phase_id']);
  if (id === null || phaseId === null) return null;

  const assigneeId = pickFirstNumber(row, ['assignee_id']);
  const assigneeName = pickFirstText(row, ['assignee_name', 'employee_name', 'assignee', 'assigned_to']);

  return {
    id,
    phase_id: phaseId,
    name: pickFirstText(row, ['name', 'task_name', 'title']),
    assignee_id: assigneeId,
    assignee_name: assigneeName,
    assignee: assigneeName || (assigneeId !== null ? String(assigneeId) : ''),
    deadline: pickFirstText(row, ['deadline', 'due_date']),
    note: pickFirstText(row, ['note', 'description', 'remarks']),
    status: pickFirstText(row, ['status', 'task_status', 'value']) || 'TODO',
  };
}

export function normalizeLegacyTaskRow(row: GenericRow): WorkflowTask | null {
  const id = pickFirstNumber(row, ['id']);
  if (id === null) return null;

  const assignedToText = pickFirstText(row, ['assigned_to']);
  const packerAssignedText = pickFirstText(row, ['packer_assigned']);
  const assigneeName = assignedToText || packerAssignedText;

  return {
    id,
    phase_id: null,
    name: pickFirstText(row, ['task_name', 'name', 'project_name']) || `Task ${id}`,
    assignee_id: null,
    assignee_name: assigneeName,
    assignee: assigneeName,
    deadline: pickFirstText(row, ['estimation_date', 'deadline', 'due_date']),
    note: pickFirstText(row, ['issue_note', 'note', 'description', 'remarks']),
    status: pickFirstText(row, ['current_phase', 'status', 'task_status', 'value']) || 'TODO',
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
  } | null;

  if (!response.ok) {
    const message =
      payload &&
      typeof payload === 'object' &&
      'message' in payload &&
      typeof payload.message === 'string'
        ? payload.message
        : null;

    throw new Error(
      message || 'Khong the cap nhat du an.'
    );
  }

  return payload as TResponse;
}

export class WorkflowRepository {
  async listProjects(): Promise<WorkflowProject[]> {
    const { data, error } = await supabase.from('projects').select('*').order('id', { ascending: false });
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
    if (phaseIds.length === 0) return [];

    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .in('phase_id', phaseIds)
      .order('id', { ascending: true });

    if (error) throw error;

    return (data || [])
      .map((row) => normalizeTaskRow(row as GenericRow))
      .filter((row): row is WorkflowTask => row !== null);
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
        project_name: pickFirstText(row as GenericRow, ['project_name']),
        current_phase: pickFirstText(row as GenericRow, ['current_phase']),
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

  async insertTasks(tasks: GenericRow[]): Promise<void> {
    if (tasks.length === 0) return;

    const { error } = await supabase.from('tasks').insert(tasks);
    if (!error) return;

    const fallbackTasks = tasks.map((task) => ({
      phase_id: task.phase_id,
      task_name: task.name,
      assignee_id: task.assignee_id,
      assignee_name: task.assignee_name,
      due_date: task.deadline,
      description: task.note,
      task_status: task.status,
    }));

    const { error: fallbackError } = await supabase.from('tasks').insert(fallbackTasks);
    if (fallbackError) throw fallbackError;
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
      assignee: [{ assignee: params.value }, { assignee_name: params.value }],
      assignee_id: [{ assignee_id: params.value }],
      assignee_name: [{ assignee_name: params.value }, { assignee: params.value }, { employee_name: params.value }],
      deadline: [{ deadline: params.value }, { due_date: params.value }],
      note: [{ note: params.value }, { description: params.value }, { remarks: params.value }],
      status: [{ status: params.value }, { task_status: params.value }, { value: params.value }],
    };

    await tryUpdateById('tasks', params.taskId, payloadsByField[params.field] || [{ [params.field]: params.value }]);
  }

  async updateTask(params: {
    taskId: number;
    status: string;
    deadline: string;
    note: string;
  }): Promise<void> {
    await tryUpdateById('tasks', params.taskId, [
      {
        status: params.status,
        deadline: params.deadline || null,
        note: params.note,
      },
      {
        task_status: params.status,
        due_date: params.deadline || null,
        description: params.note,
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
