import { NextRequest, NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { requirePhaseMutationAccess } from '@/services/server/phaseAuthorization';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function numericProjectId(rawProjectId: string): number {
  const projectId = Number(rawProjectId);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw new AuthFlowError({
      status: 422,
      code: 'payload_validation_failed',
      message: 'Mã dự án không hợp lệ.',
      failureStage: 'payload_validation',
    });
  }
  return projectId;
}

function toErrorResponse(error: unknown) {
  if (error instanceof AuthFlowError) {
    return jsonNoStore({
      success: false,
      message: error.message,
      code: error.code,
      failure_stage: error.failureStage,
    }, { status: error.status });
  }
  return jsonNoStore({
    success: false,
    message: 'Không thể thiết lập giai đoạn.',
    code: 'phase_setup_failed',
    failure_stage: 'unknown',
  }, { status: 500 });
}

async function loadProjectAndPhaseCount(projectId: number) {
  const supabase = createSupabaseAdminClient();
  const [{ data: project, error: projectError }, { count, error: phaseError }] = await Promise.all([
    supabase.from('projects').select('id, status').eq('id', projectId).maybeSingle(),
    supabase.from('phases').select('id', { count: 'exact', head: true }).eq('project_id', projectId),
  ]);
  if (projectError || phaseError) throw new Error('phase_setup_preflight_failed');
  if (!project) {
    throw new AuthFlowError({
      status: 404,
      code: 'payload_validation_failed',
      message: 'Không tìm thấy dự án.',
      failureStage: 'payload_validation',
    });
  }
  return { status: String(project.status || '').toUpperCase(), phaseCount: count || 0 };
}

export async function GET(_request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    const projectId = numericProjectId(params.projectId);
    try {
      await requirePhaseMutationAccess({ projectId, action: 'PHASE_CREATE' });
    } catch (error) {
      if (error instanceof AuthFlowError && error.status === 403) {
        return jsonNoStore({ success: true, canSetup: false, phaseCount: null });
      }
      throw error;
    }
    const preflight = await loadProjectAndPhaseCount(projectId);
    const closed = ['CANCELLED', 'ARCHIVED', 'COMPLETED'].includes(preflight.status);
    return jsonNoStore({
      success: true,
      canSetup: !closed && preflight.phaseCount === 0,
      phaseCount: preflight.phaseCount,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function POST(_request: NextRequest, props: { params: Promise<{ projectId: string }> }) {
  const params = await props.params;
  try {
    const projectId = numericProjectId(params.projectId);
    await requirePhaseMutationAccess({ projectId, action: 'PHASE_CREATE' });
    const preflight = await loadProjectAndPhaseCount(projectId);
    if (['CANCELLED', 'ARCHIVED', 'COMPLETED'].includes(preflight.status)) {
      return jsonNoStore({ success: false, message: 'Dự án đã đóng, không thể thiết lập giai đoạn.', code: 'phase_setup_project_closed' }, { status: 409 });
    }
    if (preflight.phaseCount > 0) {
      return jsonNoStore({ success: false, message: 'Dự án đã có giai đoạn. Không tạo bộ mặc định để tránh dữ liệu trùng.', code: 'phase_setup_already_configured' }, { status: 409 });
    }

    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from('phases').insert([
      { project_id: projectId, name: 'Giai đoạn 1', order_index: 0, status: 'ACTIVE' },
      { project_id: projectId, name: 'Giai đoạn 2', order_index: 1, status: 'LOCKED' },
      { project_id: projectId, name: 'Giai đoạn 3', order_index: 2, status: 'LOCKED' },
    ]).select('id, name, order_index, status');
    if (error) {
      return jsonNoStore({ success: false, message: 'Không thể tạo bộ giai đoạn mặc định.', code: 'phase_setup_insert_failed' }, { status: 500 });
    }

    return jsonNoStore({ success: true, phases: data || [] }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
