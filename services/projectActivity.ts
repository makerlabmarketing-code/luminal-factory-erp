const ALLOWED_COMMENT_FIELDS = new Set(['body', 'taskId']);

export class ProjectCommentValidationError extends Error {}

export function sanitizeCommentText(value: unknown): string {
  if (typeof value !== 'string') throw new ProjectCommentValidationError('Vui lòng nhập nội dung bình luận.');
  const sanitized = value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim();
  if (!sanitized) throw new ProjectCommentValidationError('Vui lòng nhập nội dung bình luận.');
  if (sanitized.length > 2000) throw new ProjectCommentValidationError('Bình luận không được vượt quá 2.000 ký tự.');
  return sanitized;
}

export function parseProjectCommentPayload(body: Record<string, unknown>): { body: string; taskId: number | null } {
  const unknownField = Object.keys(body).find((key) => !ALLOWED_COMMENT_FIELDS.has(key));
  if (unknownField) throw new ProjectCommentValidationError(`Trường ${unknownField} không được phép.`);
  const taskId = body.taskId == null ? null : Number(body.taskId);
  if (taskId !== null && (!Number.isInteger(taskId) || taskId <= 0)) {
    throw new ProjectCommentValidationError('Công việc được chọn không hợp lệ.');
  }
  return { body: sanitizeCommentText(body.body), taskId };
}

export function parseTimelineLimit(raw: string | null): number {
  if (!raw) return 30;
  const limit = Number(raw);
  return Number.isInteger(limit) && limit >= 1 && limit <= 50 ? limit : 30;
}
