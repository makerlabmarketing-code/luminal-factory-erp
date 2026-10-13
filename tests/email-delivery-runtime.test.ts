import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ send: vi.fn(), transport: vi.fn(), insert: vi.fn(), template: { id: 1, group_type: 'SALARY_PAYMENT_CONFIRMED', subject: 'Lương {{salary_month}}', html_content: '<p>{{employee_name}}</p>' } }));
vi.mock('server-only', () => ({}));
vi.mock('nodemailer', () => ({ default: { createTransport: state.transport } }));
vi.mock('@/utils/supabase/admin', () => ({ createSupabaseAdminClient: () => ({ from: () => ({ insert: state.insert, select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: state.template, error: null }) }) }) }) }) }));
vi.mock('@/utils/supabase/server', () => ({ createServerSupabaseClient: vi.fn() }));
vi.mock('@/services/attendanceService', () => ({ mergeAttendanceRecords: vi.fn(), isAttendanceRecordOverdue: vi.fn() }));
vi.mock('@/lib/business-date', () => ({ businessDateFromInstant: vi.fn(), formatBusinessDateInput: vi.fn() }));
import { getSmtpConfig, renderEmailTemplate, sendTemplateEmail } from '../services/emailService';
const environment = { ...process.env };
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.SMTP_FROM_EMAIL;
  Object.assign(process.env, { EMAIL_DELIVERY_ENABLED: 'true', SMTP_HOST: 'smtp.example.test', SMTP_PORT: '587', SMTP_USER: 'sender@example.test', SMTP_PASS: 'fake-test-only' });
  state.transport.mockReturnValue({ sendMail: state.send });
  state.send.mockResolvedValue({ accepted: ['staff@example.test'], messageId: 'receipt-1' });
  state.insert.mockResolvedValue({ error: null });
});
afterEach(() => { process.env = { ...environment }; });
const send = (recipient = 'staff@example.test', variables = { salary_month: '06/2026', employee_name: 'Nhân sự' }) => sendTemplateEmail({ templateId: 1, recipient, variables });
describe('SMTP delivery and history runtime', () => {
  it('stores only live history columns and requires SMTP recipient acceptance', async () => {
    expect(await send()).toMatchObject({ historyRecorded: true, messageId: 'receipt-1' });
    expect(Object.keys(state.insert.mock.calls[0][0][0]).sort()).toEqual(['body','group_type','recipient','sent_at','status','subject']);
    expect(state.transport.mock.calls[0][0]).toMatchObject({ requireTLS: true, connectionTimeout: 10000, socketTimeout: 15000 });
  });
  it('separates Resend SMTP credentials from the sender address', async () => {
    process.env.SMTP_USER = 'resend';
    process.env.SMTP_FROM_EMAIL = 'hr@luminalfactory.com';
    await send();
    expect(state.transport.mock.calls[0][0].auth.user).toBe('resend');
    expect(state.send.mock.calls[0][0].from.address).toBe('hr@luminalfactory.com');
  });
  it('rejects a non-email SMTP username without an explicit sender before sending', async () => {
    process.env.SMTP_USER = 'resend';
    await expect(send()).rejects.toMatchObject({ code: 'PROVIDER_NOT_CONFIGURED' });
    expect(state.transport).not.toHaveBeenCalled();
  });
  it('does not reclassify SMTP acceptance when history persistence fails', async () => {
    state.insert.mockRejectedValue(new Error('history unavailable'));
    expect(await send()).toMatchObject({ historyRecorded: false, messageId: 'receipt-1' });
    expect(state.send).toHaveBeenCalledTimes(1);
  });
  it('records failure when SMTP does not accept the recipient', async () => {
    state.send.mockResolvedValue({ accepted: [], rejected: ['staff@example.test'] });
    await expect(send()).rejects.toMatchObject({ code: 'PROVIDER_REJECTED' });
    expect(state.insert.mock.calls[0][0][0].status).toBe('FAILED');
  });
  it('blocks disabled mail, invalid recipients and missing variables before provider calls', async () => {
    process.env.EMAIL_DELIVERY_ENABLED = 'false';
    await expect(send()).rejects.toMatchObject({ code: 'DELIVERY_DISABLED' });
    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    await expect(send('staff@example.test,other@example.test')).rejects.toMatchObject({ code: 'INVALID_RECIPIENT' });
    await expect(send('staff@example.test', { salary_month: '', employee_name: 'Test' })).rejects.toMatchObject({ code: 'MISSING_PLACEHOLDERS' });
    expect(state.send).not.toHaveBeenCalled();
  });
  it('escapes HTML values and rejects fractional SMTP ports', () => {
    expect(renderEmailTemplate(state.template, { salary_month: '06/2026', employee_name: '<img src=x>' }).html).toBe('<p>&lt;img src=x&gt;</p>');
    process.env.SMTP_PORT = '587.5';
    expect(() => getSmtpConfig()).toThrow('SMTP_PORT');
  });
});
