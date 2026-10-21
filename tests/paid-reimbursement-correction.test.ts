import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({rpc:vi.fn(),permission:vi.fn(),original:{id:115,type:'HOAN_UNG',category:'test',requested_by:'Maker Lab',is_paid:true}}));
vi.mock('server-only',()=>({}));
vi.mock('../services/server/salaryPaymentEmail',()=>({isSalaryLedger:()=>false,salaryPaymentEmailEnabled:()=>false}));
vi.mock('../services/server/adminFinancialLedger',()=>({updateAdminFinancialLedger:vi.fn()}));
vi.mock('@/lib/activity-history',()=>import('../lib/activity-history'));
vi.mock('@/lib/adminFinancialLedger',()=>import('../lib/adminFinancialLedger'));
vi.mock('../services/server/auth',()=>({AuthFlowError:class extends Error{constructor(input:{message:string}){super(input.message);}},requireWorkspaceAccess:async()=>({employee:{id:7}}),hasPermission:state.permission}));
vi.mock('@/utils/supabase/admin',()=>({createSupabaseAdminClient:()=>({rpc:state.rpc,from:()=>{const chain={select:()=>chain,eq:()=>chain,is:()=>chain,maybeSingle:async()=>({data:state.original,error:null}),then:(resolve:(v:unknown)=>unknown)=>Promise.resolve({count:0,error:null}).then(resolve)};return chain;}})}));
import {updateAdminFinancialLedgerAtomicAware} from '../services/server/adminFinancialLedgerAtomic';
beforeEach(()=>{vi.stubEnv('ERP_ACTIVITY_HISTORY_ENABLED','true');vi.stubEnv('FINANCE_REIMBURSEMENT_ENABLED','true');state.permission.mockResolvedValue(true);state.rpc.mockResolvedValue({error:null});});afterEach(()=>vi.unstubAllEnvs());
it('saves paid evidence corrections without replaying protected people from the form',async()=>{
 await updateAdminFinancialLedgerAtomicAware(115,{type:'HOAN_UNG',category:'Corrected receipt',amount:50000,monthPeriod:'09/2026',isPaid:true,correctionReason:'Correct test receipt value',payerEmployeeId:null,beneficiaryEmployeeId:20});
 const [name,params]=state.rpc.mock.calls.at(-1)!;expect(name).toBe('update_erp_record_with_history');expect(params.p_actor_id).toBe(7);expect(params.p_patch).toMatchObject({category:'Corrected receipt',amount:50000});
 for(const key of ['requested_by','payer_employee_id','beneficiary_employee_id','beneficiary_external_name']) expect(params.p_patch).not.toHaveProperty(key);
});
