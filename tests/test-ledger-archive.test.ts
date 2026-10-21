import {afterEach,beforeEach,describe,it,expect,vi} from 'vitest';
import {summarizeFinancialLedger,groupPaidLedgerCashflowByReportingPeriod} from '../services/financialReportingService';
import type {FinancialLedgerEntry} from '../lib/types/finance';
const state=vi.hoisted(()=>({owner:vi.fn(),permission:vi.fn(),rpc:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('../services/server/auth',()=>({requireSystemOwner:state.owner,hasPermission:state.permission,AuthFlowError:class extends Error {status:number;constructor(input:{status:number;message:string}){super(input.message);this.status=input.status;}}}));
vi.mock('@/utils/supabase/admin',()=>({createSupabaseAdminClient:()=>({rpc:state.rpc})}));
import {setTestLedgerArchived} from '../services/server/testLedgerArchive';
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('FINANCE_TEST_ARCHIVE_ENABLED','true');state.owner.mockResolvedValue({employee:{id:7}});state.permission.mockResolvedValue(true);state.rpc.mockResolvedValue({error:null});});
afterEach(()=>vi.unstubAllEnvs());
const body={confirmedTest:true,confirmId:'115',reason:'Disposable test confirmed',archived:true};
describe('reversible test ledger boundary',()=>{
 it('requires owner, permission, rollout and explicit test confirmation before writes',async()=>{
  state.owner.mockRejectedValueOnce(new Error('Owner required'));await expect(setTestLedgerArchived(115,body)).rejects.toThrow('Owner required');
  state.permission.mockResolvedValueOnce(false);await expect(setTestLedgerArchived(115,body)).rejects.toMatchObject({status:403});
  vi.stubEnv('FINANCE_TEST_ARCHIVE_ENABLED','');await expect(setTestLedgerArchived(115,body)).rejects.toMatchObject({status:503});vi.stubEnv('FINANCE_TEST_ARCHIVE_ENABLED','true');
  for(const patch of [{confirmedTest:false},{confirmId:'116'},{reason:'short'},{archived:null}]) await expect(setTestLedgerArchived(115,{...body,...patch})).rejects.toMatchObject({status:400});expect(state.rpc).not.toHaveBeenCalled();
 });
 it('derives the actor on the server and supports restore through the same boundary',async()=>{
  await setTestLedgerArchived(115,{...body,actorId:999,archived:false});expect(state.rpc).toHaveBeenCalledWith('set_test_ledger_archived',{p_id:115,p_archived:false,p_actor_id:7,p_reason:body.reason});
 });
 it('excludes archived paid tests from both totals and charts, restores their contribution',()=>{
  const row={id:115,type:'HOAN_UNG',amount:100000,is_paid:true,month_period:'09/2026'} as FinancialLedgerEntry;
  expect(summarizeFinancialLedger([row]).expense).toBe(100000);
  const archived={...row,cancelled_at:'2026-10-21T00:00:00Z'};expect(summarizeFinancialLedger([archived]).expense).toBe(0);expect(groupPaidLedgerCashflowByReportingPeriod([archived])).toEqual([]);
  expect(summarizeFinancialLedger([{...archived,cancelled_at:null}]).expense).toBe(100000);
 });
});
