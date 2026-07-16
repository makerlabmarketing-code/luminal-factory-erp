import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError } from '@/services/server/auth';
import { PhaseAction } from '@/services/server/phaseAuthorizationCore';
import { requirePhaseMutationAccess } from '@/services/server/phaseAuthorization';

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
  safeDetails,
}: {
  status: number;
  message: string;
  safeDetails?: Record<string, boolean | number | string | null>;
}) {
  return new AuthFlowError({
    status,
    code:
      status === 422
        ? 'phase_invalid_action'
        : status === 403
          ? 'phase_permission_denied'
          : 'phase_authorization_failed',
    message,
    failureStage: status === 403 ? 'permission_check' : 'unknown',
    safeDetails,
  });
}

function assertKnownFields(body: PhaseMutationBody, allowedKeys: Set<string>) {
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Dữ liệu giai đoạn có trường không được hỗ trợ.',
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
    });
  }

  return phaseId;
}

function requiredPhaseName(body: PhaseMutationBody): string {
  if (typeof body.phaseName !== 'string') {
    throw phaseMutationError({
      status: 422,
      message: 'Vui lòng nhập tên giai đoạn.',
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
      safeDetails: {
        field: 'orderIndex',
      },
    });
  }

  return orderIndex;
}

function phaseUpdateAction(body: PhaseMutationBody): PhaseAction {
  if (body.orderIndex !== undefined) return 'PHASE_REORDER';
  if (body.phaseName !== undefined) return 'PHASE_EDIT';

  return 'PHASE_EDIT';
}

export async function createPhase(
  rawProjectId: string,
  body: PhaseMutationBody
): Promise<PhaseMutationResult> {
  assertKnownFields(body, CREATE_PHASE_KEYS);

  const projectId = numericProjectId(rawProjectId);
  const phaseName = requiredPhaseName(body);
  const orderIndex = requiredOrderIndex(body);
  await requirePhaseMutationAccess({ projectId, action: 'PHASE_CREATE' });

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('phases')
    .insert([{ project_id: projectId, name: phaseName, order_index: orderIndex }])
    .select('id')
    .single();

  if (error || !data) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể lưu giai đoạn.',
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
  assertKnownFields(body, UPDATE_PHASE_KEYS);

  const projectId = numericProjectId(rawProjectId);
  const phaseId = numericPhaseId(rawPhaseId);
  const action = phaseUpdateAction(body);
  await requirePhaseMutationAccess({ projectId, phaseId, action });

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
  const { error } = await supabase
    .from('phases')
    .update(payload)
    .eq('id', phaseId)
    .eq('project_id', projectId);

  if (error) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể lưu giai đoạn.',
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
  assertKnownFields(body, LIST_PHASE_KEYS);

  if (!Array.isArray(body.projectIds)) {
    throw phaseMutationError({
      status: 422,
      message: 'Danh sách dự án không hợp lệ.',
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

  await Promise.all(
    projectIds.map((projectId) =>
      requirePhaseMutationAccess({ projectId, action: 'PHASE_VIEW' })
    )
  );

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
