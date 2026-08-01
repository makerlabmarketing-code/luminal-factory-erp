import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { uploadAdminLedgerAttachment } from '@/services/server/adminFinancialLedger';

function failure(error: unknown) {
  const status = error instanceof AuthFlowError ? error.status : 500;
  if (!(error instanceof AuthFlowError)) console.error('[admin-finance-attachment-upload-route]', { errorName: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ success: false, message: error instanceof AuthFlowError ? error.message : 'Không thể tải chứng từ.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: Request, { params }: { params: { ledgerId: string } }) {
  try {
    const ledgerId = Number(params.ledgerId);
    if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Mã giao dịch không hợp lệ.', failureStage: 'validation' });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Vui lòng chọn chứng từ.', failureStage: 'validation' });
    return NextResponse.json(await uploadAdminLedgerAttachment(ledgerId, file), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
