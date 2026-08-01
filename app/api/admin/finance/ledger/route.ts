import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { createAdminFinancialLedger, listAdminFinancialLedger } from '@/services/server/adminFinancialLedger';

function failure(error: unknown) {
  const status = error instanceof AuthFlowError ? error.status : 500;
  const message = error instanceof AuthFlowError ? error.message : 'Không thể xử lý sổ thu chi.';
  if (!(error instanceof AuthFlowError)) console.error('[admin-finance-ledger-route]', { errorName: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ success: false, message }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nội dung yêu cầu không phải JSON hợp lệ.', failureStage: 'validation' });
  }
}

export async function GET(request: Request) {
  try {
    const month = new URL(request.url).searchParams.get('month') || '';
    return NextResponse.json(await listAdminFinancialLedger(month), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  try {
    return NextResponse.json(await createAdminFinancialLedger(await jsonBody(request)), { status: 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
