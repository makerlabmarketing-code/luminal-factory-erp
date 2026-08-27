import { NextRequest, NextResponse } from 'next/server';
import type { TaskAssignmentDTO } from '@/lib/types/task-assignment';
import { createProjectTask, listProjectTasks, taskAssignmentErrorResponse } from '@/services/server/taskAssignmentFoundation';
import { requireProjectMembershipAction } from '@/services/server/projectMembershipAuthorization';
import { parseTaskAssignmentProjectId } from '@/services/taskAssignmentFoundation';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function taskProgressPercent(status: TaskAssignmentDTO['status']): number {
  const progressByStatus: Record<TaskAssignmentDTO['status'], number> = {
    BACKLOG: 0,
    READY: 10,
    IN_PROGRESS: 50,
    PENDING_REVIEW: 80,
    REVISION_REQUIRED: 60,
    APPROVED: 90,
    BLOCKED: 40,
    ON_HOLD: 30,
    COMPLETED: 100,
    CANCELLED: 0,
  };
  return progressByStatus[status] ?? 0;
}

async function listProjectTasksReadOnly(rawProjectId: string) {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const auth = await requireProjectMembershipAction(projectId, 'PROJECT_VIEW');
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from('tasks')
    .select('id, project_id, phase_id, parent_task_id, title, description, assignee_employee_id, deadline, status, assignee:assignee_employee_id!tasks_assignee_employee_id_fkey(full_name)')
    .eq('project_id', projectId);

  if (!auth.capabilities.canManageTasks) query = query.eq('assignee_employee_id', auth.actorEmployeeId);
  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw new Error('task_assignment_readonly_load_failed');

  const rows = (data || []) as unknown as Array<{
    id: number;
    project_id: number | null;
    phase_id: number | null;
    parent_task_id: number | null;
    title: string | null;
    description: string | null;
    assignee_employee_id: number | null;
    deadline: string | null;
    status: TaskAssignmentDTO['status'] | null;
    assignee?: { full_name?: string | null } | null;
  }>;
  const taskIds = rows.map((row) => Number(row.id));
  const commentCounts = new Map<number, number>();
  const lastActivity = new Map<number, string>();

  if (taskIds.length > 0) {
    const [{ data: comments, error: commentError }, { data: activity, error: activityError }] = await Promise.all([
      supabase.from('task_comments').select('task_id').in('task_id', taskIds),
      supabase.from('project_activity').select('task_id, created_at').in('task_id', taskIds),
    ]);
    if (commentError || activityError) throw new Error('task_assignment_readonly_history_failed');

    (comments || []).forEach((comment) => {
      if (!comment.task_id) return;
      const taskId = Number(comment.task_id);
      commentCounts.set(taskId, (commentCounts.get(taskId) || 0) + 1);
    });
    (activity || []).forEach((entry) => {
      if (!entry.task_id || !entry.created_at) return;
      const taskId = Number(entry.task_id);
      const current = lastActivity.get(taskId);
      if (!current || entry.created_at > current) lastActivity.set(taskId, entry.created_at);
    });
  }

  const tasks = rows.map((row): TaskAssignmentDTO => {
    if (!row.project_id || !row.title || !row.status) throw new Error('task_assignment_readonly_schema_invalid');
    return {
      taskId: Number(row.id),
      projectId: Number(row.project_id),
      phaseId: row.phase_id === null ? null : Number(row.phase_id),
      parentTaskId: row.parent_task_id === null ? null : Number(row.parent_task_id),
      title: row.title,
      description: row.description ?? null,
      assigneeEmployeeId: row.assignee_employee_id === null ? null : Number(row.assignee_employee_id),
      assigneeFullName: row.assignee?.full_name ?? null,
      deadline: row.deadline ?? null,
      status: row.status,
      progressPercent: taskProgressPercent(row.status),
      commentCount: commentCounts.get(Number(row.id)) ?? 0,
      lastActivityAt: lastActivity.get(Number(row.id)) ?? null,
    };
  });

  return { success: true as const, tasks, capabilities: { canCreateTasks: false as const } };
}

export async function GET(_request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    return jsonNoStore(await listProjectTasks(params.projectId));
  } catch (error) {
    const mapped = taskAssignmentErrorResponse(error);
    if (mapped.status === 409 && mapped.body.code === 'task_assignment_migration_required') {
      try {
        return jsonNoStore(await listProjectTasksReadOnly(params.projectId));
      } catch (readError) {
        const readMapped = taskAssignmentErrorResponse(readError);
        return jsonNoStore(readMapped.body, { status: readMapped.status });
      }
    }
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}

export async function POST(request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    const body = (await request.json().catch(() => null)) || {};
    return jsonNoStore(await createProjectTask(params.projectId, body), { status: 201 });
  } catch (error) {
    const mapped = taskAssignmentErrorResponse(error);
    return jsonNoStore(mapped.body, { status: mapped.status });
  }
}
