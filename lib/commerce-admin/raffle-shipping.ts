export type RaffleShippingRateInput = {
  country_code: string;
  carrier_minor: number;
  covered_minor: number;
};

export type RaffleShippingRate = RaffleShippingRateInput & { customer_minor: number };

function isMoney(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 1_000_000;
}

export function isRaffleShippingRateInput(value: unknown): value is RaffleShippingRateInput {
  if (!value || typeof value !== 'object') return false;
  const rate = value as Partial<RaffleShippingRateInput>;
  return typeof rate.country_code === 'string' && /^[A-Z]{2}$/.test(rate.country_code)
    && isMoney(rate.carrier_minor) && isMoney(rate.covered_minor);
}

export function isRaffleShippingRate(value: unknown): value is RaffleShippingRate {
  return isRaffleShippingRateInput(value) && 'customer_minor' in value
    && value.customer_minor === customerShippingMinor(value);
}

export function customerShippingMinor(rate: RaffleShippingRateInput): number {
  return rate.country_code === 'VN' ? 0 : Math.max(rate.carrier_minor - rate.covered_minor, 0);
}

export function parseShippingUsd(value: string): number | null {
  if (!/^\d{1,5}(?:\.\d{1,2})?$/.test(value)) return null;
  const [whole, decimal = ''] = value.split('.');
  const minor = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  return isMoney(minor) ? minor : null;
}
