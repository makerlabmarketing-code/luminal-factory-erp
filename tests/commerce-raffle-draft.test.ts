import { describe,it,expect } from 'vitest';
import { canEditRaffleInformation,parseRaffleInformationMutation,raffleDateToVietnamInput,raffleVietnamInputToDate } from '../lib/commerce-admin/raffle-draft';
import type { CommerceRaffle } from '../lib/commerce-admin/raffle-input';
const raffle:CommerceRaffle={id:'550e8400-e29b-41d4-a716-446655440000',slug:'comeback',title:'Comeback',status:'DRAFT',is_test:false,is_published:false,opens_at:'2026-10-10T05:00:00Z',closes_at:'2026-10-12T05:00:00Z',summary:null,rules_summary:null,rules_version:'v1',product_id:null,variant_id:null};
const mutation={operationId:raffle.id,information:{title:' Comeback ',summary:null,rulesSummary:'Rules',opensAt:raffle.opens_at,closesAt:raffle.closes_at}};
describe('raffle draft information',()=>{
 it('normalizes information without accepting lifecycle, product or price fields',()=>{
  expect(parseRaffleInformationMutation(mutation)?.information.title).toBe('Comeback');
  for(const field of ['status','isTest','productId','variantId','price','isPublished'])
   expect(parseRaffleInformationMutation({...mutation,information:{...mutation.information,[field]:'injected'}})).toBeNull();
  expect(parseRaffleInformationMutation({...mutation,operationId:'../invalid'})).toBeNull();
 });
 it('rejects inverted/equal windows, invalid calendar days and offset-less timestamps',()=>{
  for(const opensAt of ['2026-10-12T05:00:00Z','2026-10-13T05:00:00Z','2026-02-30T05:00:00Z','2026-10-10T05:00:00','2026-10-10T24:00:00Z'])
   expect(parseRaffleInformationMutation({...mutation,information:{...mutation.information,opensAt}})).toBeNull();
  expect(parseRaffleInformationMutation({...mutation,information:{...mutation.information,title:'',rulesSummary:'x'.repeat(8001)}})).toBeNull();
 });
 it('converts Vietnam local input independent of runtime timezone, preserving seconds and the 48h window',()=>{
  expect(raffleDateToVietnamInput('2026-10-10T05:00:17Z')).toBe('2026-10-10T12:00:17');
  expect(raffleVietnamInputToDate('2026-10-10T12:00:17')).toBe('2026-10-10T05:00:17.000Z');
  expect(raffleVietnamInputToDate('2026-10-10T12:00')).toBe('2026-10-10T05:00:00.000Z');
  expect(raffleVietnamInputToDate('2026-02-30T12:00')).toBeNull();
  expect(raffleDateToVietnamInput('2026-10-10T20:00:00Z')).toBe('2026-10-11T03:00:00');
  expect(Date.parse(raffle.closes_at!)-Date.parse(raffle.opens_at!)).toBe(48*60*60*1000);
 });
 it('does not offer information edits for public, test or non-draft releases',()=>{
  expect(canEditRaffleInformation(raffle)).toBe(true);
  for(const change of [{is_published:true},{is_test:true},{status:'OPEN'},{status:'SCHEDULED'},{status:'CLOSED'}])expect(canEditRaffleInformation({...raffle,...change})).toBe(false);
 });
});
