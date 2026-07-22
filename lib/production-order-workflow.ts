export type ProductionOrderStatus =
  | 'DRAFT'
  | 'NOT_STARTED'
  | 'PREPARING'
  | 'IN_PRODUCTION'
  | 'PENDING_REVIEW'
  | 'ON_HOLD'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'CANCELLED';

export type ProductionStageStatus =
  | 'LOCKED'
  | 'READY'
  | 'IN_PROGRESS'
  | 'PENDING_REVIEW'
  | 'COMPLETED'
  | 'ON_HOLD'
  | 'BLOCKED'
  | 'SKIPPED_WITH_APPROVAL';

export type ProductionPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
export type ProductionTaskStatus = 'BACKLOG' | 'READY' | 'IN_PROGRESS' | 'PENDING_REVIEW' | 'REVISION_REQUIRED' | 'APPROVED' | 'BLOCKED' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED';
export type ProductionCreationSource = 'BLANK' | 'TEMPLATE' | 'CLONE';

export const PRODUCTION_ORDER_STATUS_LABELS: Record<ProductionOrderStatus, string> = {
  DRAFT: 'Bản nháp',
  NOT_STARTED: 'Chưa bắt đầu',
  PREPARING: 'Đang chuẩn bị',
  IN_PRODUCTION: 'Đang sản xuất',
  PENDING_REVIEW: 'Chờ duyệt',
  ON_HOLD: 'Tạm dừng',
  BLOCKED: 'Bị vướng',
  COMPLETED: 'Hoàn thành',
  CANCELLED: 'Đã hủy',
};

export const PRODUCTION_STAGE_STATUS_LABELS: Record<ProductionStageStatus, string> = {
  LOCKED: 'Khóa',
  READY: 'Sẵn sàng',
  IN_PROGRESS: 'Đang thực hiện',
  PENDING_REVIEW: 'Chờ duyệt',
  COMPLETED: 'Hoàn thành',
  ON_HOLD: 'Tạm dừng',
  BLOCKED: 'Bị vướng',
  SKIPPED_WITH_APPROVAL: 'Bỏ qua có duyệt',
};

export interface ProductionTemplateTask {
  id: string;
  name: string;
  required?: boolean;
  defaultAssigneeRole?: string;
  defaultDurationDays?: number;
}

export interface ProductionWorkflowTemplateStage {
  id: string;
  name: string;
  order: number;
  requiredRole?: string;
  defaultDurationDays?: number;
  completionRequirements: string[];
  requiresReview?: boolean;
  dependsOnPrevious?: boolean;
  tasks: ProductionTemplateTask[];
}

export interface ProductionWorkflowTemplate {
  id: string;
  name: string;
  approved: boolean;
  sequential: boolean;
  stages: ProductionWorkflowTemplateStage[];
}

export interface ProductionMember {
  employeeId: number;
  role: 'PROJECT_MANAGER' | 'CREATIVE_LEAD' | 'MEMBER' | 'REVIEWER';
  active: boolean;
}

export interface ProductionTask {
  id: string;
  name: string;
  stageId: string;
  assigneeEmployeeId?: number | null;
  deadline?: string | null;
  priority: ProductionPriority;
  status: ProductionTaskStatus;
  progress: number;
  required: boolean;
  dependencyTaskIds: string[];
  comments: string[];
  attachments: string[];
  activity: string[];
  reviewOutcome?: 'APPROVED' | 'REVISION_REQUIRED' | 'REJECTED' | null;
}

export interface ProductionStage {
  id: string;
  name: string;
  order: number;
  status: ProductionStageStatus;
  requiresReview: boolean;
  reviewApproved: boolean;
  dependsOnPrevious: boolean;
  requiredRole?: string;
  taskIds: string[];
  activatedByEmployeeId?: number | null;
  completedByEmployeeId?: number | null;
  overrideReason?: string | null;
}

export interface ProductionOrderDraft {
  productionOrderId: string;
  productionCode: string;
  productOrCollection: string;
  colorway: string;
  projectId: number;
  plannedQuantity: number;
  completedQuantity: number;
  targetCompletionDate: string;
  priority: ProductionPriority;
  status: ProductionOrderStatus;
  currentStageId?: string | null;
  projectManagerEmployeeId: number;
  creativeLeadEmployeeId: number;
  members: ProductionMember[];
  stages: ProductionStage[];
  tasks: ProductionTask[];
  productionNotes: string;
  attachments: string[];
  activityHistory: string[];
  materialRequirements: Array<{ materialId: string; name: string; plannedQuantity: number; unit: string }>;
  notifications: Array<{ key: string; type: string; employeeId?: number; entityId: string }>;
}

export interface ProductionOrderCreateInput {
  source: ProductionCreationSource;
  productionOrderId: string;
  productionCode: string;
  productOrCollection: string;
  colorway: string;
  projectId: number;
  plannedQuantity: number;
  targetCompletionDate: string;
  priority?: ProductionPriority;
  projectManagerEmployeeId: number;
  creativeLeadEmployeeId: number;
  members: ProductionMember[];
  template?: ProductionWorkflowTemplate;
  clonedOrder?: ProductionOrderDraft;
  productionNotes?: string;
}

export class ProductionWorkflowError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = 'ProductionWorkflowError';
  }
}

export const ARTISAN_KEYCAP_WORKFLOW_TEMPLATE: ProductionWorkflowTemplate = {
  id: 'artisan-keycap-v1',
  name: 'Quy trình artisan keycap',
  approved: true,
  sequential: true,
  stages: ([
    ['concept', 'Ý tưởng', ['Chốt câu chuyện màu'], true],
    ['sculpt', 'Dựng mẫu 3D', ['Hoàn tất file sculpt'], true],
    ['color', 'Lên màu', ['Chốt công thức màu'], true],
    ['support-print', 'Support và thiết lập in', ['File in sẵn sàng'], false],
    ['test-print', 'In thử', ['Mẫu in thử đạt yêu cầu'], true],
    ['master-finish', 'Hoàn thiện master', ['Master sạch lỗi'], true],
    ['mold', 'Làm khuôn', ['Khuôn đạt kiểm tra'], true],
    ['casting', 'Đúc resin', ['Đúc đủ số lượng kế hoạch'], false],
    ['finishing-qc', 'Hoàn thiện và QC', ['QC đạt'], true],
    ['content', 'Ảnh và nội dung', ['Ảnh và nội dung sẵn sàng'], true],
    ['packaging', 'Đóng gói', ['Đủ vật tư đóng gói'], false],
    ['shipping-prep', 'Chuẩn bị giao hàng', ['Danh sách giao hàng sẵn sàng'], false],
  ] as const).map(([id, name, requirement, requiresReview], index) => ({
    id: String(id),
    name: String(name),
    order: index + 1,
    defaultDurationDays: index < 3 ? 3 : 2,
    completionRequirements: [...requirement],
    requiresReview: Boolean(requiresReview),
    dependsOnPrevious: index > 0,
    tasks: [{ id: `${id}-task`, name: String(requirement[0]), required: true }],
  })),
};

function assertUniqueStageOrder(stages: ProductionWorkflowTemplateStage[]) {
  const orders = new Set<number>();
  stages.forEach((stage) => {
    if (orders.has(stage.order)) throw new ProductionWorkflowError('invalid_stage_order', 'Thứ tự giai đoạn không hợp lệ.');
    orders.add(stage.order);
  });
}

export function previewProductionOrder(input: ProductionOrderCreateInput): ProductionOrderDraft {
  const productionCode = input.productionCode.trim();
  if (!productionCode) throw new ProductionWorkflowError('production_code_required', 'Vui lòng nhập mã sản xuất.');
  if (input.plannedQuantity <= 0) throw new ProductionWorkflowError('planned_quantity_invalid', 'Số lượng kế hoạch không hợp lệ.');
  if (!input.members.some((member) => member.active && member.employeeId === input.projectManagerEmployeeId)) throw new ProductionWorkflowError('manager_membership_required', 'Quản lý phải là thành viên đang hoạt động.');
  if (!input.members.some((member) => member.active && member.employeeId === input.creativeLeadEmployeeId)) throw new ProductionWorkflowError('creative_lead_membership_required', 'Creative lead phải là thành viên đang hoạt động.');

  const template = input.source === 'CLONE' && input.clonedOrder
    ? orderToTemplate(input.clonedOrder)
    : input.template || { id: 'blank', name: 'Quy trình trống', approved: true, sequential: true, stages: [] };
  if (!template.approved) throw new ProductionWorkflowError('workflow_template_not_approved', 'Mẫu quy trình chưa được duyệt.');
  assertUniqueStageOrder(template.stages);

  const sortedStages = [...template.stages].sort((left, right) => left.order - right.order);
  const tasks: ProductionTask[] = [];
  const stages = sortedStages.map((stage, stageIndex): ProductionStage => {
    const taskIds = stage.tasks.map((task) => `${stage.id}:${task.id}`);
    stage.tasks.forEach((task) => tasks.push({
      id: `${stage.id}:${task.id}`,
      name: task.name,
      stageId: stage.id,
      assigneeEmployeeId: null,
      deadline: null,
      priority: input.priority || 'NORMAL',
      status: stageIndex === 0 ? 'READY' : 'BACKLOG',
      progress: 0,
      required: task.required ?? true,
      dependencyTaskIds: [],
      comments: [],
      attachments: [],
      activity: ['Tạo từ mẫu quy trình'],
      reviewOutcome: null,
    }));
    return {
      id: stage.id,
      name: stage.name,
      order: stage.order,
      status: stageIndex === 0 ? 'READY' : 'LOCKED',
      requiresReview: stage.requiresReview ?? false,
      reviewApproved: false,
      dependsOnPrevious: stage.dependsOnPrevious ?? stageIndex > 0,
      requiredRole: stage.requiredRole,
      taskIds,
      activatedByEmployeeId: null,
      completedByEmployeeId: null,
      overrideReason: null,
    };
  });

  return {
    productionOrderId: input.productionOrderId,
    productionCode,
    productOrCollection: input.productOrCollection.trim(),
    colorway: input.colorway.trim(),
    projectId: input.projectId,
    plannedQuantity: input.plannedQuantity,
    completedQuantity: 0,
    targetCompletionDate: input.targetCompletionDate,
    priority: input.priority || 'NORMAL',
    status: 'NOT_STARTED',
    currentStageId: stages[0]?.id || null,
    projectManagerEmployeeId: input.projectManagerEmployeeId,
    creativeLeadEmployeeId: input.creativeLeadEmployeeId,
    members: input.members,
    stages,
    tasks,
    productionNotes: input.productionNotes || '',
    attachments: [],
    activityHistory: ['Tạo lệnh sản xuất'],
    materialRequirements: [],
    notifications: [],
  };
}

function orderToTemplate(order: ProductionOrderDraft): ProductionWorkflowTemplate {
  return {
    id: `clone-${order.productionOrderId}`,
    name: `Sao chép ${order.productionCode}`,
    approved: true,
    sequential: true,
    stages: order.stages.map((stage) => ({
      id: stage.id,
      name: stage.name,
      order: stage.order,
      requiredRole: stage.requiredRole,
      completionRequirements: [],
      requiresReview: stage.requiresReview,
      dependsOnPrevious: stage.dependsOnPrevious,
      tasks: order.tasks.filter((task) => task.stageId === stage.id).map((task) => ({ id: task.id.split(':').pop() || task.id, name: task.name, required: task.required })),
    })),
  };
}

export function assertProductionCodeAvailable(existingCodes: readonly string[], productionCode: string) {
  if (existingCodes.map((code) => code.trim().toUpperCase()).includes(productionCode.trim().toUpperCase())) {
    throw new ProductionWorkflowError('duplicate_production_code', 'Mã sản xuất đã tồn tại.');
  }
}

export function assignProductionTask(order: ProductionOrderDraft, taskId: string, employeeId: number): ProductionOrderDraft {
  if (!order.members.some((member) => member.active && member.employeeId === employeeId)) throw new ProductionWorkflowError('assignee_not_project_member', 'Người nhận việc phải là thành viên dự án đang hoạt động.');
  const task = order.tasks.find((candidate) => candidate.id === taskId);
  if (!task) throw new ProductionWorkflowError('task_not_found', 'Không tìm thấy công việc.');
  const stage = order.stages.find((candidate) => candidate.id === task.stageId);
  if (!stage || stage.status === 'LOCKED') throw new ProductionWorkflowError('locked_stage_edit_forbidden', 'Không thể sửa giai đoạn đang khóa.');
  return updateTask(order, taskId, { assigneeEmployeeId: employeeId }, `Giao việc cho nhân sự #${employeeId}`);
}

function updateTask(order: ProductionOrderDraft, taskId: string, patch: Partial<ProductionTask>, activity: string): ProductionOrderDraft {
  return {
    ...order,
    tasks: order.tasks.map((task) => task.id === taskId ? { ...task, ...patch, activity: [...task.activity, activity] } : task),
    activityHistory: [...order.activityHistory, activity],
  };
}

export function completeProductionStage(order: ProductionOrderDraft, stageId: string, actorEmployeeId: number): ProductionOrderDraft {
  const stageIndex = order.stages.findIndex((stage) => stage.id === stageId);
  const stage = order.stages[stageIndex];
  if (!stage) throw new ProductionWorkflowError('stage_not_found', 'Không tìm thấy giai đoạn.');
  if (stage.status !== 'IN_PROGRESS' && stage.status !== 'PENDING_REVIEW') throw new ProductionWorkflowError('invalid_stage_transition', 'Chuyển trạng thái giai đoạn không hợp lệ.');
  const stageTasks = order.tasks.filter((task) => task.stageId === stageId);
  if (stageTasks.some((task) => task.required && task.status !== 'COMPLETED' && task.status !== 'APPROVED')) throw new ProductionWorkflowError('required_tasks_unfinished', 'Cần hoàn thành công việc bắt buộc trước khi đóng giai đoạn.');
  if (stage.requiresReview && !stage.reviewApproved) throw new ProductionWorkflowError('stage_review_required', 'Giai đoạn cần được duyệt trước khi hoàn thành.');

  const nextStage = order.stages[stageIndex + 1];
  return {
    ...order,
    status: nextStage ? 'IN_PRODUCTION' : 'COMPLETED',
    currentStageId: nextStage?.id || stage.id,
    stages: order.stages.map((candidate, index) => {
      if (candidate.id === stageId) return { ...candidate, status: 'COMPLETED', completedByEmployeeId: actorEmployeeId };
      if (index === stageIndex + 1 && candidate.status === 'LOCKED') return { ...candidate, status: 'READY' };
      return candidate;
    }),
    activityHistory: [...order.activityHistory, `Hoàn thành giai đoạn ${stage.name}`],
    notifications: addNotification(order.notifications, { key: `stage-completed:${stageId}`, type: 'stage_completed', entityId: stageId }),
  };
}

export function activateProductionStage(order: ProductionOrderDraft, stageId: string, actorEmployeeId: number): ProductionOrderDraft {
  const stage = order.stages.find((candidate) => candidate.id === stageId);
  if (!stage) throw new ProductionWorkflowError('stage_not_found', 'Không tìm thấy giai đoạn.');
  if (stage.status !== 'READY') throw new ProductionWorkflowError('invalid_stage_transition', 'Chỉ giai đoạn sẵn sàng mới được kích hoạt.');
  if (order.stages.some((candidate) => candidate.status === 'IN_PROGRESS')) throw new ProductionWorkflowError('duplicate_active_stage', 'Chỉ được có một giai đoạn đang thực hiện.');
  return {
    ...order,
    status: 'IN_PRODUCTION',
    currentStageId: stageId,
    stages: order.stages.map((candidate) => candidate.id === stageId ? { ...candidate, status: 'IN_PROGRESS', activatedByEmployeeId: actorEmployeeId } : candidate),
    activityHistory: [...order.activityHistory, `Kích hoạt giai đoạn ${stage.name}`],
    notifications: addNotification(order.notifications, { key: `stage-ready:${stageId}`, type: 'stage_ready', entityId: stageId }),
  };
}

export function approveProductionStageReview(order: ProductionOrderDraft, stageId: string): ProductionOrderDraft {
  return {
    ...order,
    stages: order.stages.map((stage) => stage.id === stageId ? { ...stage, reviewApproved: true } : stage),
    activityHistory: [...order.activityHistory, 'Duyệt kết quả giai đoạn'],
  };
}

export function overrideProductionStage(order: ProductionOrderDraft, stageId: string, reason: string, actorEmployeeId: number): ProductionOrderDraft {
  if (!reason.trim()) throw new ProductionWorkflowError('override_reason_required', 'Cần nhập lý do ghi đè.');
  return {
    ...order,
    stages: order.stages.map((stage) => stage.id === stageId ? { ...stage, status: 'SKIPPED_WITH_APPROVAL', overrideReason: reason.trim(), completedByEmployeeId: actorEmployeeId } : stage),
    activityHistory: [...order.activityHistory, `Bỏ qua có duyệt: ${reason.trim()}`],
  };
}

function addNotification<T extends { key: string }>(notifications: T[], notification: T): T[] {
  if (notifications.some((candidate) => candidate.key === notification.key)) return notifications;
  return [...notifications, notification];
}

export function calculateProductionProgress(order: ProductionOrderDraft): number {
  if (order.stages.length === 0) return 0;
  const completed = order.stages.filter((stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED_WITH_APPROVAL').length;
  return Math.round((completed / order.stages.length) * 100);
}

export function summarizeProductionOrders(orders: readonly ProductionOrderDraft[], now = new Date()) {
  const month = now.getUTCMonth();
  const year = now.getUTCFullYear();
  return {
    totalProductionOrders: orders.length,
    activeOrders: orders.filter((order) => ['PREPARING', 'IN_PRODUCTION', 'PENDING_REVIEW'].includes(order.status)).length,
    overdueOrders: orders.filter((order) => !['COMPLETED', 'CANCELLED'].includes(order.status) && new Date(order.targetCompletionDate).getTime() < now.getTime()).length,
    blockedOrders: orders.filter((order) => order.status === 'BLOCKED' || order.stages.some((stage) => stage.status === 'BLOCKED')).length,
    completedThisMonth: orders.filter((order) => order.status === 'COMPLETED' && order.activityHistory.some((activity) => activity.includes(`${year}-${String(month + 1).padStart(2, '0')}`))).length,
    plannedQuantity: orders.reduce((sum, order) => sum + order.plannedQuantity, 0),
    completedQuantity: orders.reduce((sum, order) => sum + order.completedQuantity, 0),
    stageBottlenecks: orders.flatMap((order) => order.stages.filter((stage) => stage.status === 'BLOCKED').map((stage) => stage.name)),
  };
}

export function buildProductionDetailStructure(order: ProductionOrderDraft) {
  return {
    summary: ['productionCode', 'productOrCollection', 'colorway', 'plannedQuantity', 'targetCompletionDate', 'status'],
    desktopSections: ['Tóm tắt', 'Timeline giai đoạn', 'Công việc', 'Vật tư', 'Hoạt động'],
    mobileSections: ['Tóm tắt', 'Giai đoạn hiện tại', 'Việc cần làm', 'Bị vướng', 'Ghi chú'],
    avoidsSpreadsheetOnMobile: true,
    currentStage: order.stages.find((stage) => stage.id === order.currentStageId) || null,
  };
}

export interface ProductionOrderPersistenceAdapter {
  existingProductionCodes(): Promise<readonly string[]>;
  createAtomically(order: ProductionOrderDraft): Promise<{ success: true; productionOrderId: string }>;
}

export async function createProductionOrderAtomically(input: ProductionOrderCreateInput, adapter: ProductionOrderPersistenceAdapter) {
  const draft = previewProductionOrder(input);
  assertProductionCodeAvailable(await adapter.existingProductionCodes(), draft.productionCode);
  return adapter.createAtomically(draft);
}
