import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function disabledResponse() {
  const response = NextResponse.json(
    {
      success: false,
      code: 'monthly_payroll_cron_disabled',
      message: 'Tác vụ lương tháng tự động chưa được kích hoạt.',
    },
    { status: 410 }
  );
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export async function GET() {
  return disabledResponse();
}

export async function POST() {
  return disabledResponse();
}
