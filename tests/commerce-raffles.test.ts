import { describe,it,expect } from 'vitest';
import { isCommerceRaffleEntry,isRaffleUuid } from '../lib/commerce-admin/raffle-input';
import { filterAdminNavigation } from '../lib/navigation/admin';
const entry={id:'550e8400-e29b-41d4-a716-446655440000',raffle_id:'550e8400-e29b-41d4-a716-446655440001',contact_email:'guest@example.test',display_name:'Guest',accepted_at:'2026-10-10T05:00:00Z',shipping:null};
describe('raffle entrant boundary',()=>{
 it('requires a dedicated raffle permission in navigation',()=>{
  const paths=(codes:string[])=>filterAdminNavigation(codes).flatMap(group=>group.items.map(item=>item.path));
  expect(paths(['COMMERCE_PRODUCT_VIEW'])).not.toContain('/admin/commerce/raffles');
  expect(paths(['COMMERCE_RAFFLE_VIEW'])).toContain('/admin/commerce/raffles');
 });
 it('rejects malformed IDs and partial shipping payloads',()=>{
  expect(isRaffleUuid('../products')).toBe(false);
  expect(isCommerceRaffleEntry(entry)).toBe(true);
  expect(isCommerceRaffleEntry({...entry,shipping:{recipient_name:'Guest'}})).toBe(false);
  expect(isCommerceRaffleEntry({...entry,contact_email:123})).toBe(false);
 });
});
