import { NextRequest, NextResponse } from 'next/server';
import type { WorkflowSetting, WorkflowTask } from '@/lib/types/workflow';
import { canTransitionTaskStatus } from '@/services/taskAssignmentFoundation';
import { AuthFlowError, requireWorkspaceAccess } from '@/services/server/auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

type NormalizedTaskStatus =
  | 'BACKLOG'
  | 'READY'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'REVISION_REQUIRED'
  | 'APPROVED'
  | 'BLOCKED'
  | 'ON_HOLD'
  | 'COMPLETED'
  | 'CANCELLED';

type TaskRow = {
  id: number | string;
  project_id: number | string | null;
  phase_id: number | string | null;
  title: string | null;
  description: string | null;
  assignee_employee_id: number | string | null;
  deadline: string | null;
  status: NormalizedTaskStatus | null;
  created_at: string | null;
};

type ProjectRow = {
  id: number | string;
  project_name: string | null;
  project_code: string | null;
  drive_url: string | null;
  project_deadline: string | null;
  status: string | null;
};

type PhaseRow = {
  id: number | string;
  project_id: number | string;
  name: string | null;
  order_index: number | null;
  status: string | null;
};

const UPDATE_KEYS = new Set(['taskId', 'status', 'deadline', 'note']);

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function employeeIdFromAuth(auth: Awaited<ReturnType<typeof requireWorkspaceAccess>>): number {
  const employeeId = Number(auth.employee.id);
  if (!Number.isInteger(employeeId) || employeeId <= 0) {
    throw new AuthFlowError({
      status: 403,
      code: 'employee_not_linked',
      message: 'Không thể xác định hồ sơ nhân sự đang đăng nhập.',
      failureStage: 'employee_lookup',
    });
  }
  return employeeId;
}

function toLegacyStatus(status: NormalizedTaskStatus | null): 'TODO' | 'DOING' | 'DONE' {
  if (status === 'COMPLETED') return 'DONE';
  if (status === 'BACKLOG' || status === 'READY' || status === null) return 'TODO';
  return 'DOING';
}

function requestedNormalizedStatus(value: unknown): NormalizedTaskStatus {
  if (value === 'TODO') return 'READY';
  if (value === 'DOING') return 'IN_PROGRESS';
  if (value === 'DONE') return 'COMPLETED';
  throw new AuthFlowError({
    status: 422,
    code: 'payload_validation_failed',
    message: 'Trạng thái công việc không hợp lệ.',
    failureStage: 'payload_validation',
  });
}

function dateOnly(value: string | null | undefined): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function validatedDeadline(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AuthFlowError({
      status: 422,
      code: 'payload_validation_failed',
      message: 'Hạn chót công việc không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }
  const parsed = new Date(`${value}T23:59:59.999+07:00`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new AuthFlowError({
      status: 422,
      code: 'payload_validation_failed',
      message: 'Hạn chót công việc không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }
  return parsed.toISOString();
}

function safeError(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore({ success: false, code: error.code, message: error.message, failure_stage: error.failureStage }, { status: error.status });
  }
  console.error('[staff-task-boundary]', error instanceof Error ? error.message : 'unknown_error');
  return jsonNoStore({ success: false, code: 'staff_task_failed', message: 'Không thể xử lý công việc. Vui lòng thử lại.' }, { status: 500 });
}

async function loadAssignedWorkflow(employeeId: number, employeeName: string): Promise<WorkflowSetting[]> {
  const supabase = createSupabaseAdminClient();
  const taskResult = await supabase
    .from('tasks')
    .select('id, project_id, phase_id, title, description, assignee_employee_id, deadline, status, created_at')
    .eq('assignee_employee_id', employeeId)
    .not('project_id', 'is', null)
    .order('created_at', { ascending: false });

  if (taskResult.error) throw new Error(`task_list:${taskResult.error.code ?? 'unknown'}`);
  const taskRows = (taskResult.data || []) as TaskRow[];
  if (taskRows.length === 0) return [];

  const projectIds = [...new Set(taskRows.map((task) => Number(task.project_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const membershipResult = await supabase
    .from('project_members')
    .select('project_id')
    .eq('employee_id', employeeId)
    .eq('status', 'ACTIVE')
    .in('project_id', projectIds);
  if (membershipResult.error) throw new Error(`membership_list:${membershipResult.error.code ?? 'unknown'}`);

  const allowedProjectIds = new Set((membershipResult.data || []).map((row) => Number(row.project_id)));
  const scopedTasks = taskRows.filter((task) => allowedProjectIds.has(Number(task.project_id)));
  if (scopedTasks.length === 0) return [];

  const scopedProjectIds = [...new Set(scopedTasks.map((task) => Number(task.project_id)))];
  const phaseIds = [...new Set(scopedTasks.map((task) => Number(task.phase_id)).filter((id) => Number.isInteger(id) && id > 0))];
  const [projectsResult, phasesResult] = await Promise.all([
    supabase.from('projects').select('id, project_name, project_code, drive_url, project_deadline, status').in('id', scopedProjectIds),
    phaseIds.length > 0
      ? supabase.from('phases').select('id, project_id, name, order_index, status').in('id', phaseIds)
      : Promise.resolve({ data: [] as PhaseRow[], error: null }),
  ]);
  if (projectsResult.error) throw new Error(`project_list:${projectsResult.error.code ?? 'unknown'}`);
  if (phasesResult.error) throw new Error(`phase_list:${phasesResult.error.code ?? 'unknown'}`);

  const projects = new Map(((projectsResult.data || []) as ProjectRow[]).map((project) => [Number(project.id), project]));
  const phases = new Map(((phasesResult.data || []) as PhaseRow[]).map((phase) => [Number(phase.id), phase]));
  const grouped = new Map<string, { project: ProjectRow; phase: PhaseRow | null; tasks: WorkflowTask[] }>();

  scopedTasks.forEach((task) => {
    const project = projects.get(Number(task.project_id));
    if (!project || String(project.status || '').toUpperCase() === 'CANCELLED') return;
    const phase = task.phase_id ? phases.get(Number(task.phase_id)) || null : null;
    if (phase && Number(phase.project_id) !== Number(project.id)) return;
    const groupKey = `${project.id}:${phase?.id ?? 'unassigned'}`;
    const group = grouped.get(groupKey) || { project, phase, tasks: [] };
    group.tasks.push({
      id: Number(task.id),
      phase_id: phase ? Number(phase.id) : null,
      name: task.title || `Công việc #${task.id}`,
      projectName: project.project_name,
      assignee: employeeName,
      assignee_name: employeeName,
      assignee_id: employeeId,
      assignedToText: employeeName,
      currentPhaseText: phase?.name || 'Chưa xếp giai đoạn',
      status: toLegacyStatus(task.status),
      deadline: dateOnly(task.deadline),
      estimationDate: dateOnly(task.deadline),
      note: '',
      createdAt: task.created_at,
    });
    grouped.set(groupKey, group);
  });

  return [...grouped.values()]
    .sort((left, right) => {
      const projectCompare = String(left.project.project_name || '').localeCompare(String(right.project.project_name || ''), 'vi');
      if (projectCompare !== 0) return projectCompare;
      return Number(left.phase?.order_index ?? Number.MAX_SAFE_INTEGER) - Number(right.phase?.order_index ?? Number.MAX_SAFE_INTEGER);
    })
    .map(({ project, phase, tasks }) => ({
      id: `staff-${project.id}-${phase?.id ?? 'unassigned'}`,
      key: `STAFF_PROJECT_${project.id}_PHASE_${phase?.id ?? 'UNASSIGNED'}`,
      project_id: Number(project.id),
      phase_id: phase ? Number(phase.id) : undefined,
      value: phase?.status || project.status,
      group_name: 'STAFF_ASSIGNED_TASKS',
      config_name: `${project.project_name || project.project_code || `Dự án #${project.id}`} - ${phase?.name || 'Chưa xếp giai đoạn'}`,
      param_type: project.project_deadline || '',
      description: JSON.stringify({
        project_drive_link: project.drive_url || '',
        project_deadline: project.project_deadline || '',
        project_status: project.status || null,
        phase_order_index: phase?.order_index ?? null,
        stage_name: phase?.name || 'Chưa xếp giai đoạn',
        tasks_list: tasks,
      }),
    }));
}

export async function GET() {
  try {
    const auth = await requireWorkspaceAccess('STAFF_WORKSPACE');
    const employeeId = employeeIdFromAuth(auth);
    const workflowItems = await loadAssignedWorkflow(employeeId, auth.employee.full_name || 'Nhân sự');
    return jsonNoStore({ success: true, workerId: employeeId, workerName: auth.employee.full_name || '', workflowItems });
  } catch (error) {
    return safeError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireWorkspaceAccess('STAFF_WORKSPACE');
    const employeeId = employeeIdFromAuth(auth);
    const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) throw new AuthFlowError({ status: 422, code: 'payload_validation_failed', message: 'Dữ liệu cập nhật không hợp lệ.', failureStage: 'payload_validation' });
    const unknown = Object.keys(body).filter((key) => !UPDATE_KEYS.has(key));
    if (unknown.length > 0) throw new AuthFlowError({ status: 422, code: 'payload_validation_failed', message: 'Dữ liệu cập nhật có trường không được hỗ trợ.', failureStage: 'payload_validation' });

    const taskId = Number(body.taskId);
    if (!Number.isInteger(taskId) || taskId <= 0) throw new AuthFlowError({ status: 422, code: 'payload_validation_failed', message: 'Mã công việc không hợp lệ.', failureStage: 'payload_validation' });
    const note = typeof body.note === 'string' ? body.note.trim() : '';
    if (!note) throw new AuthFlowError({ status: 422, code: 'payload_validation_failed', message: 'Vui lòng nhập nội dung báo cáo tiến độ.', failureStage: 'payload_validation' });

    const supabase = createSupabaseAdminClient();
    const taskResult = await supabase
      .from('tasks')
      .select('id, project_id, phase_id, title, assignee_employee_id, deadline, status')
      .eq('id', taskId)
      .eq('assignee_employee_id', employeeId)
      .maybeSingle();
    if (taskResult.error) throw new Error(`task_load:${taskResult.error.code ?? 'unknown'}`);
    const task = taskResult.data as TaskRow | null;
    if (!task?.project_id) throw new AuthFlowError({ status: 404, code: 'permission_forbidden', message: 'Không tìm thấy công việc được giao cho bạn.', failureStage: 'permission_check' });

    const [membershipResult, projectResult] = await Promise.all([
      supabase.from('project_members').select('id').eq('project_id', task.project_id).eq('employee_id', employeeId).eq('status', 'ACTIVE').limit(1),
      supabase.from('projects').select('status').eq('id', task.project_id).maybeSingle(),
    ]);
    if (membershipResult.error) throw new Error(`membership_check:${membershipResult.error.code ?? 'unknown'}`);
    if (projectResult.error) throw new Error(`project_check:${projectResult.error.code ?? 'unknown'}`);
    if (!membershipResult.data?.length) throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn không còn là thành viên hoạt động của dự án này.', failureStage: 'permission_check' });
    if (String(projectResult.data?.status || '').toUpperCase() === 'CANCELLED') throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Dự án đã hủy nên không thể cập nhật công việc.', failureStage: 'payload_validation' });

    const currentStatus = task.status || 'READY';
    const requestedStatus = requestedNormalizedStatus(body.status);
    const updatePayload: Record<string, unknown> = { updated_by_employee_id: employeeId, updated_at: new Date().toISOString() };
    if (toLegacyStatus(currentStatus) !== body.status) {
      if (!canTransitionTaskStatus(currentStatus, requestedStatus)) {
        throw new AuthFlowError({ status: 422, code: 'payload_validation_failed', message: 'Chuyển trạng thái công việc không hợp lệ.', failureStage: 'payload_validation' });
      }
      updatePayload.status = requestedStatus;
      if (requestedStatus === 'COMPLETED') updatePayload.completed_at = new Date().toISOString();
    }

    const nextDeadline = validatedDeadline(body.deadline);
    if (dateOnly(task.deadline) !== dateOnly(nextDeadline)) updatePayload.deadline = nextDeadline;

    if (Object.keys(updatePayload).length > 2) {
      const updateResult = await supabase.from('tasks').update(updatePayload).eq('id', taskId).eq('assignee_employee_id', employeeId);
      if (updateResult.error) throw new Error(`task_update:${updateResult.error.code ?? 'unknown'}`);
    }

    const commentResult = await supabase.from('task_comments').insert([{ project_id: Number(task.project_id), task_id: taskId, employee_id: employeeId, body: note }]);
    if (commentResult.error) throw new Error(`task_comment:${commentResult.error.code ?? 'unknown'}`);

    return jsonNoStore({
      success: true,
      task: {
        taskId,
        status: toLegacyStatus((updatePayload.status as NormalizedTaskStatus | undefined) || currentStatus),
        deadline: body.deadline === null ? '' : String(body.deadline || dateOnly(task.deadline)),
      },
    });
  } catch (error) {
    return safeError(error);
  }
}
