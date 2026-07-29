import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
const read = (file: string) => readFileSync(join(process.cwd(), file), 'utf8');

describe('ERP transactional email foundation', () => {
  const service = read('services/emailService.ts');
  const route = read('app/api/admin/email/test/route.ts');
  const editor = read('app/admin/email-editor/page.tsx');
  it('renders a preview and validates every placeholder before delivery', () => {
    expect(service).toContain('renderEmailTemplate');
    expect(service).toContain('missingPlaceholders');
    expect(service).toContain("'MISSING_PLACEHOLDERS'");
    expect(editor).toContain('Xem trước mẫu');
  });
  it('defaults delivery off and reports missing server provider configuration', () => {
    expect(service).toContain("getRequiredEnvValue('EMAIL_DELIVERY_ENABLED')");
    expect(service).toContain("'DELIVERY_DISABLED'");
    expect(service).toContain("'PROVIDER_NOT_CONFIGURED'");
    expect(service).toContain('Chưa cấu hình dịch vụ gửi email');
  });
  it('requires an authorized Admin and an explicit test recipient', () => {
    expect(route).toContain("requireAdminEmployeePermission('EMPLOYEE_MANAGE')");
    expect(route).toContain('isValidEmail(recipient)');
    expect(route).toContain('error instanceof AuthFlowError');
  });
  it('classifies provider outcomes and emits sanitized logs without secrets', () => {
    expect(service).toContain("'PROVIDER_AUTH'");
    expect(service).toContain("'PROVIDER_NETWORK'");
    expect(service).toContain("'PROVIDER_REJECTED'");
    expect(service).toContain("outcome: 'success'");
    expect(service).toContain("outcome: 'failed'");
    expect(service).not.toMatch(/console\.(?:info|error)\([^\n]*(?:pass|SMTP_PASS|config)/);
    expect(route).not.toContain('messageId: result.messageId');
  });
  it('prevents duplicate test sends and reports toast/form state', () => {
    expect(editor).toContain('if (testSendInFlight.current) return');
    expect(editor).toContain('disabled={sendingTestMail}');
    expect(editor).toContain("'Đã gửi email thử nghiệm'");
    expect(editor).toContain("'Không thể gửi email thử nghiệm'");
    expect(editor).toContain('testDeliveryResult');
  });
  it('keeps the editor readable and preserves failed form submissions', () => {
    expect(editor).toContain("const isDirty =");
    expect(editor).toContain("Dữ liệu đã nhập vẫn được giữ lại. Vui lòng thử lại.");
    expect(editor).toContain("Không tìm thấy mẫu email phù hợp.");
    expect(editor).not.toContain('Ká»‹ch Báº£n');
    expect(editor).not.toContain('LÆ°u Ká»‹ch Báº£n');
  });
  it('keeps business delivery separate from Supabase Auth', () => {
    expect(service).toContain('nodemailer.createTransport');
    expect(service).not.toContain('auth.admin.inviteUserByEmail');
    expect(route).not.toContain('resetPasswordForEmail');
  });
});
