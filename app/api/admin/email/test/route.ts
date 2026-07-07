import { NextResponse } from 'next/server';
import { sendTemplateEmail } from '@/services/emailService';

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      templateId?: number;
      recipient?: string;
    };
    const recipient = payload.recipient?.trim() || '';

    if (!payload.templateId || !recipient) {
      return NextResponse.json(
        {
          error: 'Thiếu templateId hoặc địa chỉ email nhận thử.',
        },
        { status: 400 }
      );
    }

    if (!isValidEmail(recipient)) {
      return NextResponse.json(
        {
          error: 'Địa chỉ email nhận thử không hợp lệ.',
        },
        { status: 400 }
      );
    }

    const result = await sendTemplateEmail({
      templateId: payload.templateId,
      recipient,
      variables: {
        customer_name: 'Khách hàng thử nghiệm',
        hoTen: 'Người nhận thử nghiệm',
        order_id: 'TEST-001',
        amount: '100.000',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi email test tới ${recipient}.`,
      messageId: result.messageId,
      subject: result.subject,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể gửi email test.';
    console.error('SMTP test email failed:', message);

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
