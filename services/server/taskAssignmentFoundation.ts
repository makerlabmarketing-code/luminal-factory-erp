import "server-only";

import type {
  TaskAssignmentAssignPayload,
  TaskAssignmentCreatePayload,
  TaskAssignmentDTO,
  TaskAssignmentStatusPayload,
  TaskAssignmentUpdatePayload,
} from "@/lib/types/task-assignment";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { AuthFlowError } from "@/services/server/auth";
import { requireProjectMembershipAction } from "@/services/server/projectMembershipAuthorization";
import {
  parseTaskAssignmentProjectId,
  parseTaskAssignmentTaskId,
  TaskAssignmentValidationError,
  validateTaskAssignmentAssignPayload,
  validateTaskAssignmentCreatePayload,
  validateTaskAssignmentStatusPayload,
  validateTaskAssignmentUpdatePayload,
  canTransitionTaskStatus,
} from "@/services/taskAssignmentFoundation";

type TaskRow = {
  id: number;
  project_id: number | null;
  phase_id: number | null;
  parent_task_id: number | null;
  title: string | null;
  description: string | null;
  assignee_employee_id: number | null;
  deadline: string | null;
  status: TaskAssignmentDTO["status"] | null;
  created_at?: string | null;
  updated_at?: string | null;
  assignee?: { full_name?: string | null } | null;
};

type TaskCommentRow = { task_id: number | null };
type TaskActivityRow = { task_id: number | null; created_at: string | null };

type MutationContext = {
  actorEmployeeId: number;
};

type ListContext = MutationContext & {
  canManageTasks: boolean;
};

function taskAssignmentError(
  status: number,
  message: string,
  code: string,
  failureStage = "unknown",
  safeDetails?: Record<string, boolean | number | string | null>,
) {
  return new AuthFlowError({
    status,
    message,
    code: code as AuthFlowError["code"],
    failureStage: failureStage as AuthFlowError["failureStage"],
    safeDetails,
  });
}

function assertTaskAssignmentFeatureEnabled() {
  if (process.env.TASK_ASSIGNMENT_FOUNDATION_ENABLED !== "true") {
    throw taskAssignmentError(
      409,
      "Task Assignment Foundation cần duyệt migration trước khi bật thao tác.",
      "task_assignment_migration_required",
      "migration_gate",
    );
  }
}

function mapSupabaseError(
  message: string,
  code: string,
  errorCode?: string | null,
): never {
  throw taskAssignmentError(500, message, code, "supabase_query", {
    supabase_error_code: errorCode ?? "unknown",
  });
}

function mapValidationError(
  error: TaskAssignmentValidationError,
): AuthFlowError {
  return new AuthFlowError({
    status: 422,
    code: "payload_validation_failed",
    message: error.issues[0]?.message || "Dữ liệu công việc không hợp lệ.",
    failureStage: "payload_validation",
    safeDetails: {
      issue_count: error.issues.length,
      field: error.issues[0]?.field || "payload",
    },
  });
}

export function taskAssignmentErrorResponse(error: unknown): {
  status: number;
  body: Record<string, unknown>;
} {
  if (error instanceof TaskAssignmentValidationError) {
    const mapped = mapValidationError(error);
    return taskAssignmentErrorResponse(mapped);
  }

  if (error instanceof AuthFlowError) {
    return {
      status: error.status,
      body: {
        success: false,
        message: error.message,
        code: error.code,
        failure_stage: error.failureStage,
        safe_details: error.safeDetails,
      },
    };
  }

  return {
    status: 500,
    body: {
      success: false,
      message: "Không thể xử lý công việc dự án.",
      code: "task_assignment_failed",
      failure_stage: "unknown",
    },
  };
}

function taskProgressPercent(status: TaskAssignmentDTO["status"]): number {
  const progressByStatus: Record<TaskAssignmentDTO["status"], number> = {
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

function mapTask(
  row: TaskRow,
  commentCounts = new Map<number, number>(),
  lastActivity = new Map<number, string | null>(),
): TaskAssignmentDTO {
  if (!row.project_id || !row.title || !row.status) {
    throw taskAssignmentError(
      500,
      "Dữ liệu công việc dự án chưa hoàn chỉnh.",
      "task_assignment_schema_invalid",
      "schema_validation",
    );
  }

  return {
    taskId: Number(row.id),
    projectId: Number(row.project_id),
    phaseId: row.phase_id === null ? null : Number(row.phase_id),
    parentTaskId:
      row.parent_task_id === null ? null : Number(row.parent_task_id),
    title: row.title,
    description: row.description ?? null,
    assigneeEmployeeId:
      row.assignee_employee_id === null
        ? null
        : Number(row.assignee_employee_id),
    assigneeFullName: row.assignee?.full_name ?? null,
    deadline: row.deadline ?? null,
    status: row.status,
    progressPercent: taskProgressPercent(row.status),
    commentCount: commentCounts.get(Number(row.id)) ?? 0,
    lastActivityAt: lastActivity.get(Number(row.id)) ?? null,
  };
}

async function assertTaskSchemaReady() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("tasks")
    .select("id, project_id, title, status")
    .limit(1);
  if (error) {
    throw taskAssignmentError(
      409,
      "Task Assignment Foundation chưa sẵn sàng. Vui lòng kiểm tra migration trước khi thao tác.",
      "task_assignment_migration_required",
      "migration_gate",
      { supabase_error_code: error.code ?? "unknown" },
    );
  }
}

async function loadTask(
  projectId: number,
  taskId: number,
): Promise<TaskAssignmentDTO> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(
      "id, project_id, phase_id, parent_task_id, title, description, assignee_employee_id, deadline, status, created_at, updated_at, assignee:assignee_employee_id!tasks_assignee_employee_id_fkey(full_name)",
    )
    .eq("id", taskId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error)
    mapSupabaseError(
      "Không thể tải công việc dự án.",
      "task_assignment_load_failed",
      error.code,
    );
  if (!data)
    throw taskAssignmentError(
      404,
      "Không tìm thấy công việc dự án.",
      "task_assignment_not_found",
    );

  return mapTask(data as unknown as TaskRow);
}

async function assertTaskBelongsToProject(projectId: number, taskId: number) {
  await loadTask(projectId, taskId);
}

async function assertPhaseBelongsToProject(
  projectId: number,
  phaseId: number | null | undefined,
) {
  if (!phaseId) return;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("phases")
    .select("id")
    .eq("id", phaseId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (error)
    mapSupabaseError(
      "Không thể kiểm tra giai đoạn dự án.",
      "task_assignment_phase_check_failed",
      error.code,
    );
  if (!data)
    throw taskAssignmentError(
      422,
      "Giai đoạn không thuộc dự án này.",
      "task_assignment_phase_invalid",
      "payload_validation",
    );
}

async function assertParentBelongsToProject(
  projectId: number,
  taskId: number | null | undefined,
  parentTaskId: number | null | undefined,
) {
  if (!parentTaskId) return;
  if (taskId && taskId === parentTaskId)
    throw taskAssignmentError(
      422,
      "Công việc không thể là cha của chính nó.",
      "task_assignment_parent_invalid",
      "payload_validation",
    );
  const parent = await loadTask(projectId, parentTaskId);
  if (taskId && parent.taskId === taskId)
    throw taskAssignmentError(
      422,
      "Công việc không thể là cha của chính nó.",
      "task_assignment_parent_invalid",
      "payload_validation",
    );
  const visited = new Set<number>([parent.taskId]);
  let nextParentId = parent.parentTaskId;
  while (nextParentId) {
    if (taskId && nextParentId === taskId)
      throw taskAssignmentError(
        422,
        "Không thể chọn công việc con làm công việc cha.",
        "task_assignment_parent_cycle",
        "payload_validation",
      );
    if (visited.has(nextParentId))
      throw taskAssignmentError(
        422,
        "Cây công việc đang có vòng lặp.",
        "task_assignment_parent_cycle",
        "payload_validation",
      );
    visited.add(nextParentId);
    const ancestor = await loadTask(projectId, nextParentId);
    nextParentId = ancestor.parentTaskId;
  }
}

async function assertAssigneeActiveMember(
  projectId: number,
  assigneeEmployeeId: number | null | undefined,
) {
  if (!assigneeEmployeeId) return;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, employees!project_members_employee_id_fkey(id, status, is_active)",
    )
    .eq("project_id", projectId)
    .eq("employee_id", assigneeEmployeeId)
    .eq("status", "ACTIVE")
    .maybeSingle();
  if (error)
    mapSupabaseError(
      "Không thể kiểm tra người được giao.",
      "task_assignment_assignee_check_failed",
      error.code,
    );
  if (!data)
    throw taskAssignmentError(
      422,
      "Người được giao phải là thành viên ACTIVE của dự án.",
      "task_assignment_assignee_invalid",
      "payload_validation",
    );
  const employee = (
    data as {
      employees?: { status?: string | null; is_active?: boolean | null } | null;
    }
  ).employees;
  const employeeStatus = String(employee?.status ?? "").toUpperCase();
  if (
    !employee ||
    employee.is_active === false ||
    employeeStatus === "INACTIVE" ||
    employeeStatus === "LOCKED" ||
    employeeStatus === "DISABLED" ||
    employeeStatus === "DELETED"
  ) {
    throw taskAssignmentError(
      422,
      "Người được giao phải là nhân viên ACTIVE đủ điều kiện.",
      "task_assignment_employee_ineligible",
      "payload_validation",
    );
  }
}

async function insertComment(
  projectId: number,
  taskId: number,
  actorEmployeeId: number,
  body?: string | null,
) {
  if (!body) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("task_comments").insert([
    {
      project_id: projectId,
      task_id: taskId,
      employee_id: actorEmployeeId,
      body,
    },
  ]);
  if (error)
    mapSupabaseError(
      "Không thể lưu bình luận công việc.",
      "task_assignment_comment_failed",
      error.code,
    );
}

async function insertActivity(
  projectId: number,
  taskId: number,
  actorEmployeeId: number,
  activityType: string,
  payload: Record<string, unknown>,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("project_activity").insert([
    {
      project_id: projectId,
      task_id: taskId,
      actor_employee_id: actorEmployeeId,
      activity_type: activityType,
      payload,
    },
  ]);
  if (error)
    mapSupabaseError(
      "Không thể ghi lịch sử công việc.",
      "task_assignment_activity_failed",
      error.code,
    );
}

async function insertAssignmentNotification(
  projectId: number,
  taskId: number,
  recipientEmployeeId: number | null | undefined,
  payload: Record<string, unknown>,
) {
  if (!recipientEmployeeId) return;
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("task_notifications").insert([
    {
      project_id: projectId,
      task_id: taskId,
      recipient_employee_id: recipientEmployeeId,
      notification_type: "TASK_ASSIGNED",
      payload,
    },
  ]);
  if (error)
    mapSupabaseError(
      "Không thể tạo thông báo công việc.",
      "task_assignment_notification_failed",
      error.code,
    );
}

async function contextForList(projectId: number): Promise<ListContext> {
  const auth = await requireProjectMembershipAction(projectId, "PROJECT_VIEW");
  assertTaskAssignmentFeatureEnabled();
  await assertTaskSchemaReady();
  return {
    actorEmployeeId: auth.actorEmployeeId,
    canManageTasks: auth.capabilities.canManageTasks,
  };
}

async function contextForMutation(projectId: number): Promise<MutationContext> {
  const auth = await requireProjectMembershipAction(projectId, "TASK_MANAGE");
  assertTaskAssignmentFeatureEnabled();
  await assertTaskSchemaReady();
  return { actorEmployeeId: auth.actorEmployeeId };
}

export async function listProjectTasks(
  rawProjectId: string,
): Promise<{ success: true; tasks: TaskAssignmentDTO[] }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const context = await contextForList(projectId);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("tasks")
    .select(
      "id, project_id, phase_id, parent_task_id, title, description, assignee_employee_id, deadline, status, created_at, updated_at, assignee:assignee_employee_id!tasks_assignee_employee_id_fkey(full_name)",
    )
    .eq("project_id", projectId);
  if (!context.canManageTasks) {
    query = query.eq("assignee_employee_id", context.actorEmployeeId);
  }
  const { data, error } = await query.order("created_at", { ascending: false });
  if (error)
    mapSupabaseError(
      "Không thể tải danh sách công việc dự án.",
      "task_assignment_list_failed",
      error.code,
    );

  const rows = (data || []) as unknown as TaskRow[];
  const taskIds = rows.map((row) => Number(row.id));
  const commentCounts = new Map<number, number>();
  const lastActivity = new Map<number, string | null>();

  if (taskIds.length > 0) {
    const [commentsResult, activityResult] = await Promise.all([
      supabase.from("task_comments").select("task_id").in("task_id", taskIds),
      supabase
        .from("project_activity")
        .select("task_id, created_at")
        .in("task_id", taskIds)
        .order("created_at", { ascending: false }),
    ]);
    if (commentsResult.error)
      mapSupabaseError(
        "Không thể tải bình luận công việc.",
        "task_assignment_comment_load_failed",
        commentsResult.error.code,
      );
    if (activityResult.error)
      mapSupabaseError(
        "Không thể tải lịch sử công việc.",
        "task_assignment_activity_load_failed",
        activityResult.error.code,
      );
    ((commentsResult.data || []) as TaskCommentRow[]).forEach((comment) => {
      if (comment.task_id)
        commentCounts.set(
          Number(comment.task_id),
          (commentCounts.get(Number(comment.task_id)) ?? 0) + 1,
        );
    });
    ((activityResult.data || []) as TaskActivityRow[]).forEach((activity) => {
      if (activity.task_id && !lastActivity.has(Number(activity.task_id)))
        lastActivity.set(Number(activity.task_id), activity.created_at ?? null);
    });
  }

  return {
    success: true,
    tasks: rows.map((row) => mapTask(row, commentCounts, lastActivity)),
  };
}

export async function createProjectTask(
  rawProjectId: string,
  body: Record<string, unknown>,
): Promise<{ success: true; task: TaskAssignmentDTO }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const payload = validateTaskAssignmentCreatePayload(body);
  const context = await contextForMutation(projectId);
  await Promise.all([
    assertPhaseBelongsToProject(projectId, payload.phaseId),
    assertParentBelongsToProject(projectId, null, payload.parentTaskId),
    assertAssigneeActiveMember(projectId, payload.assigneeEmployeeId),
  ]);

  throw taskAssignmentError(
    409,
    "Tạo công việc cần RPC giao dịch để tránh ghi dang dở. Vui lòng duyệt migration RPC trước khi bật tạo mới.",
    "task_assignment_atomic_create_required",
    "migration_gate",
  );
}

export async function updateProjectTask(
  rawProjectId: string,
  rawTaskId: string,
  body: Record<string, unknown>,
): Promise<{ success: true; task: TaskAssignmentDTO }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const taskId = parseTaskAssignmentTaskId(rawTaskId);
  const payload = validateTaskAssignmentUpdatePayload(body);
  const context = await contextForMutation(projectId);
  const currentTask = await loadTask(projectId, taskId);
  await Promise.all([
    assertPhaseBelongsToProject(projectId, payload.phaseId),
    assertParentBelongsToProject(projectId, taskId, payload.parentTaskId),
  ]);

  const updatePayload: Record<string, unknown> = {
    updated_by_employee_id: context.actorEmployeeId,
    updated_at: new Date().toISOString(),
  };
  if (payload.title !== undefined && payload.title !== currentTask.title)
    updatePayload.title = payload.title;
  if (
    payload.description !== undefined &&
    payload.description !== currentTask.description
  )
    updatePayload.description = payload.description;
  if (payload.phaseId !== undefined && payload.phaseId !== currentTask.phaseId)
    updatePayload.phase_id = payload.phaseId;
  if (
    payload.parentTaskId !== undefined &&
    payload.parentTaskId !== currentTask.parentTaskId
  )
    updatePayload.parent_task_id = payload.parentTaskId;
  if (
    payload.deadline !== undefined &&
    payload.deadline !== currentTask.deadline
  )
    updatePayload.deadline = payload.deadline;
  const changedFields = Object.keys(updatePayload).filter(
    (key) => !["updated_by_employee_id", "updated_at"].includes(key),
  );
  if (changedFields.length === 0) {
    await insertComment(projectId, taskId, context.actorEmployeeId, payload.comment);
    return { success: true, task: await loadTask(projectId, taskId) };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .eq("project_id", projectId);
  if (error)
    mapSupabaseError(
      "Không thể cập nhật công việc dự án.",
      "task_assignment_update_failed",
      error.code,
    );

  await insertComment(
    projectId,
    taskId,
    context.actorEmployeeId,
    payload.comment,
  );
  if (changedFields.length > 0)
    await insertActivity(
      projectId,
      taskId,
      context.actorEmployeeId,
      "TASK_UPDATED",
      { changedFields },
    );
  return { success: true, task: await loadTask(projectId, taskId) };
}

export async function assignProjectTask(
  rawProjectId: string,
  rawTaskId: string,
  body: Record<string, unknown>,
): Promise<{ success: true; task: TaskAssignmentDTO }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const taskId = parseTaskAssignmentTaskId(rawTaskId);
  const payload = validateTaskAssignmentAssignPayload(body);
  const context = await contextForMutation(projectId);
  const currentTask = await loadTask(projectId, taskId);
  if (currentTask.assigneeEmployeeId === payload.assigneeEmployeeId) {
    await insertComment(projectId, taskId, context.actorEmployeeId, payload.comment);
    return { success: true, task: await loadTask(projectId, taskId) };
  }

  await assertAssigneeActiveMember(projectId, payload.assigneeEmployeeId);

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("tasks")
    .update({
      assignee_employee_id: payload.assigneeEmployeeId,
      assigned_by_employee_id: context.actorEmployeeId,
      assigned_at: new Date().toISOString(),
      updated_by_employee_id: context.actorEmployeeId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId)
    .eq("project_id", projectId);
  if (error)
    mapSupabaseError(
      "Không thể giao công việc dự án.",
      "task_assignment_assign_failed",
      error.code,
    );

  await insertComment(
    projectId,
    taskId,
    context.actorEmployeeId,
    payload.comment,
  );
  await insertActivity(
    projectId,
    taskId,
    context.actorEmployeeId,
    "TASK_ASSIGNED",
    { assigneeEmployeeId: payload.assigneeEmployeeId },
  );
  await insertAssignmentNotification(
    projectId,
    taskId,
    payload.assigneeEmployeeId,
    { assignedByEmployeeId: context.actorEmployeeId },
  );
  return { success: true, task: await loadTask(projectId, taskId) };
}

export async function changeProjectTaskStatus(
  rawProjectId: string,
  rawTaskId: string,
  body: Record<string, unknown>,
): Promise<{ success: true; task: TaskAssignmentDTO }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const taskId = parseTaskAssignmentTaskId(rawTaskId);
  const payload = validateTaskAssignmentStatusPayload(body);
  const context = await contextForMutation(projectId);
  const currentTask = await loadTask(projectId, taskId);
  if (!canTransitionTaskStatus(currentTask.status, payload.status)) {
    throw taskAssignmentError(
      422,
      "Chuyển trạng thái công việc không hợp lệ.",
      "task_assignment_status_transition_invalid",
      "payload_validation",
      { from_status: currentTask.status, to_status: payload.status },
    );
  }
  if (currentTask.status === payload.status) {
    await insertComment(projectId, taskId, context.actorEmployeeId, payload.comment);
    return { success: true, task: await loadTask(projectId, taskId) };
  }

  const supabase = createSupabaseAdminClient();
  const updatePayload: Record<string, unknown> = {
    status: payload.status,
    updated_by_employee_id: context.actorEmployeeId,
    updated_at: new Date().toISOString(),
  };
  if (payload.status === "COMPLETED")
    updatePayload.completed_at = new Date().toISOString();
  const { error } = await supabase
    .from("tasks")
    .update(updatePayload)
    .eq("id", taskId)
    .eq("project_id", projectId);
  if (error)
    mapSupabaseError(
      "Không thể đổi trạng thái công việc dự án.",
      "task_assignment_status_failed",
      error.code,
    );

  await insertComment(
    projectId,
    taskId,
    context.actorEmployeeId,
    payload.comment,
  );
  if (currentTask.status !== payload.status)
    await insertActivity(
      projectId,
      taskId,
      context.actorEmployeeId,
      "STATUS_CHANGED",
      { oldStatus: currentTask.status, newStatus: payload.status },
    );
  return { success: true, task: await loadTask(projectId, taskId) };
}
