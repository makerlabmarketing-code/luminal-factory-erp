import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ permission: true, rpc: vi.fn(), send: vi.fn(), smtp: vi.fn(), queue: { id: '550e8400-e29b-41d4-a716-446655440000',ledger_id: 106,employee_id: 1,recipient: 'staff@example.test',employee_name: 'Staff',amount: 100000,salary_month: '2026-06-01',paid_at: '2026-07-02T01:00:00Z',status: 'PENDING' }, snapshots: [] as Record<string,unknown>[] }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/salary-payment', () => import('../lib/salary-payment'));
vi.mock('../services/server/auth', () => ({ requireWorkspaceAccess: async () => ({ employee: { id: 2 } }),hasPermission: async () => state.permission,AuthFlowError: class extends Error { status: number; constructor(value: {status:number;message:string}) { super(value.message);this.status=value.status; } } }));
vi.mock('@/services/emailService', () => ({
  EmailDeliveryError: class extends Error { code='DELIVERY_DISABLED'; },getSmtpConfig: state.smtp,
  isSingleEmailAddress: (email: string) => email.includes('@'),
  getEmailTemplateByGroup: async () => ({ id: 1 }),renderEmailTemplate: () => ({ missingPlaceholders: [] }),sendTemplateEmail: state.send,
}));
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ rpc: state.rpc, from: () => {
  let patch: Record<string,unknown>|undefined; let filter: string[]|undefined;
  const query={ select: () => query,eq: () => query,in: (_column:string,values:string[]) => { filter=values;return query; },update: (value:Record<string,unknown>) => { patch=value;return query; },maybeSingle: async () => {
    if(patch){ if(filter&&!filter.includes(state.queue.status)) return {data:null,error:null};Object.assign(state.queue,patch);state.snapshots.push(patch); }
    return {data:{...state.queue},error:null};
  },then: (resolve:(value:unknown)=>void) => { if(patch) { Object.assign(state.queue,patch);state.snapshots.push(patch); } resolve({error:null}); } };
  return query;
} }) }));
import { confirmSalaryLedgerPayment } from '../services/server/salaryPaymentEmail';
const environment={...process.env};
beforeEach(() => { vi.clearAllMocks();state.permission=true;state.queue.status='PENDING';state.queue.recipient='staff@example.test';state.snapshots=[];process.env.SALARY_PAYMENT_EMAIL_ENABLED='true';state.rpc.mockResolvedValue({data:state.queue.id,error:null});state.send.mockResolvedValue({messageId:'accepted',historyRecorded:true}); });
afterEach(() => {process.env={...environment};});
describe('salary payment commit and notification outcomes', () => {
  it('denies permission and missing month before payment or provider requests',async()=>{
    state.permission=false;await expect(confirmSalaryLedgerPayment(106,'06/2026')).rejects.toMatchObject({status:403});
    state.permission=true;await expect(confirmSalaryLedgerPayment(106,'')).rejects.toMatchObject({status:400});
    expect(state.rpc).not.toHaveBeenCalled();expect(state.send).not.toHaveBeenCalled();
  });
  it('never sends if payment transaction fails',async()=>{
    state.rpc.mockResolvedValue({error:{code:'22023'}});
    await expect(confirmSalaryLedgerPayment(106,'06/2026')).rejects.toThrow();expect(state.send).not.toHaveBeenCalled();
  });
  it('sends the committed amount, person and explicitly confirmed salary month once',async()=>{
    const result=await confirmSalaryLedgerPayment(106,'06/2026');
    expect(result.notification.status).toBe('ACCEPTED');
    expect(state.send.mock.calls[0][0]).toMatchObject({recipient:'staff@example.test',variables:{salary_month:'06/2026',amount:'100.000',employee_name:'Staff',ledger_id:'106'}});
    expect((await confirmSalaryLedgerPayment(106,'06/2026')).notification.status).toBe('ACCEPTED');
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('preserves payment success when preflight configuration is unavailable',async()=>{
    state.smtp.mockImplementationOnce(()=>{throw new Error('unconfigured');});
    const result=await confirmSalaryLedgerPayment(106,'06/2026');
    expect(result).toMatchObject({success:true,isPaid:true,notification:{status:'BLOCKED'}});expect(state.send).not.toHaveBeenCalled();
  });
  it('records ambiguous SMTP results without retrying the payment or email',async()=>{
    state.send.mockRejectedValueOnce(new Error('timeout after DATA'));
    expect((await confirmSalaryLedgerPayment(106,'06/2026')).notification.status).toBe('UNKNOWN');
    expect((await confirmSalaryLedgerPayment(106,'06/2026')).notification.status).toBe('UNKNOWN');
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('lets concurrent confirmations reserve only one SMTP attempt',async()=>{
    await Promise.all([confirmSalaryLedgerPayment(106,'06/2026'),confirmSalaryLedgerPayment(106,'06/2026')]);
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('uses the recipient locked by the claim when a pre-attempt repair races with loading',async()=>{
    state.smtp.mockImplementationOnce(()=>{state.queue.recipient='repaired@example.test';});
    await confirmSalaryLedgerPayment(106,'06/2026');
    expect(state.send.mock.calls[0][0].recipient).toBe('repaired@example.test');
  });
});
