import {
  ARTISAN_KEYCAP_WORKFLOW_TEMPLATE,
  type ProductionPriority,
  type ProductionWorkflowTemplate,
} from './production-order-workflow';

export const PRODUCTION_ORDER_MUTATIONS_FLAG = 'PRODUCTION_ORDER_MUTATIONS_ENABLED';

const CREATE_FIELDS = new Set([
  'productionCode',
  'displayName',
  'projectId',
  'productOrCollection',
  'colorway',
  'plannedQuantity',
  'targetCompletionDate',
  'priority',
  'projectManagerEmployeeId',
  'creativeLeadEmployeeId',
]);

const PRIORITIES = new Set<ProductionPriority>(['LOW', 'NORMAL', 'HIGH', 'URGENT']);
const PRODUCTION_CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export interface ProductionOrderCreateRequest {
  productionCode: string;
  displayName: string | null;
  projectId: number;
  productOrCollection: string;
  colorway: string;
  plannedQuantity: number;
  targetCompletionDate: string;
  priority: ProductionPriority;
  projectManagerEmployeeId: number;
  creativeLeadEmployeeId: number;
}

export interface ProductionOrderRpcMember {
  employeeId: number;
  role: 'PROJECT_MANAGER' | 'CREATIVE_LEAD' | 'MEMBER';
  active: true;
}

export interface ProductionOrderRpcPayload extends ProductionOrderCreateRequest {
  members: ProductionOrderRpcMember[];
  stages: Array<{
    stageKey: string;
    name: string;
    sequence: number;
    requiresReview: boolean;
    tasks: Array<{ title: string }>;
  }>;
}

export class ProductionOrderCreateValidationError extends Error {
  constructor(public field: string | null, message: string) {
    super(message);
    this.name = 'ProductionOrderCreateValidationError';
  }
}

function text(value: unknown, field: string, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProductionOrderCreateValidationError(field, `Vui lòng nhập ${label}.`);
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new ProductionOrderCreateValidationError(field, `${label} không được vượt quá ${maxLength} ký tự.`);
  }
  return normalized;
}

function optionalText(value: unknown, field: string, label: string, maxLength: number): string | null {
  if (value === null || value === undefined || value === '') return null;
  return text(value, field, label, maxLength);
}

function positiveInteger(value: unknown, field: string, label: string, maximum = Number.MAX_SAFE_INTEGER): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > maximum) {
    throw new ProductionOrderCreateValidationError(field, `${label} không hợp lệ.`);
  }
  return parsed;
}

function isoDate(value: unknown): string {
  const normalized = text(value, 'targetCompletionDate', 'hạn hoàn thành', 10);
  if (!ISO_DATE_PATTERN.test(normalized)) {
    throw new ProductionOrderCreateValidationError('targetCompletionDate', 'Hạn hoàn thành không hợp lệ.');
  }
  const parsed = new Date(`${normalized}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== normalized) {
    throw new ProductionOrderCreateValidationError('targetCompletionDate', 'Hạn hoàn thành không hợp lệ.');
  }
  if (normalized < new Date().toISOString().slice(0, 10)) {
    throw new ProductionOrderCreateValidationError('targetCompletionDate', 'Hạn hoàn thành không được trước ngày hiện tại.');
  }
  return normalized;
}

export function parseProductionOrderCreateRequest(body: Record<string, unknown>): ProductionOrderCreateRequest {
  const unknownField = Object.keys(body).find((key) => !CREATE_FIELDS.has(key));
  if (unknownField) {
    throw new ProductionOrderCreateValidationError(null, 'Dữ liệu tạo lệnh sản xuất có trường không được hỗ trợ.');
  }

  const productionCode = text(body.productionCode, 'productionCode', 'mã sản xuất', 40).toUpperCase();
  if (!PRODUCTION_CODE_PATTERN.test(productionCode)) {
    throw new ProductionOrderCreateValidationError('productionCode', 'Mã sản xuất phải có 3–40 ký tự, chỉ gồm chữ in hoa, số, dấu gạch ngang hoặc gạch dưới.');
  }
  const priority = typeof body.priority === 'string' ? body.priority as ProductionPriority : 'NORMAL';
  if (!PRIORITIES.has(priority)) {
    throw new ProductionOrderCreateValidationError('priority', 'Mức ưu tiên không hợp lệ.');
  }

  return {
    productionCode,
    displayName: optionalText(body.displayName, 'displayName', 'tên hiển thị', 160),
    projectId: positiveInteger(body.projectId, 'projectId', 'Dự án'),
    productOrCollection: text(body.productOrCollection, 'productOrCollection', 'sản phẩm hoặc bộ sưu tập', 160),
    colorway: text(body.colorway, 'colorway', 'mẫu màu', 120),
    plannedQuantity: positiveInteger(body.plannedQuantity, 'plannedQuantity', 'Số lượng kế hoạch', 1_000_000),
    targetCompletionDate: isoDate(body.targetCompletionDate),
    priority,
    projectManagerEmployeeId: positiveInteger(body.projectManagerEmployeeId, 'projectManagerEmployeeId', 'Quản lý dự án'),
    creativeLeadEmployeeId: positiveInteger(body.creativeLeadEmployeeId, 'creativeLeadEmployeeId', 'Creative lead'),
  };
}

export function buildProductionOrderRpcPayload(
  input: ProductionOrderCreateRequest,
  activeEmployeeIds: readonly number[],
  template: ProductionWorkflowTemplate = ARTISAN_KEYCAP_WORKFLOW_TEMPLATE,
): ProductionOrderRpcPayload {
  const members = Array.from(new Set(activeEmployeeIds)).map((employeeId): ProductionOrderRpcMember => ({
    employeeId,
    role: employeeId === input.projectManagerEmployeeId
      ? 'PROJECT_MANAGER'
      : employeeId === input.creativeLeadEmployeeId
        ? 'CREATIVE_LEAD'
        : 'MEMBER',
    active: true,
  }));

  return {
    ...input,
    members,
    stages: [...template.stages]
      .sort((left, right) => left.order - right.order)
      .map((stage) => ({
        stageKey: stage.id,
        name: stage.name,
        sequence: stage.order,
        requiresReview: stage.requiresReview === true,
        tasks: stage.tasks.map((task) => ({ title: task.name })),
      })),
  };
}
