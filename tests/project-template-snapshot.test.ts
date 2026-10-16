import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ enabled: true, allowed: true, visible: true, rpc: vi.fn(), membership: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/services/server/phaseTemplates', () => ({ phaseTemplatesEnabled: () => state.enabled }));
vi.mock('@/services/server/auth', () => {
  class AuthFlowError extends Error { status: number; constructor(input: { message: string; status: number }) { super(input.message); this.status = input.status; } }
  return { AuthFlowError, requireWorkspaceAccess: async () => ({}), hasPermission: async () => state.allowed };
});
vi.mock('@/services/server/projectMembershipAuthorization', () => ({ requireProjectMembershipAction: async (...args: unknown[]) => { state.membership(...args); if (!state.visible) throw new Error('Forbidden project'); } }));
vi.mock('@/utils/supabase/server', () => ({ createClient: async () => ({ rpc: state.rpc }) }));
import { saveProjectTemplateSnapshot } from '../services/server/projectTemplateSnapshot';
beforeEach(() => { state.enabled = true; state.allowed = true; state.visible = true; vi.clearAllMocks(); state.rpc.mockResolvedValue({ data: { success: true, versionId: 7 }, error: null }); });
describe('project template snapshot authorization and failure', () => {
  it('passes only the project and trimmed name to the authenticated RPC', async () => {
    expect(await saveProjectTemplateSnapshot(3, ' Artisan ')).toEqual({ success: true, versionId: 7 });
    expect(state.membership).toHaveBeenCalledWith(3, 'PROJECT_VIEW');
    expect(state.rpc).toHaveBeenCalledWith('save_project_template_atomic', { p_project_id: 3, p_name: 'Artisan' });
  });
  it('rejects disabled features and permission denial before writing', async () => {
    state.enabled = false;
    await expect(saveProjectTemplateSnapshot(3, 'Artisan')).rejects.toThrow();
    state.enabled = true; state.allowed = false;
    await expect(saveProjectTemplateSnapshot(3, 'Artisan')).rejects.toMatchObject({ status: 403 });
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('requires project visibility independently of template permission', async () => {
    state.visible = false;
    await expect(saveProjectTemplateSnapshot(3, 'Artisan')).rejects.toThrow('Forbidden project');
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('does not recreate a project or retry an uncertain publication', async () => {
    state.rpc.mockResolvedValue({ data: null, error: { code: 'timeout' } });
    await expect(saveProjectTemplateSnapshot(3, 'Artisan')).rejects.toThrow('Dự án vẫn được giữ nguyên');
    expect(state.rpc).toHaveBeenCalledTimes(1);
  });
});
