import 'server-only';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { isSalaryLedger, normalizeSalaryMonth, SALARY_EMAIL_LABELS, type SalaryEmailStatus } from '@/lib/salary-payment';
import { EmailDeliveryError, getSmtpConfig, getEmailTemplateByGroup, isSingleEmailAddress, renderEmailTemplate, sendTemplateEmail } from '@/services/emailService';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from './auth';

export function salaryPaymentEmailEnabled() { return process.env.SALARY_PAYMENT_EMAIL_ENABLED === 'true'; }
export interface SalaryEmailResult { status: SalaryEmailStatus; message: string }
const QUEUE_SELECT = 'id, ledger_id, employee_id, recipient, employee_name, amount, salary_month, paid_at, status';
interface SalaryQueueRow { id: string; ledger_id: number; employee_id: number; recipient: string | null; employee_name: string; amount: number; salary_month: string; paid_at: string; status: SalaryEmailStatus }
function fail(status: number, message: string): never {
  throw new AuthFlowError({ status, code: 'payload_validation_failed', message, failureStage: 'persistence' });
}
async function requireSalaryPayment() {
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', { allowLegacyAdminFallback: true });
  if (!(await hasPermission(auth, 'FINANCE_UPDATE')) || !(await hasPermission(auth, 'FINANCE_PAY'))) {
    fail(403, 'Bạn chưa có quyền xác nhận thanh toán lương.');
  }
  if (!salaryPaymentEmailEnabled()) fail(503, 'Thông báo thanh toán lương chưa được kích hoạt.');
  return auth;
}
export async function confirmSalaryLedgerPayment(ledgerId: number, salaryMonth: unknown) {
  const auth = await requireSalaryPayment();
  const month = normalizeSalaryMonth(salaryMonth);
  if (!month) fail(400, 'Nhập tháng lương theo MM/YYYY; tháng lương có thể khác kỳ sổ.');
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc('confirm_salary_ledger_payment', {
    p_ledger_id: ledgerId, p_salary_month: month, p_actor_id: auth.employee.id,
  });
  if (error) fail(error.code === '22023' ? 409 : 500, 'Không thể ghi nhận thanh toán lương và thông báo. Kiểm tra Người hưởng lợi, khoản lương và trạng thái hiện tại.');
  // The payment and immutable notification snapshot have committed before contacting SMTP.
  let notification: SalaryEmailResult;
  try { notification = await dispatchSalaryEmail(String(data)); }
  catch { notification = { status: 'UNKNOWN', message: 'Đã ghi nhận thanh toán; chưa xác minh được kết quả email. Tải lại sổ và kiểm tra trước khi thử gửi lại.' }; }
  return { success: true as const, isPaid: true, notification };
}
async function dispatchSalaryEmail(queueId: string): Promise<SalaryEmailResult> {
  const admin = createSupabaseAdminClient();
  const loaded = await admin.from('salary_payment_emails').select(QUEUE_SELECT).eq('id', queueId).maybeSingle();
  if (loaded.error || !loaded.data) return { status: 'PENDING', message: 'Đã ghi nhận thanh toán; chưa tải được thông báo email. Không xác nhận thanh toán lại.' };
  const row = loaded.data as SalaryQueueRow;
  if (!['PENDING', 'BLOCKED'].includes(row.status)) return { status: row.status, message: SALARY_EMAIL_LABELS[row.status] };
  const variables = {
    employee_name: row.employee_name, amount: Number(row.amount).toLocaleString('vi-VN'),
    salary_month: `${row.salary_month.slice(5, 7)}/${row.salary_month.slice(0, 4)}`,
    payment_date: new Date(row.paid_at).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }),
    ledger_id: String(row.ledger_id),
  };
  let templateId: number;
  try {
    if (!isSingleEmailAddress(row.recipient || '')) throw new EmailDeliveryError('INVALID_RECIPIENT', 'Hồ sơ nhân sự chưa có email hợp lệ.');
    getSmtpConfig();
    const template = await getEmailTemplateByGroup('SALARY_PAYMENT_CONFIRMED');
    const rendered = renderEmailTemplate(template, variables);
    if (rendered.missingPlaceholders.length) throw new EmailDeliveryError('MISSING_PLACEHOLDERS', 'Mẫu email lương còn thiếu biến.');
    templateId = template.id;
  } catch (error) {
    const reason = error instanceof EmailDeliveryError ? error.code : 'PREFLIGHT_FAILED';
    await admin.from('salary_payment_emails').update({ status: 'BLOCKED', failure_code: reason }).eq('id', queueId).in('status', ['PENDING', 'BLOCKED']);
    return { status: 'BLOCKED', message: 'Đã ghi nhận thanh toán; email chưa gửi. Kiểm tra email nhân sự, mẫu email và cấu hình gửi.' };
  }
  const claimed = await admin.from('salary_payment_emails').update({ status: 'SENDING', attempted_at: new Date().toISOString(), failure_code: null }).eq('id', queueId).in('status', ['PENDING', 'BLOCKED']).select('id').maybeSingle();
  if (claimed.error || !claimed.data) return { status: 'SENDING', message: 'Đã ghi nhận thanh toán; thông báo đang được xử lý. Không gửi lại.' };
  try {
    const result = await sendTemplateEmail({ templateId, recipient: row.recipient!, variables, correlationId: queueId });
    const recorded = await admin.from('salary_payment_emails').update({ status: 'ACCEPTED', message_id: result.messageId, history_recorded: result.historyRecorded }).eq('id', queueId).eq('status', 'SENDING');
    return recorded.error
      ? { status: 'UNKNOWN', message: 'Dịch vụ email đã nhận yêu cầu, nhưng chưa lưu được kết quả. Không gửi lại; cần kiểm tra lịch sử.' }
      : { status: 'ACCEPTED', message: result.historyRecorded ? 'Đã ghi nhận thanh toán; dịch vụ email đã nhận thông báo.' : 'Đã ghi nhận thanh toán; dịch vụ email đã nhận, nhưng chưa lưu được lịch sử. Không gửi lại.' };
  } catch {
    // SMTP may have accepted DATA before a timeout; never retry an ambiguous attempt automatically.
    await admin.from('salary_payment_emails').update({ status: 'UNKNOWN', failure_code: 'SEND_RESULT_UNCONFIRMED' }).eq('id', queueId).eq('status', 'SENDING');
    return { status: 'UNKNOWN', message: 'Đã ghi nhận thanh toán; chưa xác định được kết quả gửi email. Cần kiểm tra dịch vụ email trước khi gửi lại.' };
  }
}
export async function retrySalaryLedgerEmail(ledgerId: number) {
  await requireSalaryPayment();
  const admin = createSupabaseAdminClient();
  const queued = await admin.from('salary_payment_emails').select('id, employee_id, status').eq('ledger_id', ledgerId).maybeSingle();
  if (queued.error || !queued.data) fail(404, 'Không có thông báo lương đã ghi nhận cho khoản này. Không gửi hồi tố khoản đã trả trước đây.');
  if (['PENDING', 'BLOCKED'].includes(queued.data.status)) {
    const employee = await admin.from('employees').select('email').eq('id', queued.data.employee_id).maybeSingle();
    if (employee.error) fail(500, 'Không thể kiểm tra email nhân sự.');
    await admin.from('salary_payment_emails').update({ recipient: employee.data?.email || null }).eq('id', queued.data.id).in('status', ['PENDING', 'BLOCKED']);
  }
  return { success: true as const, notification: await dispatchSalaryEmail(queued.data.id) };
}
export async function salaryEmailStatuses(ledgerIds: Array<number | string>) {
  const statuses = new Map<string, SalaryEmailStatus>();
  if (!salaryPaymentEmailEnabled() || !ledgerIds.length) return statuses;
  const { data, error } = await createSupabaseAdminClient().from('salary_payment_emails').select('ledger_id, status').in('ledger_id', ledgerIds);
  if (error) fail(503, 'Chưa tải được trạng thái email lương.');
  for (const row of data || []) statuses.set(String(row.ledger_id), row.status as SalaryEmailStatus);
  return statuses;
}
export { isSalaryLedger };
