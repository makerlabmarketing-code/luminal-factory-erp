import 'server-only';
import { AuthFlowError, hasPermission, requireSystemOwner } from './auth';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
export async function setTestLedgerArchived(ledgerId: number, body: Record<string, unknown>) {
 const auth = await requireSystemOwner();
 if (!(await hasPermission(auth, 'FINANCE_UPDATE'))) throw new AuthFlowError({status:403,code:'permission_forbidden',message:'Bạn không có quyền sửa sổ thu chi.',failureStage:'permission_check'});
 if (process.env.FINANCE_TEST_ARCHIVE_ENABLED !== 'true') throw new AuthFlowError({status:503,code:'payload_validation_failed',message:'Xóa bản ghi thử chưa được bật.',failureStage:'validation'});
 if (body.confirmedTest !== true || String(body.confirmId) !== String(ledgerId) || typeof body.archived !== 'boolean' || typeof body.reason !== 'string' || body.reason.trim().length < 10 || body.reason.trim().length > 500) throw new AuthFlowError({status:400,code:'payload_validation_failed',message:'Xác nhận bản ghi thử, nhập đúng mã và lý do 10–500 ký tự.',failureStage:'validation'});
 const {error} = await createSupabaseAdminClient().rpc('set_test_ledger_archived',{p_id:ledgerId,p_archived:body.archived,p_actor_id:auth.employee.id,p_reason:body.reason.trim()});
 if(error) throw new AuthFlowError({status:409,code:'payload_validation_failed',message:'Không thể xóa hoặc khôi phục. Chỉ hỗ trợ phiếu hoàn ứng thử độc lập; tải lại để kiểm tra trạng thái.',failureStage:'persistence'});
 return {success:true};
}
