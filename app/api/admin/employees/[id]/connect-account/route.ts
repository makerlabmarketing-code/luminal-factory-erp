import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { connectEmployeeAuthAccount } from '@/services/server/adminEmployeeActions';

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const correlationId = crypto.randomUUID();
  try {
    const result = await connectEmployeeAuthAccount(params.id, correlationId);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const status = error instanceof AuthFlowError ? error.status : 500;
    const message = error instanceof AuthFlowError ? error.message : 'Không thể kết nối tài khoản.';
    const code = error instanceof AuthFlowError ? error.code : 'employee_auth_connection_failed';
    return NextResponse.json({ success: false, code, message, correlationId }, { status, headers: { 'Cache-Control': 'no-store' } });
  }
}
