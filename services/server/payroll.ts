import 'server-only';
import { payrollAdjustmentInput } from '@/lib/payroll-input';

import { createClient } from '@/utils/supabase/server';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import {
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
  type AuthContext,
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
  settledByName?: string | null;
  reopeningHistory?: Array<{ reason: string; reopenedAt: string; actorName: string }>;
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
  canReopen?: boolean;
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

async function requireAdminPayrollPermission(permissionCode: string): Promise<AuthContext> {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  if (!(await hasPermission(auth, permissionCode))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn chưa có quyền thực hiện thao tác bảng lương này.',
      failureStage: 'permission_check',
    });
  }
  return auth;
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
        canReopen: canSettle && process.env.PAYROLL_REOPEN_ENABLED === 'true',
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
      canReopen: canSettle && process.env.PAYROLL_REOPEN_ENABLED === 'true',
    },
  };
}

export async function configurePayrollFirstMonth(month: unknown) {
  await requireAdminPayrollPermission(PAYROLL_CONFIGURE_PERMISSION);

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
  const auth = await requireWorkspaceAccess('STAFF_WORKSPACE');
  ensureEnabled();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_my_monthly_payroll', { p_month: `${validMonth(month)}-01` });
  if (error) throw new Error('Không thể tải bảng lương của bạn.');
  return { success: true as const, payroll: data?.[0] ? mapPayroll(data[0] as Record<string, unknown>) : null, employeeId: String(auth.employee.id) };
}

export async function getAdminPayroll(month: string) {
  const auth = await requireAdminPayrollPermission('PAYROLL_VIEW');
  ensureEnabled();
  const [canSettle, canAdjust] = await Promise.all([
    hasPermission(auth, PAYROLL_SETTLEMENT_PERMISSION),
    hasPermission(auth, PAYROLL_ADJUST_PERMISSION),
  ]);
  const admin = createSupabaseAdminClient();
  const { data: config, error: configError } = await admin.from('payroll_configuration').select('first_settlement_month').eq('singleton', true).maybeSingle();
  if (configError) throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Gói dữ liệu quyết toán lương chưa sẵn sàng.', failureStage: 'persistence' });
  if (!config?.first_settlement_month) throw new AuthFlowError({ status: 409, code: 'payload_validation_failed', message: 'Chưa cấu hình tháng quyết toán đầu tiên.', failureStage: 'persistence' });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('list_monthly_payroll_for_admin', { p_month: `${validMonth(month)}-01` });
  if (error) throw new Error('Không thể tải dữ liệu lương tháng.');
  const payroll: PayrollMonthDTO[] = (data || []).map((row: unknown) => mapPayroll(row as Record<string, unknown>));
  const settlementIds = payroll.flatMap(row => row.settlementId ? [row.settlementId] : []);
  if (settlementIds.length) {
    const { data: actors, error: actorError } = await admin.from('payroll_settlements')
      .select('id, employees!payroll_settlements_settled_by_employee_id_fkey(full_name)').in('id', settlementIds);
    if (actorError) throw new Error('Không thể tải người chốt lương.');
    const names = new Map((actors || []).map(row => {
      const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
      return [String(row.id), employee?.full_name || null];
    }));
    for (const row of payroll) row.settledByName = row.settlementId ? names.get(row.settlementId) || null : null;
  }
  if (process.env.PAYROLL_REOPEN_ENABLED === 'true') {
    const { data: reopened, error: reopenError } = await admin.from('payroll_settlement_reopenings')
      .select('reason, reopened_at, employees!payroll_settlement_reopenings_actor_employee_id_fkey(full_name), payroll_settlements!inner(employee_id,payroll_month)')
      .eq('payroll_settlements.payroll_month', `${validMonth(month)}-01`).order('reopened_at', { ascending: false });
    if (reopenError) throw new Error('Không thể tải lịch sử mở lại kỳ lương.');
    for (const item of reopened || []) {
      const snapshot = Array.isArray(item.payroll_settlements) ? item.payroll_settlements[0] : item.payroll_settlements;
      const actor = Array.isArray(item.employees) ? item.employees[0] : item.employees;
      const row = payroll.find(candidate => candidate.employeeId === String(snapshot?.employee_id));
      if (row) (row.reopeningHistory ||= []).push({ reason: item.reason, reopenedAt: item.reopened_at, actorName: actor?.full_name || 'Chưa ghi nhận' });
    }
  }
  return { success: true as const, capabilityEnabled: true, canSettle, canAdjust, payroll };
}

export async function settlePayroll(employeeId: unknown, month: unknown) {
  await requireAdminPayrollPermission(PAYROLL_SETTLEMENT_PERMISSION);
  ensureEnabled();
  if (!['string', 'number'].includes(typeof employeeId)) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nhân viên không hợp lệ.', failureStage: 'validation' });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('settle_monthly_payroll', { p_employee_id: Number(employeeId), p_month: `${validMonth(String(month))}-01` });
  if (error) {
    const duplicate = error.code === '23505' || error.message.includes('already settled');
    const historical = error.message.includes('historical settlement is not allowed');
    throw new AuthFlowError({
      status: duplicate ? 409 : 400,
      code: 'payload_validation_failed',
      message: duplicate
        ? 'Nhân viên đã được quyết toán trong tháng này.'
        : historical
          ? 'Kỳ đã chọn nằm trước tháng quyết toán đầu tiên.'
          : error.message.includes('payroll_unfinished_attendance') ? 'Nhân viên còn ca chưa chấm công ra. Hoàn tất ca trước khi chốt lương.' : 'Không thể xác nhận quyết toán lương.',
      failureStage: 'persistence',
    });
  }
  return { success: true as const, settlementId: String(data) };
}

export async function addPayrollAdjustment(settlementId: unknown, amount: unknown, reason: unknown) {
  await requireAdminPayrollPermission(PAYROLL_ADJUST_PERMISSION);
  ensureEnabled();
  let input: { amount: number; reason: string };
  try { input = payrollAdjustmentInput(amount, reason); } catch (error) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: (error as Error).message, failureStage: 'validation' });
  }
  if (typeof settlementId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(settlementId)) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Bản chốt không hợp lệ.', failureStage: 'validation' });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_payroll_adjustment', { p_settlement_id: String(settlementId), p_amount: input.amount, p_reason: input.reason });
  if (error) throw new Error('Không thể tạo điều chỉnh lương.');
  return { success: true as const, adjustmentId: String(data) };
}

export async function reopenPayroll(settlementId: unknown, reason: unknown) {
  await requireAdminPayrollPermission(PAYROLL_SETTLEMENT_PERMISSION);
  ensureEnabled();
  if (process.env.PAYROLL_REOPEN_ENABLED !== 'true') throw new AuthFlowError({ status: 503, code: 'service_unavailable', message: 'Mở lại kỳ lương đang chờ kích hoạt.', failureStage: 'persistence' });
  if (typeof settlementId !== 'string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(settlementId) || typeof reason !== 'string' || reason.trim().length < 10 || reason.trim().length > 1000) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Chọn đúng bản chốt và nhập lý do từ 10 đến 1.000 ký tự.', failureStage: 'validation' });
  const supabase = await createClient();
  const { error } = await supabase.rpc('reopen_monthly_payroll', { p_settlement_id: settlementId, p_reason: reason.trim() });
  if (error) {
    const message = error.message.includes('payroll_already_paid') ? 'Đã có khoản lương được trả trong tháng này. Không thể mở lại.' : error.message.includes('payroll_has_adjustments') ? 'Bản chốt đã có điều chỉnh. Cần đối soát trước khi mở lại.' : 'Không thể mở lại. Bản chốt có thể đã thay đổi hoặc bạn chưa đủ quyền.';
    throw new AuthFlowError({ status: error.code === '42501' ? 403 : 409, code: 'payload_validation_failed', message, failureStage: 'persistence' });
  }
  return { success: true as const };
}
