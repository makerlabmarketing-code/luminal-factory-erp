import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { getOwnPayroll } from '@/services/server/payroll';

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get('month') || '';
    return NextResponse.json(await getOwnPayroll(month), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof AuthFlowError ? error.status : 500;
    const message = error instanceof Error ? error.message : 'Không thể tải bảng lương.';
    return NextResponse.json({ success: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
