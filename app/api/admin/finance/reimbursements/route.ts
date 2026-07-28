import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { transitionReimbursement } from '@/services/server/financeReimbursements';

export async function POST(request: Request) {
  try { return NextResponse.json(await transitionReimbursement(await request.json() as Record<string, unknown>)); }
  catch (error) { return NextResponse.json({ success: false, message: error instanceof AuthFlowError ? error.message : 'Không thể cập nhật hoàn ứng.' }, { status: error instanceof AuthFlowError ? error.status : 500 }); }
}
