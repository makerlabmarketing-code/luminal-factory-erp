export interface CommerceRaffle {
  id: string; title: string; slug: string; status: string;
  opens_at: string | null; closes_at: string | null; is_published: boolean; is_test: boolean;
  summary: string | null; rules_summary: string | null;
  product_id: string | null; variant_id: string | null; rules_version: string;
}
export interface CommerceRaffleEntry {
  id: string; raffle_id: string; contact_email: string; display_name: string;
  accepted_at: string; shipping: { recipient_name: string; address_line_1: string;
    address_line_2: string | null; city: string; state_province: string;
    postal_code: string | null; country_code: string; phone: string | null } | null;
}
export const isRaffleUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function isCommerceRaffle(value: unknown): value is CommerceRaffle {
  return record(value) && typeof value.id === 'string' && isRaffleUuid(value.id) &&
    ['title','slug','status','rules_version'].every(key => typeof value[key] === 'string') &&
    ['product_id','variant_id'].every(key => { const id = value[key]; return id === null || typeof id === 'string' && isRaffleUuid(id); }) &&
    ['opens_at','closes_at','summary','rules_summary'].every(key => value[key] === null || typeof value[key] === 'string') &&
    typeof value.is_published === 'boolean' && typeof value.is_test === 'boolean';
}
export function isCommerceRaffleEntry(value: unknown): value is CommerceRaffleEntry {
  if (!record(value) || typeof value.id !== 'string' || !isRaffleUuid(value.id) || typeof value.raffle_id !== 'string' || !isRaffleUuid(value.raffle_id) ||
    !['contact_email','display_name','accepted_at'].every(key => typeof value[key] === 'string')) return false;
  if (value.shipping === null) return true;
  const shipping = value.shipping;
  return record(shipping) && ['recipient_name','address_line_1','city','state_province','country_code'].every(key => typeof shipping[key] === 'string') &&
    ['address_line_2','postal_code','phone'].every(key => shipping[key] === null || typeof shipping[key] === 'string');
}
