import { NextResponse } from 'next/server';
import { AuthFlowError } from '@/services/server/auth';
import { getActivityHistory } from '@/services/server/activityHistory';
export async function GET(request: Request) {
  try {
    const url=new URL(request.url), entity=url.searchParams.get('entity');
    if(entity!=='employee' && entity!=='ledger') return NextResponse.json({message:'Loại lịch sử không hợp lệ.'},{status:400});
    return NextResponse.json(await getActivityHistory(entity,url.searchParams.get('id')||'',url.searchParams.get('before')||undefined),{headers:{'Cache-Control':'no-store'}});
  } catch(error) { return NextResponse.json({message:error instanceof AuthFlowError ? error.message : 'Không thể tải lịch sử.'},{status:error instanceof AuthFlowError ? error.status : 500,headers:{'Cache-Control':'no-store'}}); }
}
