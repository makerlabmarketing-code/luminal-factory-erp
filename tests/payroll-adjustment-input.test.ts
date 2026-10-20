import { describe, expect, it } from 'vitest';
import { payrollAdjustmentInput } from '../lib/payroll-input';
describe('payroll money adjustments', () => {
 it('accepts whole VND bonus and deduction with a trimmed reason', () => {
  expect(payrollAdjustmentInput('50000','  Thưởng hiệu suất  ')).toEqual({amount:50000,reason:'Thưởng hiệu suất'});
  expect(payrollAdjustmentInput('-20000','Khấu trừ')).toEqual({amount:-20000,reason:'Khấu trừ'});
 });
 it.each(['', '50.000', '50,000', '1e5', '1.5', 1.5, 0, '0', null, NaN, Infinity, 1e16])('rejects ambiguous or unsafe amount %s', amount => expect(() => payrollAdjustmentInput(amount,'Lý do hợp lệ')).toThrow());
 it('requires a bounded explanation', () => {
  for(const reason of ['', 'ab', null, 'a'.repeat(1001)]) expect(() => payrollAdjustmentInput(50000,reason)).toThrow();
 });
});
