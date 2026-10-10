import { beforeEach,describe,it,expect,vi } from 'vitest';
const mocks=vi.hoisted(()=>({request:vi.fn(),access:vi.fn()}));
vi.mock('server-only',()=>({}));
vi.mock('@/services/server/auth',()=>({}));
vi.mock('@/services/server/commerceAdminIntegration',()=>({requestCommerceAdmin:mocks.request}));
vi.mock('../services/server/commerceAdminIntegration',()=>({requestCommerceAdmin:mocks.request,CommerceAdminIntegrationError:class extends Error {constructor(public code:string,message:string,public status:number){super(message);}}}));
vi.mock('../services/server/commerceAdminRaffleAccess',()=>({requireCommerceRaffleAccess:mocks.access}));
vi.mock('@/lib/commerce-admin/raffle-input',()=>import('../lib/commerce-admin/raffle-input'));
vi.mock('@/lib/commerce-admin/raffle-draft',()=>import('../lib/commerce-admin/raffle-draft'));
import { updateCommerceRaffleInformation } from '../services/server/commerceAdminRaffles';
const current={id:'550e8400-e29b-41d4-a716-446655440000',slug:'comeback',title:'Comeback',status:'DRAFT',is_test:false,is_published:false,opens_at:'2026-10-10T05:00:00Z',closes_at:'2026-10-12T05:00:00Z',summary:null,rules_summary:null,rules_version:'v1',product_id:null,variant_id:null};
const mutation={operationId:current.id,information:{title:'New title',summary:null,rulesSummary:'Rules',opensAt:current.opens_at,closesAt:current.closes_at}};
beforeEach(()=>{vi.clearAllMocks();mocks.access.mockResolvedValue({});});
describe('raffle information write boundary',()=>{
 it('denies writes before data access when manage permission is absent',async()=>{
  mocks.access.mockRejectedValueOnce(Error('denied'));
  await expect(updateCommerceRaffleInformation(current.id,mutation)).rejects.toThrow('denied');
  expect(mocks.request).not.toHaveBeenCalled();
 });
 it('rejects a currently published release before submitting a mutation',async()=>{
  mocks.request.mockResolvedValueOnce([{...current,is_published:true}]);
  await expect(updateCommerceRaffleInformation(current.id,mutation)).rejects.toThrow('Chỉ sửa');
  expect(mocks.request).toHaveBeenCalledTimes(1);
 });
 it('preserves metadata and operation ID, using the dedicated raffle write scope',async()=>{
  mocks.request.mockResolvedValueOnce([current]).mockResolvedValueOnce({...current,title:'New title'});
  await updateCommerceRaffleInformation(current.id,mutation);
  const [endpoint,guard]=mocks.request.mock.calls[1];
  expect(endpoint).toMatchObject({capability:'COMMERCE_RAFFLE_MANAGE',scope:'commerce.raffle.write',method:'PATCH',path:`/api/admin/v1/raffles/${current.id}`,body:{operationId:mutation.operationId,draft:{slug:current.slug,rulesVersion:'v1',productId:null,variantId:null,status:'DRAFT',isTest:false}}});
  expect(guard(current)).toBe(true);expect(guard({...current,id:'550e8400-e29b-41d4-a716-446655440001'})).toBe(false);
 });
});
