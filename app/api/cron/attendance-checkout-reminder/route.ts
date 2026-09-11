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
        skippedCount: 0,
      });
    }

    let sent = 0;
    let skippedCount = 0;

    for (const candidate of candidates) {
      if (!candidate.employee?.email) {
        skippedCount += 1;
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
      } catch {
        skippedCount += 1;
      }
    }

    return jsonNoStore({
      success: true,
      sent,
      skippedCount,
    });
  } catch {
    return jsonNoStore(
      {
        success: false,
        code: 'attendance_checkout_reminder_failed',
        message: 'Không thể hoàn tất tác vụ nhắc checkout.',
      },
      { status: 500 }
    );
  }
}
