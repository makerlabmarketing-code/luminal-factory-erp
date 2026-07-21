import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repositoryRoot = join(__dirname, '..');

function source(relativePath: string): string {
  return readFileSync(join(repositoryRoot, relativePath), 'utf8');
}

describe('phase schema alignment', () => {
  it('reads and writes phases using only live phase columns', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const phaseMutations = source('services/server/phaseMutations.ts');

    expect(repository).toMatch(/\/api\/admin\/phases/);
    expect(repository).not.toMatch(/from\('phases'\)\.insert/);
    expect(repository).not.toMatch(/from\('phases'\)\.update/);
    expect(repository).not.toMatch(/from\('phases'\)\.select/);
    expect(phaseMutations).toMatch(/select\('id, project_id, name, order_index, created_at, status, colorway_name/);
    expect(phaseMutations).toMatch(/colorway_name: optionalTextField\(body, 'colorwayName'\)/);
    expect(phaseMutations).not.toMatch(/sort_order|status: params\.status/);
    expect(phaseMutations).toMatch(/PHASE_STATUS_MUTATION_ENABLED/);
    expect(repository).not.toMatch(/phase_status|sort_order/);
  });

  it('uses one shared create contract and rejects unknown phase fields', () => {
    const repository = source('services/repositories/workflowRepository.ts');
    const phaseMutations = source('services/server/phaseMutations.ts');

    expect(repository).toMatch(/\/api\/admin\/projects\/\$\{params\.projectId\}\/phases/);
    expect(repository).toMatch(/phaseName: params\.phaseName/);
    expect(repository).toMatch(/orderIndex: params\.orderIndex/);
    expect(phaseMutations).toMatch(/const CREATE_PHASE_KEYS = new Set\(\[/);
    expect(phaseMutations).toMatch(/assertKnownFields\(body, CREATE_PHASE_KEYS\)/);
    expect(phaseMutations).toMatch(/status:\s*422/);
  });

  it('keeps phase mutations behind the server authorization boundary', () => {
    const route = source('app/api/admin/projects/[projectId]/phases/route.ts');
    const listRoute = source('app/api/admin/phases/route.ts');
    const phaseMutations = source('services/server/phaseMutations.ts');

    expect(route).toMatch(/createPhase/);
    expect(listRoute).toMatch(/listPhases/);
    expect(phaseMutations).toMatch(/import 'server-only'/);
    expect(phaseMutations).toMatch(/requirePhaseMutationAccess/);
    expect(phaseMutations).toMatch(/PHASE_CREATE/);
    expect(phaseMutations).toMatch(/PHASE_REORDER/);
    expect(phaseMutations).toMatch(/PHASE_VIEW/);
    expect(phaseMutations).toMatch(/createSupabaseAdminClient/);
  });

  it('does not expose raw database errors in the task phase UI', () => {
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(taskPage).toMatch(/Không thể lưu giai đoạn\./);
    expect(taskPage).not.toMatch(/Lỗi Lưu Trữ', err\.message/);
    expect(taskPage).toMatch(/catch\s*\{\s*showToast\('Không thể lưu giai đoạn\.', 'Vui lòng thử lại sau\.', 'error'\);\s*\}/);
  });

  it('keeps form state available for retry when phase save fails', () => {
    const taskPage = source('app/admin/tasks/page.tsx');

    expect(taskPage).toMatch(/setShowAddModal\(false\)/);
    expect(taskPage).toMatch(/catch \(error\)\s*\{\s*showToast\('Không thể tạo dự án\.', projectCreateErrorMessage\(error\), 'error'\);?\s*\}/);
    expect(taskPage).toMatch(/message\.includes\('giai đoạn'\)\) return 'Không thể lưu giai đoạn\.'/);
    expect(taskPage).not.toMatch(/catch\s*\{[^}]*setShowAddModal\(false\)/);
  });
});
