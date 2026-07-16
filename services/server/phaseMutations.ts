import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';

type PhaseMutationBody = Record<string, unknown>;

interface PhaseMutationResult {
  success: true;
  phaseId: number;
}

interface PhaseListResult {
  success: true;
  phases: Array<{
    id: number;
    project_id: number | null;
    name: string;
    order_index: number;
    created_at: string | null;
  }>;
}

const CREATE_PHASE_KEYS = new Set(['phaseName', 'orderIndex']);
const UPDATE_PHASE_KEYS = new Set(['phaseName', 'orderIndex']);
const LIST_PHASE_KEYS = new Set(['projectIds']);

function phaseMutationError({
  status,
  message,
  failureStage,
  safeDetails,
}: {
  status: number;
  message: string;
  failureStage: 'workspace_access' | 'permission_check' | 'unknown';
  safeDetails?: Record<string, boolean | number | string | null>;
}) {
  return new AuthFlowError({
    status,
    code:
      status === 403
        ? 'permission_forbidden'
        : 'admin_verification_failed',
    message,
    failureStage,
    safeDetails,
  });
}

function assertKnownFields(body: PhaseMutationBody) {
  const unknownKeys = Object.keys(body).filter((key) => !CREATE_PHASE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Dữ liệu giai đoạn có trường không được hỗ trợ.',
      failureStage: 'unknown',
      safeDetails: {
        rejected_field_count: unknownKeys.length,
      },
    });
  }
}

function assertKnownUpdateFields(body: PhaseMutationBody) {
  const unknownKeys = Object.keys(body).filter((key) => !UPDATE_PHASE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Dữ liệu giai đoạn có trường không được hỗ trợ.',
      failureStage: 'unknown',
      safeDetails: {
        rejected_field_count: unknownKeys.length,
      },
    });
  }
}

function assertKnownListFields(body: PhaseMutationBody) {
  const unknownKeys = Object.keys(body).filter((key) => !LIST_PHASE_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Dữ liệu truy vấn giai đoạn có trường không được hỗ trợ.',
      failureStage: 'unknown',
      safeDetails: {
        rejected_field_count: unknownKeys.length,
      },
    });
  }
}

function numericProjectId(rawProjectId: string): number {
  const projectId = Number(rawProjectId);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Mã dự án không hợp lệ.',
      failureStage: 'unknown',
    });
  }

  return projectId;
}

function numericPhaseId(rawPhaseId: string): number {
  const phaseId = Number(rawPhaseId);
  if (!Number.isInteger(phaseId) || phaseId <= 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Mã giai đoạn không hợp lệ.',
      failureStage: 'unknown',
    });
  }

  return phaseId;
}

function requiredPhaseName(body: PhaseMutationBody): string {
  if (typeof body.phaseName !== 'string') {
    throw phaseMutationError({
      status: 422,
      message: 'Vui lòng nhập tên giai đoạn.',
      failureStage: 'unknown',
      safeDetails: {
        field: 'phaseName',
      },
    });
  }

  const phaseName = body.phaseName.trim();
  if (!phaseName) {
    throw phaseMutationError({
      status: 422,
      message: 'Vui lòng nhập tên giai đoạn.',
      failureStage: 'unknown',
      safeDetails: {
        field: 'phaseName',
      },
    });
  }

  return phaseName;
}

function requiredOrderIndex(body: PhaseMutationBody): number {
  const orderIndex = Number(body.orderIndex);
  if (!Number.isInteger(orderIndex) || orderIndex < 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Thứ tự giai đoạn không hợp lệ.',
      failureStage: 'unknown',
      safeDetails: {
        field: 'orderIndex',
      },
    });
  }

  return orderIndex;
}

async function requirePhaseManageAccess() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const canManageProjects = await hasPermission(authContext, 'PROJECT_MANAGE');

  if (!canManageProjects) {
    throw phaseMutationError({
      status: 403,
      message: 'Bạn không có quyền quản lý giai đoạn.',
      failureStage: 'permission_check',
      safeDetails: {
        permission: 'PROJECT_MANAGE',
      },
    });
  }
}

async function requirePhaseReadAccess() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const canViewProjects = await hasPermission(authContext, 'PROJECT_VIEW');

  if (!canViewProjects) {
    throw phaseMutationError({
      status: 403,
      message: 'Bạn không có quyền xem giai đoạn.',
      failureStage: 'permission_check',
      safeDetails: {
        permission: 'PROJECT_VIEW',
      },
    });
  }
}

export async function createPhase(
  rawProjectId: string,
  body: PhaseMutationBody
): Promise<PhaseMutationResult> {
  assertKnownFields(body);
  await requirePhaseManageAccess();

  const projectId = numericProjectId(rawProjectId);
  const phaseName = requiredPhaseName(body);
  const orderIndex = requiredOrderIndex(body);
  const supabase = createSupabaseAdminClient();

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id')
    .eq('id', projectId)
    .maybeSingle();

  if (projectError) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể kiểm tra dự án.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: projectError.code ?? 'unknown',
      },
    });
  }

  if (!project) {
    throw phaseMutationError({
      status: 404,
      message: 'Không tìm thấy dự án.',
      failureStage: 'unknown',
    });
  }

  const { data, error } = await supabase
    .from('phases')
    .insert([{ project_id: projectId, name: phaseName, order_index: orderIndex }])
    .select('id')
    .single();

  if (error || !data) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể lưu giai đoạn.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: error?.code ?? 'unknown',
      },
    });
  }

  return {
    success: true,
    phaseId: Number(data.id),
  };
}

export async function updatePhase(
  rawProjectId: string,
  rawPhaseId: string,
  body: PhaseMutationBody
): Promise<PhaseMutationResult> {
  assertKnownUpdateFields(body);
  await requirePhaseManageAccess();

  const projectId = numericProjectId(rawProjectId);
  const phaseId = numericPhaseId(rawPhaseId);
  const payload: Record<string, string | number> = {};

  if (body.phaseName !== undefined) {
    payload.name = requiredPhaseName(body);
  }

  if (body.orderIndex !== undefined) {
    payload.order_index = requiredOrderIndex(body);
  }

  if (Object.keys(payload).length === 0) {
    return {
      success: true,
      phaseId,
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: phase, error: phaseError } = await supabase
    .from('phases')
    .select('id, project_id')
    .eq('id', phaseId)
    .eq('project_id', projectId)
    .maybeSingle();

  if (phaseError) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể kiểm tra giai đoạn.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: phaseError.code ?? 'unknown',
      },
    });
  }

  if (!phase) {
    throw phaseMutationError({
      status: 404,
      message: 'Không tìm thấy giai đoạn.',
      failureStage: 'unknown',
    });
  }

  const { error } = await supabase
    .from('phases')
    .update(payload)
    .eq('id', phaseId)
    .eq('project_id', projectId);

  if (error) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể lưu giai đoạn.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  return {
    success: true,
    phaseId,
  };
}

export async function listPhases(body: PhaseMutationBody): Promise<PhaseListResult> {
  assertKnownListFields(body);
  await requirePhaseReadAccess();

  if (!Array.isArray(body.projectIds)) {
    throw phaseMutationError({
      status: 422,
      message: 'Danh sách dự án không hợp lệ.',
      failureStage: 'unknown',
      safeDetails: {
        field: 'projectIds',
      },
    });
  }

  const projectIds = body.projectIds
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0);

  if (projectIds.length === 0) {
    return {
      success: true,
      phases: [],
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('phases')
    .select('id, project_id, name, order_index, created_at')
    .in('project_id', projectIds)
    .order('id', { ascending: true });

  if (error) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể tải giai đoạn.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  return {
    success: true,
    phases: (data || []).map((phase) => ({
      id: Number(phase.id),
      project_id: phase.project_id === null ? null : Number(phase.project_id),
      name: String(phase.name || ''),
      order_index: Number(phase.order_index || 0),
      created_at: phase.created_at || null,
    })),
  };
}
