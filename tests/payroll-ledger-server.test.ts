import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({target:{} as Record<string,unknown>,confirm:vi.fn(),write:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/payroll-ledger-link',()=>import('../lib/payroll-ledger-link'));
vi.mock('@/lib/adminFinancialLedger',()=>import('../lib/adminFinancialLedger'));
vi.mock('@/lib/financeExpenseWorkflow',()=>import('../lib/financeExpenseWorkflow'));
vi.mock('@/lib/system-metadata-defaults',()=>import('../lib/system-metadata-defaults'));
vi.mock('../services/server/salaryPaymentEmail',()=>({confirmSalaryLedgerPayment:state.confirm,isSalaryLedger:()=>true,salaryPaymentEmailEnabled:()=>process.env.SALARY_PAYMENT_EMAIL_ENABLED==='true',salaryEmailStatuses:vi.fn()}));
vi.mock('../services/server/auth',()=>({
 AuthFlowError:class extends Error{status:number;constructor(value:{message:string;status:number}){super(value.message);this.status=value.status;}},
 requireWorkspaceAccess:async()=>({employee:{id:1}}),hasPermission:async()=>true,isSystemOwner:()=>false,listGrantedPermissions:async()=>[],
}));
vi.mock('@/utils/supabase/admin',()=>({createSupabaseAdminClient:()=>({from:()=>{
 const chain={select:()=>chain,eq:()=>chain,limit:async()=>({error:null}),maybeSingle:async()=>({data:state.target,error:null}),update:state.write};return chain;
}})}));
import {setAdminFinancialLedgerPaid} from '../services/server/adminFinancialLedger';
const ref='11111111-1111-4111-8111-111111111111';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('FINANCE_REIMBURSEMENT_ENABLED','true');vi.stubEnv('SALARY_PAYMENT_EMAIL_ENABLED','true');state.target={id:5,type:'CHI_PHI',category:'Lương',amount:100,month_period:'11/2026',source_type:'PAYROLL',source_reference:ref,idempotency_key:`payroll-ledger:${ref}`,is_paid:false};state.confirm.mockResolvedValue({success:true});});
afterEach(()=>vi.unstubAllEnvs());
describe('linked payroll payment server boundary',()=>{
 it('derives the month from the linked row instead of a client-supplied value',async()=>{
  await setAdminFinancialLedgerPaid(5,true,'01/2000');expect(state.confirm).toHaveBeenCalledWith(5,'10/2026');expect(state.write).not.toHaveBeenCalled();
 });
 it('refuses zero payment, unpay and disabled email boundary without writing',async()=>{
  state.target.amount=0;await expect(setAdminFinancialLedgerPaid(5,true,'10/2026')).rejects.toMatchObject({status:409});
  state.target.amount=100;await expect(setAdminFinancialLedgerPaid(5,false)).rejects.toMatchObject({status:409});
  vi.stubEnv('SALARY_PAYMENT_EMAIL_ENABLED','false');await expect(setAdminFinancialLedgerPaid(5,true)).rejects.toMatchObject({status:409});
  expect(state.confirm).not.toHaveBeenCalled();expect(state.write).not.toHaveBeenCalled();
 });
 it('preserves explicit salary-month confirmation for legacy rows',async()=>{
  delete state.target.idempotency_key;await setAdminFinancialLedgerPaid(5,true,'06/2026');expect(state.confirm).toHaveBeenCalledWith(5,'06/2026');
 });
});
