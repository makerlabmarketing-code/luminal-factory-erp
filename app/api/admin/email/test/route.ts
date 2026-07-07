import { NextResponse } from 'next/server';
import { sendTemplateEmail } from '@/services/emailService';

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      templateId?: number;
      recipient?: string;
    };

    if (!payload.templateId || !payload.recipient?.trim()) {
      return NextResponse.json(
        {
          error: 'Thiếu templateId hoặc địa chỉ email nhận thử.',
        },
        { status: 400 }
      );
    }

    const result = await sendTemplateEmail({
      templateId: payload.templateId,
      recipient: payload.recipient.trim(),
      variables: {
        customer_name: 'Khách hàng thử nghiệm',
        hoTen: 'Người nhận thử nghiệm',
        order_id: 'TEST-001',
        amount: '100.000',
      },
    });

    return NextResponse.json({
      success: true,
      message: `Đã gửi email test tới ${payload.recipient.trim()}.`,
      messageId: result.messageId,
      subject: result.subject,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Không thể gửi email test.';

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
