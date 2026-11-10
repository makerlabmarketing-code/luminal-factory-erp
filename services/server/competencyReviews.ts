import 'server-only';

import { NextResponse } from 'next/server';
import { COMPETENCY_RUBRIC, isReviewMonth, parseCompetencyScores } from '@/lib/competency-reviews';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, requireSystemOwner, requireWorkspaceAccess } from './auth';

const snapshotColumns = 'id, revision, month, published_at, publisher_name, viewed_at, rubric, manager, self_review, correction';
const response = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
const failed = (error: unknown) => error instanceof AuthFlowError
  ? response({ error: error.message }, error.status)
  : response({ error: 'Không thể xử lý đánh giá. Vui lòng thử lại.' }, 503);

function mutationError(code: string) {
  if (code === '40001') return response({ error: 'Bản đánh giá vừa thay đổi. Tải lại trước khi tiếp tục.' }, 409);
  if (code === '42501') return response({ error: 'Bạn chưa được cấp quyền thực hiện.' }, 403);
  if (code === '22023') return response({ error: 'Kiểm tra lý do, bằng chứng và trạng thái người nhận.' }, 400);
  return failed(null);
}

async function authorize(admin: boolean) {
  if (admin) return requireSystemOwner();
  return requireWorkspaceAccess('STAFF_WORKSPACE');
}

export async function readCompetencyReviews(request: Request, admin: boolean) {
  try {
    const auth = await authorize(admin);
    if (process.env.COMPETENCY_REVIEWS_ENABLED !== 'true') return response({ error: 'Đánh giá năng lực chưa mở.' }, 404);
    const db = createSupabaseAdminClient();
    const params = new URL(request.url).searchParams;
    const employeeId = admin ? Number(params.get('employee')) : Number(auth.employee.id);
    const month = params.get('month');
    if (admin && !params.has('employee')) {
      const employees = await db.from('employees').select('id, full_name').eq('status', 'ACTIVE').eq('is_active', true).order('full_name');
      return employees.error ? failed(null) : response({ employees: employees.data ?? [] });
    }
    if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !isReviewMonth(month)) return response({ error: 'Kỳ hoặc nhân sự không hợp lệ.' }, 400);

    const monthDate = month + '-01';
    const [published, self, draft] = await Promise.all([
      db.from('competency_publications').select(snapshotColumns)
        .eq('employee_id', employeeId).order('published_at', { ascending: false }).order('id', { ascending: false }).limit(100),
      db.from('competency_self_reviews').select('revision,content').eq('employee_id', employeeId).eq('month', monthDate).maybeSingle(),
      admin ? db.from('competency_manager_drafts').select('revision,content').eq('employee_id', employeeId).eq('month', monthDate).maybeSingle() : null,
    ]);
    if (published.error || self.error || draft?.error) return failed(null);
    return response({ published: published.data, self: self.data, ...(admin ? { draft: draft?.data } : {}) });
  } catch (error) {
    return failed(error);
  }
}

export async function writeCompetencyReview(request: Request, admin: boolean) {
  try {
    const auth = await authorize(admin);
    if (process.env.COMPETENCY_REVIEWS_ENABLED !== 'true') return response({ error: 'Đánh giá năng lực chưa mở.' }, 404);
    const db = createSupabaseAdminClient();
    const body = await request.json().catch(() => null);
    const actorId = Number(auth.employee.id);
    if (!admin && body?.action === 'view') {
      if (typeof body.id !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(body.id)) return response({ error: 'Mã kết quả không hợp lệ.' }, 400);
      const { data, error } = await db.rpc('mark_competency_review_viewed', { p_employee: actorId, p_publication: body.id });
      return error ? mutationError(error.code) : data ? response({ success: true }) : response({ error: 'Không tìm thấy kết quả.' }, 404);
    }

    const employeeId = admin ? body?.employeeId : actorId;
    if (!Number.isSafeInteger(employeeId) || employeeId < 1 || !isReviewMonth(body?.month) ||
        !Number.isSafeInteger(body.revision) || body.revision < 0 || body.revision > 2147483646) {
      return response({ error: 'Kỳ hoặc phiên bản đánh giá không hợp lệ.' }, 400);
    }

    const identity = { p_employee: employeeId, p_month: body.month + '-01', p_actor: actorId, p_expected: body.revision };
    if (admin && body.action === 'publish') {
      if (typeof body.correction !== 'string' || body.correction.length > 2000 || body.revision < 1 ||
          !Number.isSafeInteger(body.selfRevision) || body.selfRevision < 0 || body.selfRevision > 2147483646) {
        return response({ error: 'Phiên bản gửi không hợp lệ.' }, 400);
      }
      const { data, error } = await db.rpc('publish_competency_review', {
        ...identity, p_expected_self: body.selfRevision, p_correction: body.correction.trim(), p_rubric: COMPETENCY_RUBRIC,
      });
      return error ? mutationError(error.code) : response({ publicationId: data });
    }
    const content = parseCompetencyScores(body.content);
    if (body.action !== 'save' || !content) return response({ error: 'Nội dung đánh giá không hợp lệ.' }, 400);
    const { data, error } = await db.rpc('save_competency_review', { ...identity, p_is_self: !admin, p_content: content });
    return error ? mutationError(error.code) : response({ revision: data });
  } catch (error) {
    return failed(error);
  }
}
