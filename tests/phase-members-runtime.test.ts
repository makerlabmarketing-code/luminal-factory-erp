import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ authorize: vi.fn(), rpc: vi.fn(), order: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/services/server/auth', () => ({ AuthFlowError: class extends Error {
  status: number; code: string;
  constructor(input: { status: number; code: string; message: string }) { super(input.message); this.status = input.status; this.code = input.code; }
} }));
vi.mock('@/services/server/phaseAuthorization', () => ({ requirePhaseMutationAccess: state.authorize }));
vi.mock('@/lib/phase-members', () => import('../lib/phase-members'));
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ from: state.from, rpc: state.rpc }) }));
import { listPhaseMembers, setPhaseMembers } from '../services/server/phaseMembers';
import { phaseMemberIds, samePhaseMemberIds } from '../lib/phase-members';
const previousFlag = process.env.PHASE_MEMBERS_ENABLED;
beforeEach(() => {
  vi.resetAllMocks(); process.env.PHASE_MEMBERS_ENABLED='true';
  state.authorize.mockResolvedValue({ actorEmployeeId: 9 });
  state.rpc.mockResolvedValue({ data: { employeeIds: [2,3] }, error: null });
  state.from.mockReturnValue({ select: () => ({ eq: () => ({ order: state.order }) }) });
  state.order.mockResolvedValue({ data: [{ employee_id: 2, employees: { full_name: 'An' } }], error: null });
});
afterEach(() => { if (previousFlag === undefined) delete process.env.PHASE_MEMBERS_ENABLED; else process.env.PHASE_MEMBERS_ENABLED=previousFlag; });
describe('phase member assignment server boundary', () => {
  it('normalizes stable IDs and compares sets independent of selection order', () => {
    expect(phaseMemberIds([3,2,3])).toEqual([2,3]); expect(samePhaseMemberIds([3,2],[2,3])).toBe(true);
    for(const bad of [null, '2', [0], ['2'], [1.2], [NaN], new Array(101).fill(1)]) expect(() => phaseMemberIds(bad)).toThrow();
  });
  it('authorizes the phase and derives actor only on the server', async () => {
    expect(await setPhaseMembers('12','21',{employeeIds:[3,2,3],expectedEmployeeIds:[]})).toEqual({ success:true,employeeIds:[2,3] });
    expect(state.authorize).toHaveBeenCalledWith({ projectId:12,phaseId:21,action:'PHASE_ASSIGN' });
    expect(state.rpc).toHaveBeenCalledWith('set_project_phase_members_atomic',{p_project_id:12,p_phase_id:21,p_employee_ids:[2,3],p_expected_employee_ids:[],p_actor_employee_id:9});
  });
  it('rejects actor injection and malformed/oversized selection before any write', async () => {
    for(const body of [{employeeIds:[2],expectedEmployeeIds:[],actorEmployeeId:1},{employeeIds:['2'],expectedEmployeeIds:[]},{employeeIds:[]},null,[]]) await expect(setPhaseMembers('12','21',body)).rejects.toMatchObject({status:422});
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('does not write after denied permission or invalid project/phase identity', async () => {
    state.authorize.mockRejectedValue(new Error('denied'));
    await expect(setPhaseMembers('12','21',{employeeIds:[2],expectedEmployeeIds:[]})).rejects.toThrow('denied');
    await expect(setPhaseMembers('12','0',{employeeIds:[2],expectedEmployeeIds:[]})).rejects.toMatchObject({status:422});
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it('keeps rollout closed and does not query absent tables when disabled', async () => {
    delete process.env.PHASE_MEMBERS_ENABLED;
    expect(await listPhaseMembers('12','21')).toEqual({enabled:false,members:[]});
    await expect(setPhaseMembers('12','21',{employeeIds:[],expectedEmployeeIds:[]})).rejects.toMatchObject({status:409,code:'phase_members_not_enabled'});
    expect(state.authorize).toHaveBeenCalled(); expect(state.from).not.toHaveBeenCalled(); expect(state.rpc).not.toHaveBeenCalled();
  });
  it('returns names from the joined employee record, not a client name', async () => {
    expect(await listPhaseMembers('12','21')).toEqual({enabled:true,members:[{employeeId:2,fullName:'An'}]});
    expect(state.authorize).toHaveBeenCalledWith({projectId:12,phaseId:21,action:'PHASE_VIEW'});
  });
  it('maps conflicts and ineligible people without leaking SQL errors', async () => {
    for(const [message,status] of [['phase_members_stale',409],['phase_members_not_project_member',422],['phase_members_forbidden',403],['phase_members_project_closed',409],['phase_members_phase_closed',409],['phase_members_phase_mismatch',404]]) {
      state.rpc.mockResolvedValue({ data:null,error:{message} });
      await expect(setPhaseMembers('12','21',{employeeIds:[2],expectedEmployeeIds:[]})).rejects.toMatchObject({status,code:message});
    }
    state.rpc.mockResolvedValue({data:null,error:{message:'sensitive SQL internal'}});
    await expect(setPhaseMembers('12','21',{employeeIds:[2],expectedEmployeeIds:[]})).rejects.toThrow('Không thể lưu phân công. Vui lòng thử lại.');
  });
  it('reports read failures instead of presenting an empty assigned team', async () => {
    state.order.mockResolvedValue({ data:null,error:{message:'db failed'} });
    await expect(listPhaseMembers('12','21')).rejects.toMatchObject({status:500});
  });
});
