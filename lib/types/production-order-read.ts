import type {
  ProductionOrderStatus,
  ProductionPriority,
  ProductionStageStatus,
} from '@/lib/production-order-workflow';

export interface ProductionOrderSummary {
  productionOrderId: string;
  productionCode: string;
  displayName: string | null;
  projectId: number;
  projectName: string;
  productOrCollection: string;
  colorway: string;
  plannedQuantity: number;
  completedQuantity: number;
  priority: ProductionPriority;
  status: ProductionOrderStatus;
  currentStageId: string | null;
  currentStageName: string | null;
  targetCompletionDate: string | null;
  updatedAt: string;
}

export interface ProductionOrderStageReadModel {
  stageId: string;
  stageKey: string;
  name: string;
  sequence: number;
  status: ProductionStageStatus;
  phaseId: number | null;
  progress: number;
  requiresReview: boolean;
  reviewStatus: string;
}

export interface ProductionOrderDetail extends ProductionOrderSummary {
  stages: ProductionOrderStageReadModel[];
  activeMemberCount: number;
  materialRequirementCount: number;
  createdAt: string;
}

export interface ProductionOrderListResponse {
  success: true;
  orders: ProductionOrderSummary[];
  capabilities: {
    canCreate: boolean;
  };
  generatedAt: string;
}

export interface ProductionOrderDetailResponse {
  success: true;
  order: ProductionOrderDetail;
}

export interface ProductionOrderCreateMemberOption {
  employeeId: number;
  fullName: string;
  title: string | null;
  roleCode: 'PROJECT_OWNER' | 'PROJECT_MANAGER' | 'CREATIVE_LEAD' | 'CONTRIBUTOR';
}

export interface ProductionOrderCreateProjectOption {
  projectId: number;
  projectCode: string;
  projectName: string;
  status: string;
  members: ProductionOrderCreateMemberOption[];
}

export interface ProductionOrderCreateContextResponse {
  success: true;
  workflow: {
    name: string;
    stageCount: number;
  };
  projects: ProductionOrderCreateProjectOption[];
}
