import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { uploadOwnReimbursementAttachment } from '@/services/server/financeReimbursements';

function failure(error: unknown) {
  const status = error instanceof AuthFlowError ? error.status : 500;
  if (!(error instanceof AuthFlowError)) {
    console.error('[staff-reimbursement-attachment-upload]', {
      errorName: error instanceof Error ? error.name : 'unknown',
    });
  }
  return NextResponse.json(
    {
      success: false,
      message: error instanceof AuthFlowError ? error.message : 'Không thể tải chứng từ hoàn ứng.',
    },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

export async function POST(request: Request, props: { params: Promise<{ ledgerId: string }> }) {
  const params = await props.params;
  try {
    const ledgerId = Number(params.ledgerId);
    if (!Number.isSafeInteger(ledgerId) || ledgerId <= 0) {
      throw new AuthFlowError({
        status: 400,
        code: 'payload_validation_failed',
        message: 'Mã phiếu hoàn ứng không hợp lệ.',
        failureStage: 'validation',
      });
    }
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      throw new AuthFlowError({
        status: 400,
        code: 'payload_validation_failed',
        message: 'Vui lòng chọn chứng từ.',
        failureStage: 'validation',
      });
    }
    return NextResponse.json(await uploadOwnReimbursementAttachment(ledgerId, file), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
