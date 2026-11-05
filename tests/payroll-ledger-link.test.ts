import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isLinkedPayrollLedger, isZeroPayrollObligation } from '../lib/payroll-ledger-link';

const reference='11111111-1111-4111-8111-111111111111';
const linked={type:'CHI_PHI',source_type:'PAYROLL',source_reference:reference,idempotency_key:`payroll-ledger:${reference}`,amount:0};
describe('linked payroll obligation identity',()=>{
 it('distinguishes generated obligations from legacy/manual payroll and counter-rows',()=>{
  expect(isLinkedPayrollLedger(linked)).toBe(true);
  for(const row of [{...linked,idempotency_key:null},{...linked,type:'VON_GOP'},{...linked,source_reference:'manual'},{...linked,source_type:'SALARY'}]) expect(isLinkedPayrollLedger(row)).toBe(false);
 });
 it('treats only a genuine numeric zero obligation as no-payment-due',()=>{
  for(const amount of [0,'0','0.00']) expect(isZeroPayrollObligation({...linked,amount})).toBe(true);
  for(const amount of [null,'',-1,1,'invalid']) expect(isZeroPayrollObligation({...linked,amount})).toBe(false);
  expect(isZeroPayrollObligation({...linked,idempotency_key:null})).toBe(false);
 });
 it('runs genuine payroll RPCs and integration SQL on disposable PostgreSQL',()=>{
  const output=execFileSync(process.execPath,[join(__dirname,'../supabase/drafts/payroll-ledger-link/test.mjs')],{
   env:{...process.env,PGLITE_MODULE:require.resolve('@electric-sql/pglite')},encoding:'utf8',timeout:30_000,
  });
  expect(output).toContain('payroll-ledger PostgreSQL cases; no SMTP or live database');
 },35_000);
});
