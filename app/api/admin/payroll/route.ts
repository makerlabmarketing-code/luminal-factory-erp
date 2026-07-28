import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { addPayrollAdjustment, getAdminPayroll, settlePayroll } from '@/services/server/payroll';

function failure(error: unknown) {
  return NextResponse.json({ success: false, message: error instanceof Error ? error.message : 'Không thể xử lý bảng lương.' }, { status: error instanceof AuthFlowError ? error.status : 500 });
}
export async function GET(request: Request) {
  try { return NextResponse.json(await getAdminPayroll(new URL(request.url).searchParams.get('month') || ''), { headers: { 'Cache-Control': 'no-store' } }); }
  catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === 'settle') return NextResponse.json(await settlePayroll(body.employeeId, body.month));
    if (body.action === 'adjust') return NextResponse.json(await addPayrollAdjustment(body.settlementId, body.amount, body.reason));
    return NextResponse.json({ success: false, message: 'Thao tác bảng lương không hợp lệ.' }, { status: 400 });
  } catch (error) { return failure(error); }
}
