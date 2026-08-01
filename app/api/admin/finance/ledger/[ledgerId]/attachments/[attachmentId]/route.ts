import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { removeAdminLedgerAttachment, replaceAdminLedgerAttachment } from '@/services/server/adminFinancialLedger';

function ids(params: { ledgerId: string; attachmentId: string }) {
  const ledgerId = Number(params.ledgerId);
  const attachmentId = Number(params.attachmentId);
  if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0 || !Number.isSafeInteger(attachmentId) || attachmentId <= 0) {
    throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Mã chứng từ không hợp lệ.', failureStage: 'validation' });
  }
  return { ledgerId, attachmentId };
}

function failure(error: unknown) {
  const status = error instanceof AuthFlowError ? error.status : 500;
  if (!(error instanceof AuthFlowError)) console.error('[admin-finance-attachment-route]', { errorName: error instanceof Error ? error.name : 'unknown' });
  return NextResponse.json({ success: false, message: error instanceof AuthFlowError ? error.message : 'Không thể cập nhật chứng từ.' }, { status, headers: { 'Cache-Control': 'no-store' } });
}

export async function PUT(request: Request, { params }: { params: { ledgerId: string; attachmentId: string } }) {
  try {
    const parsed = ids(params);
    const file = (await request.formData()).get('file');
    if (!(file instanceof File)) throw new AuthFlowError({ status: 400, code: 'payload_validation_failed', message: 'Vui lòng chọn chứng từ thay thế.', failureStage: 'validation' });
    const result = await replaceAdminLedgerAttachment(parsed.ledgerId, parsed.attachmentId, file);
    return NextResponse.json(result, { status: result.cleanupPending ? 202 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: { ledgerId: string; attachmentId: string } }) {
  try {
    const parsed = ids(params);
    const result = await removeAdminLedgerAttachment(parsed.ledgerId, parsed.attachmentId);
    return NextResponse.json(result, { status: result.cleanupPending ? 202 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return failure(error);
  }
}
