import { describe, expect, it } from 'vitest';
import {
  ARTISAN_KEYCAP_WORKFLOW_TEMPLATE,
  activateProductionStage,
  approveProductionStageReview,
  assignProductionTask,
  buildProductionDetailStructure,
  calculateProductionProgress,
  completeProductionStage,
  createProductionOrderAtomically,
  overrideProductionStage,
  previewProductionOrder,
  summarizeProductionOrders,
  type ProductionOrderCreateInput,
} from '../lib/production-order-workflow';

function input(): ProductionOrderCreateInput {
  return {
    source: 'TEMPLATE',
    productionOrderId: 'po_001',
    productionCode: 'LF-AK-001',
    productOrCollection: 'Artisan Keycap',
    colorway: 'Midnight Bloom',
    projectId: 10,
    plannedQuantity: 40,
    targetCompletionDate: '2026-08-15',
    projectManagerEmployeeId: 1,
    creativeLeadEmployeeId: 2,
    members: [
      { employeeId: 1, role: 'PROJECT_MANAGER', active: true },
      { employeeId: 2, role: 'CREATIVE_LEAD', active: true },
      { employeeId: 3, role: 'MEMBER', active: true },
    ],
    template: ARTISAN_KEYCAP_WORKFLOW_TEMPLATE,
  };
}

describe('production order workflow', () => {
  it('previews reusable template stages and tasks without hardcoding UI state', () => {
    const draft = previewProductionOrder(input());
    expect(draft.productionOrderId).toBe('po_001');
    expect(draft.productionCode).toBe('LF-AK-001');
    expect(draft.stages).toHaveLength(12);
    expect(draft.stages[0].status).toBe('READY');
    expect(draft.stages[1].status).toBe('LOCKED');
    expect(draft.tasks.every((task) => task.id.includes(':'))).toBe(true);
  });

  it('creates atomically through the approved adapter and rejects duplicate production codes', async () => {
    const calls: string[] = [];
    await expect(createProductionOrderAtomically(input(), {
      existingProductionCodes: async () => ['LF-AK-000'],
      createAtomically: async (order) => {
        calls.push(order.productionCode);
        return { success: true, productionOrderId: order.productionOrderId };
      },
    })).resolves.toEqual({ success: true, productionOrderId: 'po_001' });
    expect(calls).toEqual(['LF-AK-001']);

    await expect(createProductionOrderAtomically(input(), {
      existingProductionCodes: async () => ['lf-ak-001'],
      createAtomically: async () => {
        throw new Error('must not persist partial rows');
      },
    })).rejects.toMatchObject({ code: 'duplicate_production_code' });
  });

  it('enforces sequential stage gating, review requirements, required tasks and duplicate active-stage prevention', () => {
    let draft = previewProductionOrder(input());
    expect(() => activateProductionStage(draft, 'sculpt', 1)).toThrow(/sẵn sàng/);
    draft = activateProductionStage(draft, 'concept', 1);
    expect(() => activateProductionStage({ ...draft, stages: draft.stages.map((stage) => stage.id === 'sculpt' ? { ...stage, status: 'READY' } : stage) }, 'sculpt', 1)).toThrow(/một giai đoạn/);
    expect(() => completeProductionStage(draft, 'concept', 1)).toThrow(/bắt buộc/);
    draft = { ...draft, tasks: draft.tasks.map((task) => task.stageId === 'concept' ? { ...task, status: 'COMPLETED' } : task) };
    expect(() => completeProductionStage(draft, 'concept', 1)).toThrow(/duyệt/);
    draft = approveProductionStageReview(draft, 'concept');
    draft = completeProductionStage(draft, 'concept', 1);
    expect(draft.stages.find((stage) => stage.id === 'concept')?.status).toBe('COMPLETED');
    expect(draft.stages.find((stage) => stage.id === 'sculpt')?.status).toBe('READY');
  });

  it('prevents locked-stage edits and requires active project-member assignees', () => {
    const draft = previewProductionOrder(input());
    expect(() => assignProductionTask(draft, 'sculpt:sculpt-task', 3)).toThrow(/đang khóa/);
    expect(() => assignProductionTask(draft, 'concept:concept-task', 99)).toThrow(/thành viên/);
    const assigned = assignProductionTask(draft, 'concept:concept-task', 3);
    expect(assigned.tasks.find((task) => task.id === 'concept:concept-task')?.assigneeEmployeeId).toBe(3);
  });

  it('requires an authorized override reason and calculates progress', () => {
    let draft = previewProductionOrder(input());
    expect(() => overrideProductionStage(draft, 'concept', '', 1)).toThrow(/lý do/);
    draft = overrideProductionStage(draft, 'concept', 'Bỏ qua theo duyệt mẫu cũ', 1);
    expect(draft.stages[0].status).toBe('SKIPPED_WITH_APPROVAL');
    expect(calculateProductionProgress(draft)).toBe(8);
  });

  it('summarizes blocked, overdue, quantity and de-duplicates notifications', () => {
    let draft = previewProductionOrder(input());
    draft = { ...draft, status: 'BLOCKED', targetCompletionDate: '2026-01-01', completedQuantity: 12, stages: draft.stages.map((stage, index) => index === 0 ? { ...stage, status: 'BLOCKED' } : stage) };
    const summary = summarizeProductionOrders([draft], new Date('2026-07-22T00:00:00Z'));
    expect(summary.blockedOrders).toBe(1);
    expect(summary.overdueOrders).toBe(1);
    expect(summary.plannedQuantity).toBe(40);
    expect(summary.completedQuantity).toBe(12);

    let active = activateProductionStage(previewProductionOrder(input()), 'concept', 1);
    active = { ...active, tasks: active.tasks.map((task) => task.stageId === 'concept' ? { ...task, status: 'COMPLETED' } : task) };
    active = approveProductionStageReview(active, 'concept');
    active = completeProductionStage(active, 'concept', 1);
    active = completeProductionStage({ ...active, stages: active.stages.map((stage) => stage.id === 'concept' ? { ...stage, status: 'PENDING_REVIEW' } : stage) }, 'concept', 1);
    expect(active.notifications.filter((notification) => notification.key === 'stage-completed:concept')).toHaveLength(1);
  });

  it('keeps production detail mobile structure readable instead of spreadsheet-like', () => {
    const structure = buildProductionDetailStructure(previewProductionOrder(input()));
    expect(structure.avoidsSpreadsheetOnMobile).toBe(true);
    expect(structure.mobileSections).toContain('Giai đoạn hiện tại');
    expect(structure.mobileSections.length).toBeLessThan(structure.desktopSections.length + 2);
  });
});
