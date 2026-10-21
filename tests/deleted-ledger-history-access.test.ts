import {beforeEach,afterEach,describe,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({owner:false,permission:true,failLedger:false,ledger:[{id:115,cancelled_at:'2026-10-21'},{id:116,cancelled_at:null}],events:[] as Array<Record<string,unknown>>,reads:[] as string[]}));
vi.mock('server-only',()=>({}));
vi.mock('../services/server/auth',()=>({AuthFlowError:class extends Error{status:number;constructor(input:{status:number;message:string}){super(input.message);this.status=input.status;}},requireWorkspaceAccess:async()=>({employee:{id:3}}),hasPermission:async()=>state.permission,isSystemOwner:()=>state.owner}));
vi.mock('@/lib/activity-history',()=>import('../lib/activity-history'));
vi.mock('@/lib/activity-history-labels',()=>import('../lib/activity-history-labels'));
vi.mock('@/utils/supabase/admin',()=>({createSupabaseAdminClient:()=>({from:(table:string)=>{
 state.reads.push(table);let target:string|undefined,ids:string[]|undefined,active=false;
 const result=()=>{if(table==='financial_ledger'){const rows=state.ledger.filter(row=>(!target||String(row.id)===target)&&(!ids||ids.includes(String(row.id)))&&(!active||!row.cancelled_at));return {data:rows,error:state.failLedger?{message:'unavailable'}:null};}return {data:table==='erp_activity_events'?state.events:[],error:null};};
 const chain={select:()=>chain,order:()=>chain,limit:()=>chain,or:()=>chain,lt:()=>chain,eq:(key:string,value:unknown)=>{if(table==='financial_ledger'&&key==='id')target=String(value);return chain;},is:(key:string)=>{if(key==='cancelled_at')active=true;return chain;},in:(_key:string,values:string[])=>{ids=values;return chain;},maybeSingle:async()=>{const r=result();return {...r,data:r.data[0]||null};},then:(resolve:(value:unknown)=>unknown)=>Promise.resolve(result()).then(resolve)};return chain;}})}));
import {getActivityHistory} from '../services/server/activityHistory';
const event=(id:number,entityId=115)=>({id,entity:'ledger',entity_id:entityId,actor_employee_id:null,occurred_at:'2026-10-21',action:'UPDATE',screen:'Sổ thu chi',summary:'Test history',changes_text:''});
beforeEach(()=>{vi.stubEnv('ERP_ACTIVITY_HISTORY_ENABLED','true');state.owner=false;state.permission=true;state.failLedger=false;state.reads=[];state.events=[event(1)];});afterEach(()=>vi.unstubAllEnvs());
describe('deleted ledger history visibility',()=>{
 it('denies a direct deleted-record history URL to finance users before reading events',async()=>{await expect(getActivityHistory('ledger','115')).rejects.toMatchObject({status:404});expect(state.reads).not.toContain('erp_activity_events');});
 it('allows the super admin and keeps active ledger history available to finance users',async()=>{state.owner=true;expect((await getActivityHistory('ledger','115')).events).toHaveLength(1);state.owner=false;state.events=[event(2,116)];expect((await getActivityHistory('ledger','116')).events).toHaveLength(1);});
 it('removes deleted finance events from employee timelines without dropping pagination',async()=>{state.events=Array.from({length:51},(_,i)=>event(100-i));const result=await getActivityHistory('employee','3');expect(result.events).toEqual([]);expect(result.nextCursor).toBe('51');});
 it('fails closed when ledger visibility cannot be checked',async()=>{state.failLedger=true;await expect(getActivityHistory('ledger','115')).rejects.toMatchObject({status:503});});
 it('still requires the finance permission',async()=>{state.permission=false;await expect(getActivityHistory('ledger','116')).rejects.toMatchObject({status:403});});
});
