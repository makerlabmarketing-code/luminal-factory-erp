import { describe, expect, it } from 'vitest';
import { customerShippingMinor, parseShippingUsd } from '../lib/commerce-admin/raffle-shipping';

describe('raffle shipping rates', () => {
  it('subtracts support and clamps at zero', () => {
    expect(customerShippingMinor({ country_code: 'US', carrier_minor: 1600, covered_minor: 800 })).toBe(800);
    expect(customerShippingMinor({ country_code: 'SG', carrier_minor: 400, covered_minor: 800 })).toBe(0);
    expect(customerShippingMinor({ country_code: 'VN', carrier_minor: 800, covered_minor: 0 })).toBe(0);
  });

  it('parses USD into integer cents without rounding fractional cents', () => {
    expect(parseShippingUsd('16.09')).toBe(1609);
    expect(parseShippingUsd('8.1')).toBe(810);
    expect(parseShippingUsd('0')).toBe(0);
    expect(parseShippingUsd('8.009')).toBeNull();
    expect(parseShippingUsd('-1')).toBeNull();
    expect(parseShippingUsd('10000.01')).toBeNull();
  });
});
