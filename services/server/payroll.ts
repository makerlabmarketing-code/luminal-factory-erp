import 'server-only';

import { createClient } from '@/utils/supabase/server';
import {
  AuthFlowError,
  hasPermission,
  requirePermission,
  requireWorkspaceAccess,
} from './auth';

export const PAYROLL_SETTLEMENT_PERMISSION = 'PAYROLL_SETTLE';
export const PAYROLL_ADJUST_PERMISSION = 'PAYROLL_ADJUST';
export const PAYROLL_CONFIGURE_PERMISSION = 'PAYROLL_CONFIGURE';

export interface PayrollAdjustmentDTO {
  id: string;
  amount: number;
  reason: string;
  approvedAt: string;
}

export interface PayrollMonthDTO {
  employeeId: string;
  employeeName: string;
  payrollMonth: string;
  workedMinutes: number;
  workedHours: number;
  calculatedShifts: number;
  hourlyRate: number;
  baseSalary: number;
  settlementStatus: 'UNSETTLED' | 'SETTLED';
  settlementId: string | null;
  settledAt: string | null;
  approvedAdjustments: PayrollAdjustmentDTO[];
  adjustmentTotal: number;
  finalPayableAmount: number;
}

function payrollEnabled() {
  return process.env.PAYROLL_SETTLEMENT_ENABLED === 'true';
}

function validMonth(value: string | null): string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Tháng lương không hợp lệ.', failureStage: 'validation' });
  }
  return value;
}

function mapPayroll(row: Record<string, unknown>): PayrollMonthDTO {
  const adjustments = Array.isArray(row.approved_adjustments) ? row.approved_adjustments : [];
  return {
    employeeId: String(row.employee_id),
    employeeName: String(row.employee_name || ''),
    payrollMonth: String(row.payroll_month).slice(0, 7),
    workedMinutes: Number(row.worked_minutes || 0),
    workedHours: Number(row.worked_hours || 0),
    calculatedShifts: Number(row.calculated_shifts || 0),
    hourlyRate: Number(row.hourly_rate || 0),
    baseSalary: Number(row.base_salary || 0),
    settlementStatus: row.settlement_id ? 'SETTLED' : 'UNSETTLED',
    settlementId: row.settlement_id ? String(row.settlement_id) : null,
    settledAt: row.settled_at ? String(row.settled_at) : null,
    approvedAdjustments: adjustments.map((item) => {
      const adjustment = item as Record<string, unknown>;
      return { id: String(adjustment.id), amount: Number(adjustment.amount), reason: String(adjustment.reason), approvedAt: String(adjustment.approved_at) };
    }),
    adjustmentTotal: Number(row.adjustment_total || 0),
    finalPayableAmount: Number(row.final_payable_amount || 0),
  };
}

function ensureEnabled() {
  if (!payrollEnabled()) throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Tính năng quyết toán lương chưa được kích hoạt.', failureStage: 'persistence' });
}

export async function getOwnPayroll(month: string) {
  ensureEnabled();
  const auth = await requireWorkspaceAccess('STAFF_WORKSPACE');
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_monthly_payroll', { p_month: `${validMonth(month)}-01` });
  if (error) throw new Error('Không thể tải bảng lương của bạn.');
  return { success: true as const, payroll: data?.[0] ? mapPayroll(data[0] as Record<string, unknown>) : null, employeeId: String(auth.employee.id) };
}

export async function getAdminPayroll(month: string) {
  ensureEnabled();
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  await requirePermission('PAYROLL_VIEW');
  const canSettle = await hasPermission(auth, PAYROLL_SETTLEMENT_PERMISSION);
  const canAdjust = await hasPermission(auth, PAYROLL_ADJUST_PERMISSION);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_monthly_payroll_for_admin', { p_month: `${validMonth(month)}-01` });
  if (error) throw new Error('Không thể tải dữ liệu lương tháng.');
  return { success: true as const, capabilityEnabled: true, canSettle, canAdjust, payroll: (data || []).map((row: unknown) => mapPayroll(row as Record<string, unknown>)) };
}

export async function settlePayroll(employeeId: unknown, month: unknown) {
  ensureEnabled();
  await requirePermission(PAYROLL_SETTLEMENT_PERMISSION);
  if (!['string', 'number'].includes(typeof employeeId)) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nhân viên không hợp lệ.', failureStage: 'validation' });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('settle_monthly_payroll', { p_employee_id: Number(employeeId), p_month: `${validMonth(String(month))}-01` });
  if (error) {
    const duplicate = error.code === '23505' || error.message.includes('already settled');
    throw new AuthFlowError({ status: duplicate ? 409 : 400, code: 'payload_validation_failed', message: duplicate ? 'Nhân viên đã được quyết toán trong tháng này.' : 'Không thể xác nhận quyết toán lương.', failureStage: 'persistence' });
  }
  return { success: true as const, settlementId: String(data) };
}

export async function addPayrollAdjustment(settlementId: unknown, amount: unknown, reason: unknown) {
  ensureEnabled();
  await requirePermission(PAYROLL_ADJUST_PERMISSION);
  const numericAmount = Number(amount);
  const cleanReason = typeof reason === 'string' ? reason.trim() : '';
  if (!settlementId || !Number.isFinite(numericAmount) || numericAmount === 0 || cleanReason.length < 3) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Số tiền và lý do điều chỉnh không hợp lệ.', failureStage: 'validation' });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_payroll_adjustment', { p_settlement_id: String(settlementId), p_amount: numericAmount, p_reason: cleanReason });
  if (error) throw new Error('Không thể tạo điều chỉnh lương.');
  return { success: true as const, adjustmentId: String(data) };
}
