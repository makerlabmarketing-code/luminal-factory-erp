import 'server-only';

import { AuthFlowError } from '@/services/server/auth';
import { requireProjectMembershipAction } from '@/services/server/projectMembershipAuthorization';
import {
  parseTaskAssignmentProjectId,
  parseTaskAssignmentTaskId,
  TaskAssignmentValidationError,
  validateTaskAssignmentAssignPayload,
  validateTaskAssignmentCreatePayload,
  validateTaskAssignmentStatusPayload,
  validateTaskAssignmentUpdatePayload,
} from '@/services/taskAssignmentFoundation';

function taskAssignmentError(status: number, message: string, code: string, failureStage = 'unknown') {
  return new AuthFlowError({
    status,
    message,
    code: code as AuthFlowError['code'],
    failureStage: failureStage as AuthFlowError['failureStage'],
  });
}

function assertTaskAssignmentFeatureEnabled() {
  if (process.env.TASK_ASSIGNMENT_FOUNDATION_ENABLED !== 'true') {
    throw taskAssignmentError(
      409,
      'Task Assignment Foundation cần duyệt migration trước khi bật thao tác.',
      'task_assignment_migration_required',
      'migration_gate'
    );
  }
}

function assertTaskAssignmentRepositoryAvailable(): never {
  throw taskAssignmentError(
    501,
    'Task Assignment repository chưa được kết nối. API chưa thể lưu công việc dự án.',
    'task_assignment_repository_not_implemented',
    'unknown'
  );
}

function mapValidationError(error: TaskAssignmentValidationError): AuthFlowError {
  return new AuthFlowError({
    status: 422,
    code: 'payload_validation_failed',
    message: error.issues[0]?.message || 'Dữ liệu công việc không hợp lệ.',
    failureStage: 'payload_validation',
    safeDetails: {
      issue_count: error.issues.length,
      field: error.issues[0]?.field || 'payload',
    },
  });
}

export function taskAssignmentErrorResponse(error: unknown): { status: number; body: Record<string, unknown> } {
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
      message: 'Không thể xử lý công việc dự án.',
      code: 'task_assignment_failed',
      failure_stage: 'unknown',
    },
  };
}

export async function listProjectTasks(rawProjectId: string) {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  await requireProjectMembershipAction(projectId, 'PROJECT_VIEW');
  assertTaskAssignmentFeatureEnabled();

  return assertTaskAssignmentRepositoryAvailable();
}

export async function createProjectTask(rawProjectId: string, body: Record<string, unknown>) {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const payload = validateTaskAssignmentCreatePayload(body);
  await requireProjectMembershipAction(projectId, 'TASK_MANAGE');
  assertTaskAssignmentFeatureEnabled();

  void payload;
  return assertTaskAssignmentRepositoryAvailable();
}

export async function updateProjectTask(rawProjectId: string, rawTaskId: string, body: Record<string, unknown>) {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const taskId = parseTaskAssignmentTaskId(rawTaskId);
  const payload = validateTaskAssignmentUpdatePayload(body);
  await requireProjectMembershipAction(projectId, 'TASK_MANAGE');
  assertTaskAssignmentFeatureEnabled();

  void taskId;
  void payload;
  return assertTaskAssignmentRepositoryAvailable();
}

export async function assignProjectTask(rawProjectId: string, rawTaskId: string, body: Record<string, unknown>) {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const taskId = parseTaskAssignmentTaskId(rawTaskId);
  const payload = validateTaskAssignmentAssignPayload(body);
  await requireProjectMembershipAction(projectId, 'TASK_MANAGE');
  assertTaskAssignmentFeatureEnabled();

  void taskId;
  void payload;
  return assertTaskAssignmentRepositoryAvailable();
}

export async function changeProjectTaskStatus(rawProjectId: string, rawTaskId: string, body: Record<string, unknown>) {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const taskId = parseTaskAssignmentTaskId(rawTaskId);
  const payload = validateTaskAssignmentStatusPayload(body);
  await requireProjectMembershipAction(projectId, 'TASK_MANAGE');
  assertTaskAssignmentFeatureEnabled();

  void taskId;
  void payload;
  return assertTaskAssignmentRepositoryAvailable();
}
