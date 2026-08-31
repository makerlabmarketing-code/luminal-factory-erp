import 'server-only';

import type { PostgrestError } from '@supabase/supabase-js';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import type {
  ProductionOrderStatus,
  ProductionPriority,
  ProductionStageStatus,
} from '@/lib/production-order-workflow';
import type {
  ProductionOrderDetail,
  ProductionOrderStageReadModel,
  ProductionOrderSummary,
} from '@/lib/types/production-order-read';

const ORDER_STATUSES = new Set<ProductionOrderStatus>([
  'DRAFT',
  'NOT_STARTED',
  'PREPARING',
  'IN_PRODUCTION',
  'PENDING_REVIEW',
  'ON_HOLD',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]);

const STAGE_STATUSES = new Set<ProductionStageStatus>([
  'LOCKED',
  'READY',
  'IN_PROGRESS',
  'PENDING_REVIEW',
  'COMPLETED',
  'ON_HOLD',
  'BLOCKED',
  'SKIPPED_WITH_APPROVAL',
]);

const PRIORITIES = new Set<ProductionPriority>(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

interface ProductionOrderListRow {
  production_order_id?: unknown;
  production_code?: unknown;
  display_name?: unknown;
  project_id?: unknown;
  project_name?: unknown;
  product_or_collection?: unknown;
  colorway?: unknown;
  planned_quantity?: unknown;
  completed_quantity?: unknown;
  priority?: unknown;
  status?: unknown;
  current_stage_id?: unknown;
  current_stage_name?: unknown;
  target_completion_date?: unknown;
  updated_at?: unknown;
}

interface ProductionOrderDetailRow extends Omit<ProductionOrderListRow, 'production_order_id' | 'project_name' | 'current_stage_name'> {
  id?: unknown;
  created_at?: unknown;
  stages?: unknown;
  members?: unknown;
  material_requirements?: unknown;
}

interface ProductionStageRow {
  id?: unknown;
  stageKey?: unknown;
  name?: unknown;
  sequence?: unknown;
  status?: unknown;
  phaseId?: unknown;
  progress?: unknown;
  requiresReview?: unknown;
  reviewStatus?: unknown;
}

async function requireProductionOrderView() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const [canViewProjects, canManageProjects] = await Promise.all([
    hasPermission(authContext, 'PROJECT_VIEW'),
    hasPermission(authContext, 'PROJECT_MANAGE'),
  ]);

  if (!canViewProjects && !canManageProjects) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền xem lệnh sản xuất.',
      failureStage: 'permission_check',
      safeDetails: { permission_check_result: 'denied' },
    });
  }
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function nullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function orderStatus(value: unknown): ProductionOrderStatus {
  const status = stringValue(value) as ProductionOrderStatus;
  return ORDER_STATUSES.has(status) ? status : 'NOT_STARTED';
}

function stageStatus(value: unknown): ProductionStageStatus {
  const status = stringValue(value) as ProductionStageStatus;
  return STAGE_STATUSES.has(status) ? status : 'LOCKED';
}

function priority(value: unknown): ProductionPriority {
  const productionPriority = stringValue(value) as ProductionPriority;
  return PRIORITIES.has(productionPriority) ? productionPriority : 'NORMAL';
}

function productionReadError(error: PostgrestError): AuthFlowError {
  return new AuthFlowError({
    status: 503,
    code: 'service_unavailable',
    message: 'Không thể tải dữ liệu sản xuất. Vui lòng thử lại.',
    failureStage: 'unknown',
    safeDetails: { supabase_error_code: error.code || 'unknown' },
  });
}

function mapSummary(row: ProductionOrderListRow): ProductionOrderSummary {
  return {
    productionOrderId: stringValue(row.production_order_id),
    productionCode: stringValue(row.production_code),
    displayName: nullableString(row.display_name),
    projectId: numberValue(row.project_id),
    projectName: stringValue(row.project_name) || 'Dự án chưa đặt tên',
    productOrCollection: stringValue(row.product_or_collection),
    colorway: stringValue(row.colorway),
    plannedQuantity: numberValue(row.planned_quantity),
    completedQuantity: numberValue(row.completed_quantity),
    priority: priority(row.priority),
    status: orderStatus(row.status),
    currentStageId: nullableString(row.current_stage_id),
    currentStageName: nullableString(row.current_stage_name),
    targetCompletionDate: nullableString(row.target_completion_date),
    updatedAt: stringValue(row.updated_at),
  };
}

function mapStages(value: unknown): ProductionOrderStageReadModel[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((stage): ProductionOrderStageReadModel => {
      const row = stage && typeof stage === 'object' ? stage as ProductionStageRow : {};
      return {
        stageId: stringValue(row.id),
        stageKey: stringValue(row.stageKey),
        name: stringValue(row.name) || 'Giai đoạn chưa đặt tên',
        sequence: numberValue(row.sequence),
        status: stageStatus(row.status),
        phaseId: nullableNumber(row.phaseId),
        progress: Math.min(100, Math.max(0, numberValue(row.progress))),
        requiresReview: row.requiresReview === true,
        reviewStatus: stringValue(row.reviewStatus) || 'NOT_SUBMITTED',
      };
    })
    .filter((stage) => stage.stageId)
    .sort((left, right) => left.sequence - right.sequence);
}

export async function getProductionOrders(): Promise<ProductionOrderSummary[]> {
  await requireProductionOrderView();
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('production_order_list_view')
    .select('production_order_id, production_code, display_name, project_id, project_name, product_or_collection, colorway, planned_quantity, completed_quantity, priority, status, current_stage_id, current_stage_name, target_completion_date, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) throw productionReadError(error);
  return ((data || []) as ProductionOrderListRow[]).map(mapSummary);
}

export async function getProductionOrderDetail(productionOrderId: string): Promise<ProductionOrderDetail> {
  await requireProductionOrderView();
  const supabase = await createSupabaseServerClient();
  const [detailResult, listResult] = await Promise.all([
    supabase
      .from('production_order_detail_view')
      .select('id, production_code, display_name, project_id, product_or_collection, colorway, planned_quantity, completed_quantity, priority, status, current_stage_id, target_completion_date, material_requirements, created_at, updated_at, stages, members')
      .eq('id', productionOrderId)
      .maybeSingle(),
    supabase
      .from('production_order_list_view')
      .select('production_order_id, project_name, current_stage_name')
      .eq('production_order_id', productionOrderId)
      .maybeSingle(),
  ]);

  if (detailResult.error) throw productionReadError(detailResult.error);
  if (listResult.error) throw productionReadError(listResult.error);
  if (!detailResult.data || !listResult.data) {
    throw new AuthFlowError({
      status: 404,
      code: 'project_not_found',
      message: 'Không tìm thấy lệnh sản xuất hoặc bạn không có quyền xem.',
      failureStage: 'unknown',
    });
  }

  const detail = detailResult.data as ProductionOrderDetailRow;
  const list = listResult.data as ProductionOrderListRow;
  const summary = mapSummary({
    ...detail,
    production_order_id: detail.id,
    project_name: list.project_name,
    current_stage_name: list.current_stage_name,
  });
  const members = Array.isArray(detail.members) ? detail.members : [];
  const activeMemberCount = members.filter((member) => (
    member && typeof member === 'object' && (member as { active?: unknown }).active === true
  )).length;
  const materialRequirements = Array.isArray(detail.material_requirements) ? detail.material_requirements : [];

  return {
    ...summary,
    stages: mapStages(detail.stages),
    activeMemberCount,
    materialRequirementCount: materialRequirements.length,
    createdAt: stringValue(detail.created_at),
  };
}
