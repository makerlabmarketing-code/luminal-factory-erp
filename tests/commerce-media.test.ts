import { describe,it,expect,vi } from 'vitest';
import { isMediaAsset,isMediaManifest,isMediaPresentation,isMediaTicket,parseMediaMutation,mediaPath } from '../lib/commerce-admin/media-input';
const id='550e8400-e29b-41d4-a716-446655440000';const aid='550e8400-e29b-41d4-a716-446655440001';const target={productId:id,variantId:null};
const asset={id:aid,path:mediaPath(target,aid),fileName:'test.webp',sizeBytes:100,width:10,height:10,alt:'Photo',removed:false};const manifest={...target,assets:[asset],revision:1,primaryId:aid};
describe('ERP media boundary',()=>{
 it('validates cover/target/paths and rejects oversized or unknown fields',()=>{
  expect(isMediaAsset(asset)).toBe(true);expect(isMediaAsset({...asset,extra:1})).toBe(false);expect(isMediaAsset({...asset,sizeBytes:3*1024*1024})).toBe(false);
  expect(isMediaManifest(manifest,target)).toBe(true);expect(isMediaManifest({...manifest,primaryId:null},target)).toBe(false);expect(isMediaManifest(manifest,{productId:aid,variantId:null})).toBe(false);
  expect(isMediaPresentation({...manifest,previews:[{id:aid,url:'https://storage.test/photo'}]},target)).toBe(true);
  expect(isMediaPresentation({...manifest,previews:[{id:aid,url:'javascript:alert(1)'}]},target)).toBe(false);
  expect(parseMediaMutation({operationId:aid,expectedRevision:0,assets:[{id:aid,alt:'Photo',removed:true}],primaryId:null},false)).not.toBeNull();
  expect(parseMediaMutation({operationId:aid,expectedRevision:0,assets:[{id:aid,alt:'Photo',removed:true},{id:aid,alt:'Photo',removed:true}],primaryId:null},false)).toBeNull();
 });
 it('accepts only a signed upload endpoint bound to the exact target and asset',()=>{
  const input={assetId:aid,fileName:'test.webp',sizeBytes:100};const ticket={assetId:aid,path:asset.path,sizeBytes:100,expiresInSeconds:7200,signedUrl:`https://storage.test/storage/v1/object/upload/sign/catalog-media-drafts/${asset.path}?token=signed`};
  expect(isMediaTicket(ticket,target,input)).toBe(true);expect(isMediaTicket({...ticket,signedUrl:'https://storage.test/upload?token=signed'},target,input)).toBe(false);expect(isMediaTicket(ticket,{productId:aid,variantId:null},input)).toBe(false);
 });
});
vi.mock('@/lib/commerce-admin/product-input',()=>import('../lib/commerce-admin/product-input'));
vi.mock('@/lib/commerce-admin/media-input',()=>import('../lib/commerce-admin/media-input'));
vi.mock('server-only',()=>({}));
const access=vi.fn();const transport=vi.fn();
vi.mock('../services/server/commerceAdminProductAccess',()=>({requireCommerceProductAccess:(...args:unknown[])=>access(...args)}));
vi.mock('../services/server/commerceAdminMedia',()=>({requestMedia:(...args:unknown[])=>transport(...args)}));
vi.mock('../services/server/commerceAdminRouteResponse',()=>({commerceAdminJson:(body:unknown,init?:ResponseInit)=>Response.json(body,init),commerceAdminRouteError:()=>new Response(null,{status:403})}));
it('ERP route denies before calling the signed transport',async()=>{
 const {handleErpMedia}=await import('../services/server/commerceAdminMediaRoute');access.mockRejectedValueOnce(new Error());
 expect((await handleErpMedia(new Request('https://erp.test'),Promise.resolve({id}))).status).toBe(403);expect(transport).not.toHaveBeenCalled();
 access.mockResolvedValue(undefined);expect((await handleErpMedia(new Request('https://erp.test',{method:'POST',body:'{}'}),Promise.resolve({id}))).status).toBe(400);expect(access).toHaveBeenLastCalledWith('COMMERCE_PRODUCT_MANAGE');expect(transport).not.toHaveBeenCalled();
});
