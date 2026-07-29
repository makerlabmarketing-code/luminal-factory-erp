import 'server-only';

import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/utils/supabase/server';
import { mergeAttendanceRecords, isAttendanceRecordOverdue } from '@/services/attendanceService';
import { businessDateFromInstant, formatBusinessDateInput } from '@/lib/business-date';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';

export const EMAIL_SERVER_ENVIRONMENT_KEYS = [
  'EMAIL_DELIVERY_ENABLED', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM_NAME',
] as const;

type EmailFailureCode = 'DELIVERY_DISABLED' | 'PROVIDER_NOT_CONFIGURED' | 'INVALID_TEMPLATE' | 'MISSING_PLACEHOLDERS' | 'PROVIDER_AUTH' | 'PROVIDER_NETWORK' | 'PROVIDER_REJECTED';
export class EmailDeliveryError extends Error {
  constructor(public readonly code: EmailFailureCode, message: string, public readonly status = 422) { super(message); this.name = 'EmailDeliveryError'; }
}

interface EmailTemplateRecord { id: number; group_type?: string | null; template_name?: string | null; subject?: string | null; html_content?: string | null; body?: string | null; }
interface EmailHistoryRecord { recipient: string; subject: string; group_type: string; body: string; status: 'SUCCESS' | 'FAILED'; sent_at: string; error_message?: string | null; }
const PLACEHOLDER = /{{\s*([A-Za-z0-9_]+)\s*}}|\[([A-Za-z0-9_]+)\]/g;

export function sanitizeEmailCorrelationId(value?: string): string {
  return value && /^[A-Za-z0-9_-]{8,64}$/.test(value) ? value : crypto.randomUUID();
}
export function getTemplatePlaceholders(...inputs: string[]): string[] {
  const found = new Set<string>();
  inputs.forEach((input) => { const pattern = new RegExp(PLACEHOLDER.source, 'g'); let match: RegExpExecArray | null; while ((match = pattern.exec(input))) found.add(match[1] || match[2]); });
  return Array.from(found).sort();
}
export function renderEmailTemplate(template: Pick<EmailTemplateRecord, 'subject' | 'html_content' | 'body'>, variables: Record<string, string>) {
  const subjectSource = template.subject?.trim() || '';
  const htmlSource = (template.html_content || template.body || '').trim();
  if (!subjectSource || !htmlSource) throw new EmailDeliveryError('INVALID_TEMPLATE', 'Mẫu email cần có tiêu đề và nội dung.');
  const placeholders = getTemplatePlaceholders(subjectSource, htmlSource);
  const missingPlaceholders = placeholders.filter((key) => !String(variables[key] ?? '').trim());
  const replace = (input: string) => input.replace(PLACEHOLDER, (_, curly, square) => variables[curly || square] ?? '');
  return { subject: replace(subjectSource), html: replace(htmlSource), missingPlaceholders, placeholders };
}
function stripHtmlTags(value: string) { return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function getRequiredEnvValue(key: typeof EMAIL_SERVER_ENVIRONMENT_KEYS[number]) { return String(process.env[key] || '').trim(); }
function enabled() { return getRequiredEnvValue('EMAIL_DELIVERY_ENABLED').toLowerCase() === 'true'; }
export function getSmtpConfig() {
  if (!enabled()) throw new EmailDeliveryError('DELIVERY_DISABLED', 'Tính năng gửi email giao dịch đang tắt.', 503);
  const host = getRequiredEnvValue('SMTP_HOST'); const port = Number(getRequiredEnvValue('SMTP_PORT') || 0);
  const user = getRequiredEnvValue('SMTP_USER'); const pass = getRequiredEnvValue('SMTP_PASS').replace(/\s+/g, '');
  const missing = [!host && 'SMTP_HOST', !port && 'SMTP_PORT', !user && 'SMTP_USER', !pass && 'SMTP_PASS'].filter(Boolean);
  if (missing.length) throw new EmailDeliveryError('PROVIDER_NOT_CONFIGURED', `Chưa cấu hình dịch vụ gửi email. Biến server còn thiếu: ${missing.join(', ')}.`, 503);
  if (port < 1 || port > 65535) throw new EmailDeliveryError('PROVIDER_NOT_CONFIGURED', 'SMTP_PORT không hợp lệ.', 503);
  return { host, port, user, pass, fromName: getRequiredEnvValue('SMTP_FROM_NAME') || 'Luminal ERP', secure: port === 465 };
}
export async function getEmailTemplateById(templateId: number): Promise<EmailTemplateRecord> { const { data, error } = await createServerSupabaseClient().from('email_templates').select('id, group_type, template_name, subject, html_content, body').eq('id', templateId).maybeSingle(); if (error) throw error; if (!data) throw new EmailDeliveryError('INVALID_TEMPLATE', 'Không tìm thấy mẫu email.', 404); return data as EmailTemplateRecord; }
export async function getEmailTemplateByGroup(groupType: string): Promise<EmailTemplateRecord> { const { data, error } = await createServerSupabaseClient().from('email_templates').select('id, group_type, template_name, subject, html_content, body').eq('group_type', groupType).limit(1).maybeSingle(); if (error) throw error; if (!data) throw new EmailDeliveryError('INVALID_TEMPLATE', `Chưa cấu hình mẫu email cho nhóm ${groupType}.`, 404); return data as EmailTemplateRecord; }
async function logEmailHistory(payload: EmailHistoryRecord) { const { error } = await createServerSupabaseClient().from('email_history').insert([{ ...payload, error_message: payload.error_message || null }]); if (error) console.error('[erp-email-history]', { failure: 'history_write_failed', code: String(error.code || 'unknown') }); }
function classifyProviderFailure(error: unknown): EmailDeliveryError { const record = error as { code?: string; responseCode?: number }; if (record?.code === 'EAUTH') return new EmailDeliveryError('PROVIDER_AUTH', 'Dịch vụ gửi email từ chối xác thực.', 502); if (/ETIMEDOUT|ESOCKET|ECONNREFUSED|ENOTFOUND/.test(record?.code || '')) return new EmailDeliveryError('PROVIDER_NETWORK', 'Không thể kết nối dịch vụ gửi email.', 502); return new EmailDeliveryError('PROVIDER_REJECTED', 'Dịch vụ gửi email từ chối yêu cầu.', 502); }
async function sendWithTemplate(params: { template: EmailTemplateRecord; recipient: string; variables?: Record<string, string>; correlationId?: string }) {
  const correlationId = sanitizeEmailCorrelationId(params.correlationId); const config = getSmtpConfig();
  const rendered = renderEmailTemplate(params.template, params.variables || {});
  if (rendered.missingPlaceholders.length) throw new EmailDeliveryError('MISSING_PLACEHOLDERS', `Thiếu giá trị cho biến: ${rendered.missingPlaceholders.join(', ')}.`);
  try { const result = await nodemailer.createTransport({ host: config.host, port: config.port, secure: config.secure, auth: { user: config.user, pass: config.pass } }).sendMail({ from: `"${config.fromName}" <${config.user}>`, to: params.recipient, subject: rendered.subject, html: rendered.html, text: stripHtmlTags(rendered.html), headers: { 'X-Correlation-ID': correlationId } }); await logEmailHistory({ recipient: params.recipient, subject: rendered.subject, group_type: params.template.group_type || 'SYSTEM', body: rendered.html, status: 'SUCCESS', sent_at: new Date().toISOString() }); console.info('[erp-email-delivery]', { correlationId, outcome: 'success', templateId: params.template.id }); return { messageId: result.messageId, subject: rendered.subject, correlationId };
  } catch (error) { const failure = classifyProviderFailure(error); await logEmailHistory({ recipient: params.recipient, subject: rendered.subject, group_type: params.template.group_type || 'SYSTEM', body: rendered.html, status: 'FAILED', sent_at: new Date().toISOString(), error_message: failure.code }); console.error('[erp-email-delivery]', { correlationId, outcome: 'failed', failureCode: failure.code, templateId: params.template.id }); throw failure; }
}
export async function sendTemplateEmail(params: { templateId: number; recipient: string; variables?: Record<string, string>; correlationId?: string }) { return sendWithTemplate({ ...params, template: await getEmailTemplateById(params.templateId) }); }
export async function sendTemplateEmailByGroup(params: { groupType: string; recipient: string; variables?: Record<string, string>; correlationId?: string }) { return sendWithTemplate({ ...params, template: await getEmailTemplateByGroup(params.groupType) }); }

export async function getCheckoutReminderCandidates() {
  const supabase = createServerSupabaseClient();
  const today = formatBusinessDateInput(businessDateFromInstant(new Date()));

  const [{ data: records, error: recordsError }, { data: employees, error: employeesError }, { data: shifts, error: shiftsError }] =
    await Promise.all([
      supabase.from('attendance').select('*').eq('work_date', today),
      supabase.from('employees').select('id, employee_id, full_name, email'),
      supabase.from('shifts').select('*'),
    ]);

  if (recordsError) throw recordsError;
  if (employeesError) throw employeesError;
  if (shiftsError) throw shiftsError;

  const mergedRecords = mergeAttendanceRecords((records || []) as AttendanceRecord[]);
  const employeeList = (employees || []) as Employee[];
  const shiftList = (shifts || []) as Shift[];

  return mergedRecords
    .filter((record) =>
      isAttendanceRecordOverdue({
        record,
        shifts: shiftList,
      })
    )
    .map((record) => {
      const employee = employeeList.find((item) => String(item.id) === String(record.employee_id));

      return {
        record,
        employee,
      };
    })
    .filter((item) => item.employee?.email);
}
