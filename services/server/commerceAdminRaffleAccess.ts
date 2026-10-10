import 'server-only';
import { AuthFlowError, hasPermission, requireWorkspaceAccess } from './auth';
export async function requireCommerceRaffleAccess(capability: 'COMMERCE_RAFFLE_VIEW' | 'COMMERCE_RAFFLE_MANAGE') {
  const context = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  if (!(await hasPermission(context, capability))) throw new AuthFlowError({status:403,code:'permission_forbidden',
    message:'Bạn không có quyền thực hiện thao tác raffle.',failureStage:'permission_check'});
  return context;
}
