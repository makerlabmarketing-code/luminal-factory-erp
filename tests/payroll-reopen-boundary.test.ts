import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ permission: vi.fn(), rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/payroll-input', () => import('../lib/payroll-input'));
vi.mock('../services/server/auth', () => ({
 AuthFlowError: class extends Error { status: number; constructor(input: {message: string; status: number}) { super(input.message); this.status=input.status; } },
 requireWorkspaceAccess: vi.fn(async () => ({employee:{id:1}})), hasPermission: state.permission,
}));
vi.mock('@/utils/supabase/server', () => ({createClient: async () => ({rpc:state.rpc})}));
vi.mock('@/utils/supabase/admin', () => ({createSupabaseAdminClient: vi.fn()}));
import { reopenPayroll } from '../services/server/payroll';
const prior=[process.env.PAYROLL_SETTLEMENT_ENABLED, process.env.PAYROLL_REOPEN_ENABLED];
beforeEach(() => { vi.resetAllMocks(); state.permission.mockResolvedValue(true); state.rpc.mockResolvedValue({error:null}); process.env.PAYROLL_SETTLEMENT_ENABLED='true'; process.env.PAYROLL_REOPEN_ENABLED='true'; });
afterEach(() => { ['PAYROLL_SETTLEMENT_ENABLED','PAYROLL_REOPEN_ENABLED'].forEach((key,i) => { if(prior[i]===undefined) delete process.env[key]; else process.env[key]=prior[i]; }); });
const id='11111111-1111-4111-8111-111111111111';
describe('reopen payroll trusted boundary', () => {
 it('stays disabled until the reviewed schema rollout', async () => {
  delete process.env.PAYROLL_REOPEN_ENABLED;
  await expect(reopenPayroll(id,'Đóng nhầm trước ngày chốt')).rejects.toMatchObject({status:503}); expect(state.rpc).not.toHaveBeenCalled();
 });
 it('rejects missing permission and invalid target/reason without writes', async () => {
  state.permission.mockResolvedValue(false); await expect(reopenPayroll(id,'Lý do đủ dài hợp lệ')).rejects.toMatchObject({status:403});
  state.permission.mockResolvedValue(true);
  for(const [target,reason] of [[null,'Lý do đủ dài hợp lệ'],[id,'ngắn'],['not-uuid','Lý do đủ dài hợp lệ']]) await expect(reopenPayroll(target,reason)).rejects.toMatchObject({status:400});
  expect(state.rpc).not.toHaveBeenCalled();
 });
 it('passes only the snapshot and reason; SQL derives the actor from the authenticated session', async () => {
  await expect(reopenPayroll(id,'  Đóng nhầm trước ngày chốt  ')).resolves.toEqual({success:true});
  expect(state.rpc).toHaveBeenCalledWith('reopen_monthly_payroll',{p_settlement_id:id,p_reason:'Đóng nhầm trước ngày chốt'});
 });
 it('maps paid and adjusted blockers without pretending the record was reopened', async () => {
  for(const message of ['payroll_already_paid','payroll_has_adjustments','payroll_snapshot_stale']) {
   state.rpc.mockResolvedValue({error:{message}}); await expect(reopenPayroll(id,'Đóng nhầm trước ngày chốt')).rejects.toMatchObject({status:409});
  }
 });
});
