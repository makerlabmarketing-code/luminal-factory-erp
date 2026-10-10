import { parseRaffleInformationMutation } from '@/lib/commerce-admin/raffle-draft';
import { isRaffleUuid } from '@/lib/commerce-admin/raffle-input';
import { requireCommerceRaffleAccess } from '@/services/server/commerceAdminRaffleAccess';
import { updateCommerceRaffleInformation } from '@/services/server/commerceAdminRaffles';
import { commerceAdminJson, commerceAdminRouteError } from '@/services/server/commerceAdminRouteResponse';
export const dynamic = 'force-dynamic';
export async function PATCH(request: Request, {params}: {params: Promise<{id:string}>}) {
  try {
    await requireCommerceRaffleAccess('COMMERCE_RAFFLE_MANAGE');
    if (request.headers.get('origin') !== new URL(request.url).origin || request.headers.get('sec-fetch-site') === 'cross-site')
      return commerceAdminJson({success:false,message:'Nguồn yêu cầu không hợp lệ.'},{status:403});
    const {id} = await params;
    if (!isRaffleUuid(id)) return commerceAdminJson({success:false,message:'Mã raffle không hợp lệ.'},{status:400});
    if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
      return commerceAdminJson({success:false,message:'Định dạng yêu cầu không hợp lệ.'},{status:415});
    const reader = request.body?.getReader();
    let raw = '';
    if (reader) {
      const decoder = new TextDecoder('utf-8',{fatal:true});
      let size = 0;
      try {
        while (true) {
          const chunk = await reader.read();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 64_000) {
            await reader.cancel();
            return commerceAdminJson({success:false,message:'Thông tin vượt quá giới hạn.'},{status:413});
          }
          raw += decoder.decode(chunk.value,{stream:true});
        }
        raw += decoder.decode();
      } catch { return commerceAdminJson({success:false,message:'Nội dung yêu cầu không hợp lệ.'},{status:400}); }
      finally { reader.releaseLock(); }
    }
    let value: unknown;
    try { value = JSON.parse(raw); } catch { value = null; }
    const mutation = parseRaffleInformationMutation(value);
    if (!mutation) return commerceAdminJson({success:false,message:'Kiểm tra tên và lịch đóng sau lịch mở.'},{status:400});
    return commerceAdminJson({success:true,raffle:await updateCommerceRaffleInformation(id,mutation)});
  } catch(error) { return commerceAdminRouteError(error,'Không thể lưu thông tin raffle.'); }
}
