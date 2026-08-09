import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import {
  addPayrollAdjustment,
  configurePayrollFirstMonth,
  getAdminPayroll,
  getAdminPayrollReadiness,
  settlePayroll,
} from '@/services/server/payroll';

function failure(error: unknown) {
  return NextResponse.json(
    { success: false, message: error instanceof Error ? error.message : 'Không thể xử lý bảng lương.' },
    { status: error instanceof AuthFlowError ? error.status : 500, headers: { 'Cache-Control': 'no-store' } }
  );
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    if (url.searchParams.get('mode') === 'readiness') {
      return NextResponse.json(await getAdminPayrollReadiness(), { headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json(await getAdminPayroll(url.searchParams.get('month') || ''), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === 'configure') return NextResponse.json(await configurePayrollFirstMonth(body.month));
    if (body.action === 'settle') return NextResponse.json(await settlePayroll(body.employeeId, body.month));
    if (body.action === 'adjust') return NextResponse.json(await addPayrollAdjustment(body.settlementId, body.amount, body.reason));
    return NextResponse.json({ success: false, message: 'Thao tác bảng lương không hợp lệ.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
