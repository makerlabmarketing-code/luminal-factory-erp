import 'server-only';

import type { ProjectActivityDTO, ProjectActivityType, ProjectCommentDTO, ProjectTimelineDTO } from '@/lib/types/project-activity';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError } from '@/services/server/auth';
import { requireProjectMembershipAction } from '@/services/server/projectMembershipAuthorization';
import { parseProjectCommentPayload, parseTimelineLimit, ProjectCommentValidationError } from '@/services/projectActivity';
import { parseTaskAssignmentProjectId } from '@/services/taskAssignmentFoundation';

const CAPABILITY_MESSAGE = 'Bình luận và lịch sử hoạt động đang chờ kích hoạt.';

type ActorRelation = { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
type CommentRow = { id: number; project_id: number; task_id: number | null; body: string; employee_id: number; created_at: string; actor?: ActorRelation };
type ActivityRow = { id: number; project_id: number; task_id: number | null; activity_type: string; payload: Record<string, unknown> | null; actor_employee_id: number; created_at: string; actor?: ActorRelation };

function actorName(actor: ActorRelation): string {
  const row = Array.isArray(actor) ? actor[0] : actor;
  return row?.full_name || 'Nhân sự Luminal';
}

function featureEnabled(): boolean {
  return process.env.TASK_COMMENTS_ACTIVITY_ENABLED === 'true';
}

function failure(status: number, message: string, code: string): AuthFlowError {
  return new AuthFlowError({ status, message, code: code as AuthFlowError['code'], failureStage: 'unknown' });
}

async function assertTaskInProject(projectId: number, taskId: number | null) {
  if (!taskId) return;
  const { data, error } = await createSupabaseAdminClient().from('tasks').select('id').eq('id', taskId).eq('project_id', projectId).maybeSingle();
  if (error) throw failure(500, 'Không thể kiểm tra công việc.', 'project_comment_task_check_failed');
  if (!data) throw failure(422, 'Công việc không thuộc dự án này.', 'project_comment_cross_project');
}

function mapComment(row: CommentRow): ProjectCommentDTO {
  return { id: Number(row.id), projectId: Number(row.project_id), taskId: row.task_id == null ? null : Number(row.task_id), body: row.body, actorEmployeeId: Number(row.employee_id), actorName: actorName(row.actor ?? null), createdAt: row.created_at };
}

function mapActivity(row: ActivityRow): ProjectActivityDTO {
  return { id: Number(row.id), projectId: Number(row.project_id), taskId: row.task_id == null ? null : Number(row.task_id), activityType: row.activity_type as ProjectActivityType, payload: Object.freeze(row.payload || {}), actorEmployeeId: Number(row.actor_employee_id), actorName: actorName(row.actor ?? null), createdAt: row.created_at };
}

export async function listProjectTimeline(rawProjectId: string, searchParams: URLSearchParams): Promise<{ success: true; timeline: ProjectTimelineDTO }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  const auth = await requireProjectMembershipAction(projectId, 'PROJECT_VIEW');
  if (!featureEnabled()) return { success: true, timeline: { comments: [], activity: [], nextCursor: null, capabilityEnabled: false, canComment: false } };

  const limit = parseTimelineLimit(searchParams.get('limit'));
  const cursor = searchParams.get('cursor');
  const supabase = createSupabaseAdminClient();
  let commentsQuery = supabase.from('task_comments').select('id, project_id, task_id, body, employee_id, created_at, actor:employees!task_comments_employee_id_fkey(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(limit + 1);
  let activityQuery = supabase.from('project_activity').select('id, project_id, task_id, activity_type, payload, actor_employee_id, created_at, actor:employees!project_activity_actor_employee_id_fkey(full_name)').eq('project_id', projectId).order('created_at', { ascending: false }).limit(limit + 1);
  if (cursor) {
    commentsQuery = commentsQuery.lt('created_at', cursor);
    activityQuery = activityQuery.lt('created_at', cursor);
  }
  const [commentsResult, activityResult] = await Promise.all([commentsQuery, activityQuery]);
  if (commentsResult.error || activityResult.error) throw failure(500, 'Không thể tải bình luận và lịch sử hoạt động.', 'project_timeline_load_failed');
  const comments = (commentsResult.data || []) as unknown as CommentRow[];
  const activity = (activityResult.data || []) as unknown as ActivityRow[];
  const allDates = [...comments, ...activity].map((row) => row.created_at).sort().reverse();
  return { success: true, timeline: { comments: comments.slice(0, limit).map(mapComment), activity: activity.slice(0, limit).map(mapActivity), nextCursor: comments.length > limit || activity.length > limit ? allDates[Math.min(allDates.length - 1, limit - 1)] || null : null, capabilityEnabled: true, canComment: auth.projectStatus !== 'CANCELLED' } };
}

export async function createProjectComment(rawProjectId: string, body: Record<string, unknown>): Promise<{ success: true; comment: ProjectCommentDTO }> {
  const projectId = parseTaskAssignmentProjectId(rawProjectId);
  if (!featureEnabled()) throw failure(409, CAPABILITY_MESSAGE, 'project_timeline_migration_required');
  const auth = await requireProjectMembershipAction(projectId, 'PROJECT_VIEW');
  if (auth.projectStatus === 'CANCELLED') throw failure(409, 'Dự án đã hủy chỉ được phép xem.', 'project_cancelled_read_only');
  let payload;
  try { payload = parseProjectCommentPayload(body); } catch (error) {
    if (error instanceof ProjectCommentValidationError) throw failure(422, error.message, 'payload_validation_failed');
    throw error;
  }
  await assertTaskInProject(projectId, payload.taskId);
  const { data, error } = await createSupabaseAdminClient().from('task_comments').insert({ project_id: projectId, task_id: payload.taskId, employee_id: auth.actorEmployeeId, body: payload.body }).select('id, project_id, task_id, body, employee_id, created_at, actor:employees!task_comments_employee_id_fkey(full_name)').single();
  if (error || !data) throw failure(500, 'Không thể lưu bình luận.', 'project_comment_create_failed');
  return { success: true, comment: mapComment(data as unknown as CommentRow) };
}

export function projectActivityErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) return { status: error.status, body: { success: false, message: error.message, code: error.code } };
  return { status: 500, body: { success: false, message: 'Không thể xử lý bình luận và lịch sử hoạt động.', code: 'project_timeline_failed' } };
}
