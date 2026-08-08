import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { setAdminFinancialLedgerPaid } from '@/services/server/adminFinancialLedger';
import { updateAdminFinancialLedgerAtomicAware } from '@/services/server/adminFinancialLedgerAtomic';

function id(value: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Mã giao dịch không hợp lệ.', failureStage: 'validation' });
  return parsed;
}

function failure(error: unknown) {
  const status = error instanceof AuthFlowError ? error.status : 500;
  if (!(error instanceof AuthFlowError)) console.error('[admin-finance-ledger-entry-route]', { errorName: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ success: false, message: error instanceof AuthFlowError ? error.message : 'Không thể cập nhật giao dịch.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try {
    return await request.json() as Record<string, unknown>;
  } catch {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Nội dung yêu cầu không phải JSON hợp lệ.', failureStage: 'validation' });
  }
}

export async function PUT(request: Request, { params }: { params: { ledgerId: string } }) {
  try {
    return NextResponse.json(await updateAdminFinancialLedgerAtomicAware(id(params.ledgerId), await jsonBody(request)));
  } catch (error) {
    return failure(error);
  }
}

export async function PATCH(request: Request, { params }: { params: { ledgerId: string } }) {
  try {
    const body = await jsonBody(request) as { isPaid?: unknown };
    if (typeof body.isPaid !== 'boolean') throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Trạng thái thanh toán không hợp lệ.', failureStage: 'validation' });
    return NextResponse.json(await setAdminFinancialLedgerPaid(id(params.ledgerId), body.isPaid));
  } catch (error) {
    return failure(error);
  }
}
