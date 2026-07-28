import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { listOwnReimbursements, submitOwnReimbursement } from '@/services/server/financeReimbursements';

function failure(error: unknown) {
  return NextResponse.json({ success: false, message: error instanceof AuthFlowError ? error.message : 'Không thể xử lý yêu cầu hoàn ứng.' }, { status: error instanceof AuthFlowError ? error.status : 500 });
}
export async function GET() {
  try { return NextResponse.json(await listOwnReimbursements(), { headers: { 'Cache-Control': 'no-store' } }); } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try { return NextResponse.json(await submitOwnReimbursement(await request.json() as Record<string, unknown>)); } catch (error) { return failure(error); }
}
