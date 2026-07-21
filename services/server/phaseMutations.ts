import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError } from '@/services/server/auth';
import { PhaseAction } from '@/services/server/phaseAuthorizationCore';
import { requirePhaseMutationAccess } from '@/services/server/phaseAuthorization';
import {
  ProjectPhaseStatus,
  ProjectPhaseStatusAction,
  isProjectPhaseStatus,
  isProjectPhaseStatusAction,
  nextProjectPhaseStatus,
} from '@/lib/workflow-project-phase';

type PhaseMutationBody = Record<string, unknown>;

interface PhaseMutationResult {
  success: true;
  phaseId: number;
}

interface PhaseStatusMutationResult extends PhaseMutationResult {
  status: ProjectPhaseStatus;
}

interface PhaseStatusRow {
  id: number;
  project_id: number | null;
  status: string | null;
  order_index: number | null;
}

interface PhaseListResult {
  success: true;
  phases: Array<{
    id: number;
    project_id: number | null;
    name: string;
    order_index: number;
    created_at: string | null;
    status: string | null;
    colorway_name: string | null;
    colorway_code: string | null;
    stage_type: string | null;
    stage_owner: string | null;
    planned_start_date: string | null;
    planned_end_date: string | null;
    progress: number | null;
    next_action: string | null;
    required_review: boolean | null;
  }>;
}

const CREATE_PHASE_KEYS = new Set([
  'phaseName',
  'orderIndex',
  'colorwayName',
  'colorwayCode',
  'stageType',
  'stageOwner',
  'plannedStartDate',
  'plannedEndDate',
  'progress',
  'nextAction',
  'requiredReview',
]);
const UPDATE_PHASE_KEYS = new Set(['phaseName', 'orderIndex']);
const UPDATE_PHASE_STATUS_KEYS = new Set(['action', 'reason', 'note', 'expectedCurrentStatus']);
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

function assertPhaseStatusMutationEnabled() {
  if (process.env.PHASE_STATUS_MUTATION_ENABLED !== 'true') {
    throw phaseMutationError({
      status: 409,
      message: 'LIVE_APPROVAL_REQUIRED: cần duyệt migration status/dependency trước khi bật thao tác trạng thái giai đoạn.',
      safeDetails: {
        live_approval_required: true,
      },
    });
  }
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


function optionalTextField(body: PhaseMutationBody, key: string): string | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw phaseMutationError({
      status: 422,
      message: 'Thông tin giai đoạn chưa hợp lệ.',
      safeDetails: { field: key },
    });
  }

  const text = value.trim();
  return text || null;
}

function optionalDateField(body: PhaseMutationBody, key: string): string | null {
  const value = optionalTextField(body, key);
  if (!value) return null;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(new Date(`${value}T00:00:00Z`).getTime())) {
    throw phaseMutationError({
      status: 422,
      message: 'Ngày giai đoạn không hợp lệ.',
      safeDetails: { field: key },
    });
  }

  return value;
}

function optionalProgress(body: PhaseMutationBody): number | null {
  if (body.progress === undefined || body.progress === null || body.progress === '') return null;

  const progress = Number(body.progress);
  if (!Number.isInteger(progress) || progress < 0 || progress > 100) {
    throw phaseMutationError({
      status: 422,
      message: 'Tiến độ giai đoạn không hợp lệ.',
      safeDetails: { field: 'progress' },
    });
  }

  return progress;
}

function optionalBooleanField(body: PhaseMutationBody, key: string): boolean | null {
  const value = body[key];
  if (value === undefined || value === null) return null;
  if (typeof value !== 'boolean') {
    throw phaseMutationError({
      status: 422,
      message: 'Thông tin giai đoạn chưa hợp lệ.',
      safeDetails: { field: key },
    });
  }

  return value;
}

function phaseUpdateAction(body: PhaseMutationBody): PhaseAction {
  if (body.orderIndex !== undefined) return 'PHASE_REORDER';
  if (body.phaseName !== undefined) return 'PHASE_EDIT';

  return 'PHASE_EDIT';
}

function requiredPhaseStatusAction(body: PhaseMutationBody): ProjectPhaseStatusAction {
  if (!isProjectPhaseStatusAction(body.action)) {
    throw phaseMutationError({
      status: 422,
      message: 'Hành động trạng thái giai đoạn không hợp lệ.',
      safeDetails: { field: 'action' },
    });
  }

  return body.action;
}

function requiredReason(body: PhaseMutationBody): string {
  if (typeof body.reason !== 'string' || body.reason.trim().length === 0) {
    throw phaseMutationError({
      status: 422,
      message: 'Vui lòng nhập lý do thay đổi trạng thái giai đoạn.',
      safeDetails: { field: 'reason' },
    });
  }

  return body.reason.trim();
}

function optionalNote(body: PhaseMutationBody): string | null {
  if (body.note === undefined || body.note === null) return null;
  if (typeof body.note !== 'string') {
    throw phaseMutationError({
      status: 422,
      message: 'Ghi chú trạng thái giai đoạn không hợp lệ.',
      safeDetails: { field: 'note' },
    });
  }

  return body.note.trim() || null;
}

function expectedStatus(body: PhaseMutationBody): ProjectPhaseStatus | null {
  if (body.expectedCurrentStatus === undefined || body.expectedCurrentStatus === null) return null;
  if (!isProjectPhaseStatus(body.expectedCurrentStatus)) {
    throw phaseMutationError({
      status: 422,
      message: 'Trạng thái kỳ vọng không hợp lệ.',
      safeDetails: { field: 'expectedCurrentStatus' },
    });
  }

  return body.expectedCurrentStatus;
}

function phaseActionForStatusAction(action: ProjectPhaseStatusAction): PhaseAction {
  if (action === 'COMPLETE') return 'PHASE_COMPLETE';
  if (action === 'REOPEN') return 'PHASE_REOPEN';
  if (action === 'SKIP') return 'PHASE_SKIP';
  if (action === 'CANCEL') return 'PHASE_CANCEL';
  if (action === 'OVERRIDE_LOCK') return 'PHASE_OVERRIDE_LOCK';
  return 'PHASE_TRANSITION';
}

function normalizePhaseStatus(value: string | null): ProjectPhaseStatus {
  if (!isProjectPhaseStatus(value)) {
    throw phaseMutationError({
      status: 409,
      message: 'Trạng thái giai đoạn hiện tại chưa tương thích với mutation mới.',
      safeDetails: { incompatible_phase_status: value ?? 'null' },
    });
  }

  return value;
}

async function assertPhaseStatusSchemaReady() {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('phase_status_history').select('id').limit(1);
  if (error) {
    throw phaseMutationError({
      status: 409,
      message: 'LIVE_APPROVAL_REQUIRED: bảng lịch sử trạng thái giai đoạn chưa sẵn sàng.',
      safeDetails: {
        live_approval_required: true,
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }
}

async function loadPhaseStatusContext(projectId: number, phaseId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('phases')
    .select('id, project_id, status, order_index')
    .eq('project_id', projectId)
    .order('order_index', { ascending: true });

  if (error) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể tải trạng thái giai đoạn.',
      safeDetails: { supabase_error_code: error.code ?? 'unknown' },
    });
  }

  const phases = ((data || []) as PhaseStatusRow[]).map((phase) => ({
    id: Number(phase.id),
    project_id: phase.project_id === null ? null : Number(phase.project_id),
    status: normalizePhaseStatus(phase.status),
    order_index: Number(phase.order_index ?? 0),
  }));
  const index = phases.findIndex((phase) => phase.id === phaseId);
  if (index === -1) {
    throw phaseMutationError({
      status: 404,
      message: 'Không tìm thấy giai đoạn.',
    });
  }

  return {
    phase: phases[index],
    previousPhase: phases[index - 1] ?? null,
    nextPhase: phases[index + 1] ?? null,
  };
}

async function loadPhaseTaskCompletion(projectId: number, phaseId: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('tasks')
    .select('id, status')
    .eq('project_id', projectId)
    .eq('phase_id', phaseId);

  if (error) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể kiểm tra công việc trong giai đoạn.',
      safeDetails: { supabase_error_code: error.code ?? 'unknown' },
    });
  }

  const activeTasks = (data || []).filter((task) => String(task.status || '').toUpperCase() !== 'CANCELLED');
  const completedTaskCount = activeTasks.filter((task) => {
    const status = String(task.status || '').toUpperCase();
    return status === 'COMPLETED' || status === 'APPROVED';
  }).length;

  return {
    taskCount: activeTasks.length,
    completedTaskCount,
  };
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
    .insert([{
      project_id: projectId,
      name: phaseName,
      order_index: orderIndex,
      colorway_name: optionalTextField(body, 'colorwayName'),
      colorway_code: optionalTextField(body, 'colorwayCode'),
      stage_type: optionalTextField(body, 'stageType'),
      stage_owner: optionalTextField(body, 'stageOwner'),
      planned_start_date: optionalDateField(body, 'plannedStartDate'),
      planned_end_date: optionalDateField(body, 'plannedEndDate'),
      progress: optionalProgress(body),
      next_action: optionalTextField(body, 'nextAction'),
      required_review: optionalBooleanField(body, 'requiredReview'),
    }])
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

export async function updatePhaseStatus(
  rawProjectId: string,
  rawPhaseId: string,
  body: PhaseMutationBody
): Promise<PhaseStatusMutationResult> {
  assertKnownFields(body, UPDATE_PHASE_STATUS_KEYS);

  const projectId = numericProjectId(rawProjectId);
  const phaseId = numericPhaseId(rawPhaseId);
  const action = requiredPhaseStatusAction(body);
  const reason = requiredReason(body);
  const note = optionalNote(body);
  const expectedCurrentStatus = expectedStatus(body);
  const phaseAction = phaseActionForStatusAction(action);
  const auth = await requirePhaseMutationAccess({ projectId, phaseId, action: phaseAction });

  assertPhaseStatusMutationEnabled();
  await assertPhaseStatusSchemaReady();

  const supabase = createSupabaseAdminClient();
  const { phase, previousPhase, nextPhase } = await loadPhaseStatusContext(projectId, phaseId);
  const taskCompletion = await loadPhaseTaskCompletion(projectId, phaseId);
  if (expectedCurrentStatus && phase.status !== expectedCurrentStatus) {
    throw phaseMutationError({
      status: 409,
      message: 'Trạng thái giai đoạn đã thay đổi. Vui lòng tải lại trước khi thao tác.',
      safeDetails: {
        expected_status: expectedCurrentStatus,
        current_status: phase.status,
      },
    });
  }

  const nextStatus = nextProjectPhaseStatus({
    currentStatus: phase.status,
    action,
    previousPhaseStatus: previousPhase?.status ?? null,
    nextPhaseStatus: nextPhase?.status ?? null,
    taskCount: taskCompletion.taskCount,
    completedTaskCount: taskCompletion.completedTaskCount,
    override: action === 'OVERRIDE_LOCK',
  });

  if (!nextStatus) {
    throw phaseMutationError({
      status: 422,
      message: 'Chuyển trạng thái giai đoạn không hợp lệ.',
      safeDetails: {
        current_status: phase.status,
        action,
      },
    });
  }

  const { error: rpcError } = await supabase.rpc('transition_project_phase_status', {
    p_project_id: projectId,
    p_phase_id: phaseId,
    p_actor_employee_id: auth.actorEmployeeId,
    p_action: action,
    p_old_status: phase.status,
    p_new_status: nextStatus,
    p_reason: reason,
    p_note: note,
    p_override_flag: action === 'OVERRIDE_LOCK',
  });

  if (rpcError) {
    throw phaseMutationError({
      status: 500,
      message: 'Không thể lưu trạng thái và lịch sử giai đoạn.',
      safeDetails: { supabase_error_code: rpcError.code ?? 'unknown' },
    });
  }

  return {
    success: true,
    phaseId,
    status: nextStatus,
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
    .select('id, project_id, name, order_index, created_at, status, colorway_name, colorway_code, stage_type, stage_owner, planned_start_date, planned_end_date, progress, next_action, required_review')
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
      status: phase.status || null,
      colorway_name: phase.colorway_name || null,
      colorway_code: phase.colorway_code || null,
      stage_type: phase.stage_type || null,
      stage_owner: phase.stage_owner || null,
      planned_start_date: phase.planned_start_date || null,
      planned_end_date: phase.planned_end_date || null,
      progress: phase.progress === null ? null : Number(phase.progress),
      next_action: phase.next_action || null,
      required_review: phase.required_review === null ? null : Boolean(phase.required_review),
    })),
  };
}
