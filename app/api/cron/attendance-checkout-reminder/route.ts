import { NextResponse } from 'next/server';
import { getCheckoutReminderCandidates, sendTemplateEmailByGroup } from '@/services/emailService';

const CHECKOUT_REMINDER_GROUP = 'ATTENDANCE_CHECKOUT_REMINDER';

function jsonNoStore(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

function isAuthorizedCronRequest(request: Request): boolean {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  if (!cronSecret) return false;
  return request.headers.get('authorization') === `Bearer ${cronSecret}`;
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return jsonNoStore(
      {
        success: false,
        code: 'cron_unauthorized',
        message: 'Yêu cầu tác vụ tự động không hợp lệ.',
      },
      { status: 401 }
    );
  }

  try {
    const candidates = await getCheckoutReminderCandidates();

    if (candidates.length === 0) {
      return jsonNoStore({
        success: true,
        message: 'Không có ca nào quá giờ cần nhắc checkout.',
        sent: 0,
      });
    }

    let sent = 0;
    const skipped: string[] = [];

    for (const candidate of candidates) {
      if (!candidate.employee?.email) {
        skipped.push(String(candidate.record.id));
        continue;
      }

      try {
        await sendTemplateEmailByGroup({
          groupType: CHECKOUT_REMINDER_GROUP,
          recipient: candidate.employee.email,
          variables: {
            hoTen: candidate.employee.full_name || 'Nhân sự',
            employee_name: candidate.employee.full_name || 'Nhân sự',
            shift_name: candidate.record.shift_name,
            work_date: candidate.record.work_date,
          },
        });
        sent += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Gửi mail nhắc checkout thất bại.';
        skipped.push(`${candidate.employee.full_name || candidate.employee.email}: ${message}`);
      }
    }

    return jsonNoStore({
      success: true,
      sent,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cron nhắc checkout.';

    return jsonNoStore(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
