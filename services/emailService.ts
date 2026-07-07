import nodemailer from 'nodemailer';
import { createServerSupabaseClient } from '@/lib/supabase';
import { mergeAttendanceRecords, isAttendanceRecordOverdue } from '@/services/attendanceService';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';

type SystemSettingKey =
  | 'SMTP_HOST'
  | 'SMTP_PORT'
  | 'SMTP_USER'
  | 'SMTP_PASS'
  | 'SMTP_FROM_NAME';

interface EmailTemplateRecord {
  id: number;
  group_type?: string | null;
  template_name?: string | null;
  subject?: string | null;
  html_content?: string | null;
  body?: string | null;
}

interface EmailHistoryRecord {
  recipient: string;
  subject: string;
  group_type: string;
  body: string;
  status: 'SUCCESS' | 'FAILED';
  sent_at: string;
  error_message?: string | null;
}

function replaceTemplateVariables(input: string, variables: Record<string, string>): string {
  return Object.entries(variables).reduce((result, [key, value]) => {
    const safeValue = value || '';

    return result
      .replace(new RegExp(`{{\\s*${key}\\s*}}`, 'g'), safeValue)
      .replace(new RegExp(`\\[${key}\\]`, 'g'), safeValue);
  }, input);
}

function stripHtmlTags(value: string): string {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function getSystemSettingsMap() {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase.from('system_settings').select('key, value');

  if (error) throw error;

  const settingsMap = new Map<string, string>();

  (data || []).forEach((item) => {
    if (item?.key) {
      settingsMap.set(String(item.key).trim().toUpperCase(), String(item.value || '').trim());
    }
  });

  return settingsMap;
}

export async function getSmtpConfig() {
  const settingsMap = await getSystemSettingsMap();

  const host = settingsMap.get('SMTP_HOST') || '';
  const port = Number(settingsMap.get('SMTP_PORT') || '0');
  const user = settingsMap.get('SMTP_USER') || '';
  const pass = settingsMap.get('SMTP_PASS') || '';
  const fromName = settingsMap.get('SMTP_FROM_NAME') || 'Luminal ERP';

  const missingKeys: SystemSettingKey[] = [];

  if (!host) missingKeys.push('SMTP_HOST');
  if (!port) missingKeys.push('SMTP_PORT');
  if (!user) missingKeys.push('SMTP_USER');
  if (!pass) missingKeys.push('SMTP_PASS');

  if (missingKeys.length > 0) {
    throw new Error(`Thiếu cấu hình SMTP: ${missingKeys.join(', ')}`);
  }

  if (![465, 587].includes(port)) {
    throw new Error(`SMTP_PORT hiện là ${port}. Với Gmail nên dùng 465 hoặc 587.`);
  }

  return {
    host,
    port,
    user,
    pass,
    fromName,
    secure: port === 465,
  };
}

export async function getEmailTemplateById(templateId: number): Promise<EmailTemplateRecord> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error('Không tìm thấy email template.');
  }

  return data as EmailTemplateRecord;
}

export async function getEmailTemplateByGroup(groupType: string): Promise<EmailTemplateRecord> {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('group_type', groupType)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error(`Chưa cấu hình email template cho group ${groupType}.`);
  }

  return data as EmailTemplateRecord;
}

async function logEmailHistory(payload: EmailHistoryRecord): Promise<void> {
  const supabase = createServerSupabaseClient();
  const historyPayload = {
    recipient: payload.recipient,
    subject: payload.subject,
    group_type: payload.group_type,
    body: payload.body,
    status: payload.status,
    sent_at: payload.sent_at,
    error_message: payload.error_message || null,
  };

  const { error } = await supabase.from('email_history').insert([historyPayload]);

  if (error) {
    console.error('Khong ghi duoc email_history:', error.message);
  }
}

export async function sendTemplateEmail(params: {
  templateId: number;
  recipient: string;
  variables?: Record<string, string>;
}) {
  const smtpConfig = await getSmtpConfig();
  const template = await getEmailTemplateById(params.templateId);
  return sendWithTemplate({
    smtpConfig,
    template,
    recipient: params.recipient,
    variables: params.variables,
  });
}

export async function sendTemplateEmailByGroup(params: {
  groupType: string;
  recipient: string;
  variables?: Record<string, string>;
}) {
  const smtpConfig = await getSmtpConfig();
  const template = await getEmailTemplateByGroup(params.groupType);
  return sendWithTemplate({
    smtpConfig,
    template,
    recipient: params.recipient,
    variables: params.variables,
  });
}

async function sendWithTemplate(params: {
  smtpConfig: Awaited<ReturnType<typeof getSmtpConfig>>;
  template: EmailTemplateRecord;
  recipient: string;
  variables?: Record<string, string>;
}) {
  const transporter = nodemailer.createTransport({
    host: params.smtpConfig.host,
    port: params.smtpConfig.port,
    secure: params.smtpConfig.secure,
    auth: {
      user: params.smtpConfig.user,
      pass: params.smtpConfig.pass,
    },
  });

  const variables = params.variables || {};
  const renderedSubject = replaceTemplateVariables(params.template.subject || '(Không có tiêu đề)', variables);
  const htmlBody = replaceTemplateVariables(
    params.template.html_content || params.template.body || '<p>(Trống nội dung)</p>',
    variables
  );
  const textBody = stripHtmlTags(htmlBody);

  try {
    const result = await transporter.sendMail({
      from: `"${params.smtpConfig.fromName}" <${params.smtpConfig.user}>`,
      to: params.recipient,
      subject: renderedSubject,
      html: htmlBody,
      text: textBody,
    });

    await logEmailHistory({
      recipient: params.recipient,
      subject: renderedSubject,
      group_type: params.template.group_type || 'SYSTEM',
      body: htmlBody,
      status: 'SUCCESS',
      sent_at: new Date().toISOString(),
    });

    return {
      messageId: result.messageId,
      subject: renderedSubject,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Gửi email thất bại.';

    await logEmailHistory({
      recipient: params.recipient,
      subject: renderedSubject,
      group_type: params.template.group_type || 'SYSTEM',
      body: htmlBody,
      status: 'FAILED',
      sent_at: new Date().toISOString(),
      error_message: message,
    });

    throw new Error(message);
  }
}

export async function getCheckoutReminderCandidates() {
  const supabase = createServerSupabaseClient();
  const today = new Date().toLocaleDateString('en-CA');

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
