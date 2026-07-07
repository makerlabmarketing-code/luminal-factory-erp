import { NextResponse } from 'next/server';
import { getCheckoutReminderCandidates, sendTemplateEmailByGroup } from '@/services/emailService';

const CHECKOUT_REMINDER_GROUP = 'ATTENDANCE_CHECKOUT_REMINDER';

export async function GET() {
  try {
    const candidates = await getCheckoutReminderCandidates();

    if (candidates.length === 0) {
      return NextResponse.json({
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

    return NextResponse.json({
      success: true,
      sent,
      skipped,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Lỗi cron nhắc checkout.';

    return NextResponse.json(
      {
        error: message,
      },
      { status: 500 }
    );
  }
}
