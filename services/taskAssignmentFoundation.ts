import type {
  TaskAssignmentAssignPayload,
  TaskAssignmentCreatePayload,
  TaskAssignmentStatus,
  TaskAssignmentStatusPayload,
  TaskAssignmentUpdatePayload,
} from '@/lib/types/task-assignment';

export type TaskAssignmentAction = 'TASK_LIST' | 'TASK_CREATE' | 'TASK_UPDATE' | 'TASK_ASSIGN' | 'TASK_STATUS_CHANGE';

export interface TaskAssignmentValidationIssue {
  field: string;
  message: string;
}

export class TaskAssignmentValidationError extends Error {
  issues: TaskAssignmentValidationIssue[];

  constructor(issues: TaskAssignmentValidationIssue[]) {
    super('Dữ liệu công việc không hợp lệ.');
    this.name = 'TaskAssignmentValidationError';
    this.issues = issues;
  }
}

export const TASK_ASSIGNMENT_STATUSES: readonly TaskAssignmentStatus[] = [
  'BACKLOG',
  'READY',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'REVISION_REQUIRED',
  'APPROVED',
  'BLOCKED',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
];

export const TASK_ASSIGNMENT_CREATE_KEYS = new Set([
  'title',
  'description',
  'phaseId',
  'parentTaskId',
  'assigneeEmployeeId',
  'deadline',
  'comment',
]);
export const TASK_ASSIGNMENT_UPDATE_KEYS = new Set(['title', 'description', 'phaseId', 'parentTaskId', 'deadline', 'comment']);
export const TASK_ASSIGNMENT_ASSIGN_KEYS = new Set(['assigneeEmployeeId', 'comment']);
export const TASK_ASSIGNMENT_STATUS_KEYS = new Set(['status', 'comment']);

const STATUS_SET = new Set<string>(TASK_ASSIGNMENT_STATUSES);

function assertKnownFields(body: Record<string, unknown>, allowedKeys: Set<string>) {
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new TaskAssignmentValidationError([
      {
        field: 'payload',
        message: 'Dữ liệu có trường không được hỗ trợ.',
      },
    ]);
  }
}

function optionalPositiveInteger(value: unknown, field: string): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;

  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new TaskAssignmentValidationError([{ field, message: 'Giá trị phải là số nguyên dương.' }]);
  }

  return numericValue;
}

function requiredPositiveInteger(value: unknown, field: string): number {
  const numericValue = Number(value);
  if (!Number.isInteger(numericValue) || numericValue <= 0) {
    throw new TaskAssignmentValidationError([{ field, message: 'Giá trị phải là số nguyên dương.' }]);
  }

  return numericValue;
}

function optionalText(value: unknown, field: string, maxLength: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new TaskAssignmentValidationError([{ field, message: 'Giá trị phải là chữ.' }]);
  }

  const text = value.trim();
  if (text.length > maxLength) {
    throw new TaskAssignmentValidationError([{ field, message: `Nội dung tối đa ${maxLength} ký tự.` }]);
  }

  return text || null;
}

function requiredTitle(value: unknown): string {
  const title = optionalText(value, 'title', 160);
  if (!title) {
    throw new TaskAssignmentValidationError([{ field: 'title', message: 'Vui lòng nhập tên công việc.' }]);
  }

  return title;
}

function optionalIsoDate(value: unknown): string | null | undefined {
  const text = optionalText(value, 'deadline', 40);
  if (text === undefined || text === null) return text;

  const timestamp = Date.parse(text);
  if (Number.isNaN(timestamp)) {
    throw new TaskAssignmentValidationError([{ field: 'deadline', message: 'Hạn hoàn thành không hợp lệ.' }]);
  }

  return text;
}

export function isTaskAssignmentStatus(value: unknown): value is TaskAssignmentStatus {
  return typeof value === 'string' && STATUS_SET.has(value);
}

export function parseTaskAssignmentProjectId(value: unknown): number {
  return requiredPositiveInteger(value, 'projectId');
}

export function parseTaskAssignmentTaskId(value: unknown): number {
  return requiredPositiveInteger(value, 'taskId');
}

export function validateTaskAssignmentCreatePayload(body: Record<string, unknown>): TaskAssignmentCreatePayload {
  assertKnownFields(body, TASK_ASSIGNMENT_CREATE_KEYS);

  return {
    title: requiredTitle(body.title),
    description: optionalText(body.description, 'description', 2000) ?? null,
    phaseId: optionalPositiveInteger(body.phaseId, 'phaseId') ?? null,
    parentTaskId: optionalPositiveInteger(body.parentTaskId, 'parentTaskId') ?? null,
    assigneeEmployeeId: optionalPositiveInteger(body.assigneeEmployeeId, 'assigneeEmployeeId') ?? null,
    deadline: optionalIsoDate(body.deadline) ?? null,
    comment: optionalText(body.comment, 'comment', 2000) ?? null,
  };
}

export function validateTaskAssignmentUpdatePayload(body: Record<string, unknown>): TaskAssignmentUpdatePayload {
  assertKnownFields(body, TASK_ASSIGNMENT_UPDATE_KEYS);

  const payload: TaskAssignmentUpdatePayload = {};
  if (body.title !== undefined) payload.title = requiredTitle(body.title);
  if (body.description !== undefined) payload.description = optionalText(body.description, 'description', 2000) ?? null;
  if (body.phaseId !== undefined) payload.phaseId = optionalPositiveInteger(body.phaseId, 'phaseId') ?? null;
  if (body.parentTaskId !== undefined) payload.parentTaskId = optionalPositiveInteger(body.parentTaskId, 'parentTaskId') ?? null;
  if (body.deadline !== undefined) payload.deadline = optionalIsoDate(body.deadline) ?? null;
  if (body.comment !== undefined) payload.comment = optionalText(body.comment, 'comment', 2000) ?? null;

  return payload;
}

export function validateTaskAssignmentAssignPayload(body: Record<string, unknown>): TaskAssignmentAssignPayload {
  assertKnownFields(body, TASK_ASSIGNMENT_ASSIGN_KEYS);

  return {
    assigneeEmployeeId: optionalPositiveInteger(body.assigneeEmployeeId, 'assigneeEmployeeId') ?? null,
    comment: optionalText(body.comment, 'comment', 2000) ?? null,
  };
}

export function validateTaskAssignmentStatusPayload(body: Record<string, unknown>): TaskAssignmentStatusPayload {
  assertKnownFields(body, TASK_ASSIGNMENT_STATUS_KEYS);

  if (!isTaskAssignmentStatus(body.status)) {
    throw new TaskAssignmentValidationError([{ field: 'status', message: 'Trạng thái công việc không hợp lệ.' }]);
  }

  return {
    status: body.status,
    comment: optionalText(body.comment, 'comment', 2000) ?? null,
  };
}
