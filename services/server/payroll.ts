import 'server-only';

import { createClient } from '@/utils/supabase/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
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

export interface PayrollReadinessDTO {
  schemaReady: boolean;
  featureEnabled: boolean;
  configured: boolean;
  firstSettlementMonth: string | null;
  canView: boolean;
  canSettle: boolean;
  canAdjust: boolean;
  canConfigure: boolean;
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

export async function getAdminPayrollReadiness(): Promise<{ success: true; readiness: PayrollReadinessDTO }> {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  const [canView, canSettle, canAdjust, canConfigure] = await Promise.all([
    hasPermission(auth, 'PAYROLL_VIEW'),
    hasPermission(auth, PAYROLL_SETTLEMENT_PERMISSION),
    hasPermission(auth, PAYROLL_ADJUST_PERMISSION),
    hasPermission(auth, PAYROLL_CONFIGURE_PERMISSION),
  ]);

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from('payroll_configuration')
    .select('first_settlement_month')
    .eq('singleton', true)
    .maybeSingle();

  if (error) {
    return {
      success: true,
      readiness: {
        schemaReady: false,
        featureEnabled: payrollEnabled(),
        configured: false,
        firstSettlementMonth: null,
        canView,
        canSettle,
        canAdjust,
        canConfigure,
      },
    };
  }

  return {
    success: true,
    readiness: {
      schemaReady: true,
      featureEnabled: payrollEnabled(),
      configured: Boolean(data?.first_settlement_month),
      firstSettlementMonth: data?.first_settlement_month ? String(data.first_settlement_month).slice(0, 7) : null,
      canView,
      canSettle,
      canAdjust,
      canConfigure,
    },
  };
}

export async function configurePayrollFirstMonth(month: unknown) {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  if (!(await hasPermission(auth, PAYROLL_CONFIGURE_PERMISSION))) {
    throw new AuthFlowError({ status: 403, code: 'permission_forbidden', message: 'Bạn chưa có quyền cấu hình tháng quyết toán đầu tiên.', failureStage: 'permission_check' });
  }

  const normalizedMonth = validMonth(typeof month === 'string' ? month : null);
  const admin = createSupabaseAdminClient();
  const { data: existing, error: configError } = await admin
    .from('payroll_configuration')
    .select('first_settlement_month')
    .eq('singleton', true)
    .maybeSingle();
  if (configError) throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Gói dữ liệu quyết toán lương chưa sẵn sàng.', failureStage: 'persistence' });
  if (existing?.first_settlement_month) {
    throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Tháng quyết toán đầu tiên đã được cấu hình và không thể ghi đè.', failureStage: 'persistence' });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc('configure_payroll_first_month', { p_month: `${normalizedMonth}-01` });
  if (error) {
    const duplicate = error.code === '23505';
    throw new AuthFlowError({
      status: duplicate ? 409 : 400,
      code: 'payload_validation_failed',
      message: duplicate ? 'Tháng quyết toán đầu tiên đã được cấu hình.' : 'Không thể cấu hình tháng quyết toán đầu tiên.',
      failureStage: 'persistence',
    });
  }
  return { success: true as const, firstSettlementMonth: normalizedMonth };
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
  const admin = createSupabaseAdminClient();
  const { data: config, error: configError } = await admin.from('payroll_configuration').select('first_settlement_month').eq('singleton', true).maybeSingle();
  if (configError) throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Gói dữ liệu quyết toán lương chưa sẵn sàng.', failureStage: 'persistence' });
  if (!config?.first_settlement_month) throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Chưa cấu hình tháng quyết toán đầu tiên.', failureStage: 'persistence' });
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
