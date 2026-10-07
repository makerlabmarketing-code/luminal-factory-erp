import 'server-only';
import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from './auth';
import { activityHref, type ActivityEntity, type ActivityEvent } from '@/lib/activity-history';

export { activityHistoryEnabled } from './activityGate';
import { activityHistoryEnabled } from './activityGate';
export async function getActivityHistory(entity: ActivityEntity, entityId: string, before?: string) {
  if (!/^[1-9]\d{0,18}$/.test(entityId) || (before && !/^[1-9]\d{0,18}$/.test(before))) throw new AuthFlowError({status:400,code:'payload_validation_failed',message:'Mã lịch sử không hợp lệ.',failureStage:'validation'});
  const auth = await requireWorkspaceAccess('ADMIN_WORKSPACE', {allowLegacyAdminFallback:true});
  if (!(await hasPermission(auth, entity === 'employee' ? 'EMPLOYEE_VIEW' : 'FINANCE_VIEW'))) throw new AuthFlowError({status:403,code:'permission_forbidden',message:'Bạn không có quyền xem lịch sử này.',failureStage:'permission_check'});
  if (!activityHistoryEnabled()) return { enabled:false, events:[] as ActivityEvent[], nextCursor:null };
  const admin=createSupabaseAdminClient();
  let query=admin.from('erp_activity_events').select('id,occurred_at,actor_employee_id,action,entity,entity_id,screen,summary,changes_text').order('id',{ascending:false}).limit(51);
  if(entity==='employee') {
    const financeAllowed=await hasPermission(auth,'FINANCE_VIEW');
    query=query.or(`actor_employee_id.eq.${entityId},and(entity.eq.employee,entity_id.eq.${entityId})`);
    if(!financeAllowed) query=query.eq('entity','employee');
  } else query=query.eq('entity','ledger').eq('entity_id',entityId);
  if(before) query=query.lt('id',before);
  const {data,error}=await query;
  if(error) throw new AuthFlowError({status:503,code:'service_unavailable',message:'Không thể tải lịch sử. Vui lòng thử lại.',failureStage:'persistence'});
  const rows=data || [], ids=Array.from(new Set(rows.map(row=>row.actor_employee_id).filter(Boolean)));
  const names=new Map<string,string>();
  if(ids.length) { const result=await admin.from('employees').select('id,full_name').in('id',ids); if(result.error) throw new AuthFlowError({status:503,code:'service_unavailable',message:'Không thể tải người thao tác.',failureStage:'persistence'}); for(const row of result.data||[]) names.set(String(row.id),row.full_name); }
  const events:ActivityEvent[]=rows.slice(0,50).map(row=>({id:String(row.id),occurredAt:row.occurred_at,actorName:row.actor_employee_id ? names.get(String(row.actor_employee_id))||'Nhân sự không còn trong danh sách' : 'Hệ thống / không xác định người thao tác',action:row.action,entity:row.entity,entityId:String(row.entity_id),screen:row.screen,summary:row.summary,changesText:row.changes_text,href:activityHref(row.entity,String(row.entity_id))}));
  return {enabled:true,events,nextCursor:rows.length>50 ? events[events.length-1].id : null};
}
