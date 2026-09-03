import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildProductionOrderRpcPayload,
  parseProductionOrderCreateRequest,
} from '../lib/production-order-create';

const root = process.cwd();
const source = (relativePath: string) => fs.readFileSync(path.join(root, relativePath), 'utf8');

function validRequest() {
  return {
    productionCode: 'lf-ak-026',
    displayName: 'Midnight Bloom',
    projectId: 42,
    productOrCollection: 'Artisan Keycap',
    colorway: 'Midnight',
    plannedQuantity: 40,
    targetCompletionDate: '2099-12-20',
    priority: 'HIGH',
    projectManagerEmployeeId: 7,
    creativeLeadEmployeeId: 8,
  };
}

describe('production order create slice', () => {
  it('accepts only bounded business input and normalizes the production code', () => {
    expect(parseProductionOrderCreateRequest(validRequest())).toMatchObject({
      productionCode: 'LF-AK-026',
      plannedQuantity: 40,
      priority: 'HIGH',
    });
    expect(() => parseProductionOrderCreateRequest({ ...validRequest(), status: 'COMPLETED' }))
      .toThrow(/trường không được hỗ trợ/);
    expect(() => parseProductionOrderCreateRequest({ ...validRequest(), completedQuantity: 40 }))
      .toThrow(/trường không được hỗ trợ/);
    expect(() => parseProductionOrderCreateRequest({ ...validRequest(), createdByEmployeeId: 99 }))
      .toThrow(/trường không được hỗ trợ/);
    expect(() => parseProductionOrderCreateRequest({ ...validRequest(), targetCompletionDate: '2020-01-01' }))
      .toThrow(/không được trước ngày hiện tại/);
  });

  it('derives the canonical 12-stage payload and member roles on the server seam', () => {
    const parsed = parseProductionOrderCreateRequest(validRequest());
    const payload = buildProductionOrderRpcPayload(parsed, [7, 8, 9, 9]);
    expect(payload.members).toEqual([
      { employeeId: 7, role: 'PROJECT_MANAGER', active: true },
      { employeeId: 8, role: 'CREATIVE_LEAD', active: true },
      { employeeId: 9, role: 'MEMBER', active: true },
    ]);
    expect(payload.stages).toHaveLength(12);
    expect(payload.stages[0]).toMatchObject({ stageKey: 'concept', sequence: 1 });
    expect(payload.stages[11]).toMatchObject({ stageKey: 'shipping-prep', sequence: 12 });
    expect(payload).not.toHaveProperty('status');
    expect(payload).not.toHaveProperty('completedQuantity');
    expect(payload).not.toHaveProperty('materialRequirements');
  });

  it('keeps authorization, request identity and runtime authority on the server', () => {
    const service = source('services/server/productionOrderMutations.ts');
    expect(service).toMatch(/requireWorkspaceAccess\('ADMIN_WORKSPACE'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'PROJECT_MANAGE'\)/);
    expect(service).toMatch(/hasPermission\(authContext, 'TASK_MANAGE'\)/);
    expect(service).toMatch(/process\.env\[PRODUCTION_ORDER_MUTATIONS_FLAG\] === 'true'/);
    expect(service).toMatch(/createSupabaseServerClient\(\)[\s\S]*\.rpc\('create_production_order_atomic'/);
    expect(service).not.toMatch(/service_role|createdByEmployeeId/);
  });

  it('exposes a single create endpoint with safe client states and a synchronous submit lock', () => {
    const route = source('app/api/admin/production-orders/route.ts');
    const page = source('app/admin/production-orders/new/page.tsx');
    expect(route).toMatch(/export async function POST/);
    expect(route).toMatch(/createProductionOrder/);
    expect(page).toMatch(/submitLock\.current/);
    expect(page).toContain('Đang tạo lệnh...');
    expect(page).toContain('Không thay đổi tồn kho hoặc vật tư.');
    expect(page).not.toMatch(/completedQuantity|materialRequirements|createdByEmployeeId|status:/);
  });

  it('ships applied hardening references with rollback and read-only validation', () => {
    const base = 'supabase/drafts/20260903_production_order_create_hardening';
    const forward = source(`${base}/forward.sql`);
    const rollback = source(`${base}/rollback.sql`);
    const validation = source(`${base}/validation.sql`);
    const fixture = source(`${base}/nonproduction-fixture.sql`);
    const review = source(`${base}/REVIEW.md`);
    const canonicalStages = forward.match(/v_expected_stages constant jsonb := '(\[[\s\S]*?\])'::jsonb;/)?.[1];
    expect(forward).toMatch(/APPLIED REFERENCE COPY/);
    expect(forward).toMatch(/then 'ACTIVE' else 'LOCKED'/);
    expect(forward).toMatch(/project_name, assigned_to, current_phase/);
    expect(forward).toMatch(/p_payload->'stages' <> v_expected_stages/);
    expect(forward).toMatch(/0, v_priority, 'NOT_STARTED'/);
    expect(forward).toMatch(/v_creative_lead_id[\s\S]*role_code = 'CREATIVE_LEAD'/);
    expect(forward).not.toMatch(/update\s+public\.inventory|insert\s+into\s+public\.procurement/i);
    expect(canonicalStages).toBeTruthy();
    expect(JSON.parse(canonicalStages || '[]')).toEqual(
      buildProductionOrderRpcPayload(parseProductionOrderCreateRequest(validRequest()), [7, 8]).stages,
    );
    expect(rollback).toMatch(/create or replace function public\.create_production_order_atomic/);
    expect(validation).toMatch(/READ-ONLY/);
    expect(fixture).toMatch(/rollback;/i);
    expect(review).toMatch(/PRODUCTION_APPLIED \/ ROLLBACK_FIXTURE_PASS \/ RUNTIME_DISABLED/);
  });

  it('keeps rollback identical to the currently shipped create RPC', () => {
    const functionBlock = (sql: string) => sql.match(/create or replace function public\.create_production_order_atomic\(p_payload jsonb\)[\s\S]*?grant execute on function public\.create_production_order_atomic\(jsonb\) to authenticated;/)?.[0];
    const rollback = source('supabase/drafts/20260903_production_order_create_hardening/rollback.sql');
    const migration = source('supabase/migrations/20260722110928_corrective_slice_6_production_order_persistence.sql');
    expect(functionBlock(rollback)).toBe(functionBlock(migration));
  });
});
