import { NextResponse } from 'next/server';
import { EmailDeliveryError, sendTemplateEmail, sanitizeEmailCorrelationId } from '@/services/emailService';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from '@/services/server/auth';

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

async function requireEmailTemplateManage() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(authContext, 'EMAIL_TEMPLATE_MANAGE'))) {
    throw new AuthFlowError({
      status: 403,
      code: 'permission_forbidden',
      message: 'Bạn không có quyền quản lý mẫu email.',
      failureStage: 'permission_check',
    });
  }
}

export async function POST(request: Request) {
  const correlationId = sanitizeEmailCorrelationId(request.headers.get('x-correlation-id') || undefined);
  try {
    await requireEmailTemplateManage();
    const payload = await request.json() as { templateId?: number; recipient?: string };
    const recipient = payload.recipient?.trim() || '';
    if (!Number.isInteger(payload.templateId) || !isValidEmail(recipient)) return NextResponse.json({ success: false, code: 'INVALID_REQUEST', message: 'Vui lòng chọn mẫu và nhập email nhận thử hợp lệ.', correlationId }, { status: 400 });
    const result = await sendTemplateEmail({ templateId: payload.templateId!, recipient, correlationId, variables: { customer_name: 'Người nhận thử nghiệm', employee_name: 'Nhân sự thử nghiệm', hoTen: 'Người nhận thử nghiệm', shift_name: 'Ca thử nghiệm', work_date: '01/01/2026', order_id: 'TEST-001', amount: '100.000' } });
    return NextResponse.json({ success: true, message: `Đã gửi email thử nghiệm tới ${recipient}.`, subject: result.subject, correlationId });
  } catch (error) {
    const known = error instanceof EmailDeliveryError;
    const authorization = error instanceof AuthFlowError;
    console.error('[erp-email-test-route]', { correlationId, failureCode: known ? error.code : authorization ? error.code : 'UNEXPECTED' });
    return NextResponse.json({ success: false, code: known ? error.code : authorization ? error.code : 'SEND_FAILED', message: known || authorization ? error.message : 'Không thể gửi email thử nghiệm.', correlationId }, { status: known || authorization ? error.status : 500 });
  }
}
