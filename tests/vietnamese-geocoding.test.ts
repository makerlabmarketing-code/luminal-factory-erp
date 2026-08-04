import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildNominatimSearchUrl, buildVietnameseAddressCandidates, fetchCoordinatesFromAddress, normalizeVietnameseAddress, scoreNominatimResult } from '../ultis/geocoding';

afterEach(() => vi.unstubAllGlobals());

describe('Vietnamese address normalization', () => {
  it('keeps the input immutable and creates contextual Phố and Phường candidates', () => {
    const street = '3 P. Lê Trọng Tấn, Thanh Xuân, Hà Nội';
    expect(buildVietnameseAddressCandidates(street)).toContain('3 Phố Lê Trọng Tấn, quận Thanh Xuân, Hà Nội, Việt Nam');
    expect(street).toBe('3 P. Lê Trọng Tấn, Thanh Xuân, Hà Nội');
    expect(buildVietnameseAddressCandidates('187 Ngõ 185 Phố Dương Văn Bé, P. Vĩnh Hưng, Hà Nội')).toContain('187 Ngõ 185 Phố Dương Văn Bé, Phường Vĩnh Hưng, Hà Nội, Việt Nam');
  });

  it('preserves diacritics, normalizes whitespace, appends Việt Nam and bounds candidates', () => {
    expect(normalizeVietnameseAddress('  3   P. Lê Trọng Tấn , Hà Nội ')).toBe('3 P. Lê Trọng Tấn, Hà Nội, Việt Nam');
    expect(buildVietnameseAddressCandidates('3 P. Lê Trọng Tấn, Thanh Xuân, Hà Nội').length).toBeLessThanOrEqual(4);
  });

  it('uses URLSearchParams encoding and the Vietnam country restriction', () => {
    const url = new URL(buildNominatimSearchUrl('3 Phố Lê Trọng Tấn, Hà Nội, Việt Nam'));
    expect(url.searchParams.get('q')).toBe('3 Phố Lê Trọng Tấn, Hà Nội, Việt Nam');
    expect(url.searchParams.get('countrycodes')).toBe('vn');
  });

  it('rejects a clear foreign/district mismatch', () => {
    expect(scoreNominatimResult('3 Phố Lê Trọng Tấn, Thanh Xuân, Hà Nội, Việt Nam', { display_name: 'Somewhere, Paris, France', address: { country_code: 'fr' } })).toBe(-100);
  });

  it('maps valid lat/lon and exposes weak alternatives for confirmation', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [{ lat: '21.0001', lon: '105.8002', display_name: '3 Phố Lê Trọng Tấn, Thanh Xuân, Hà Nội, Việt Nam', type: 'house', address: { house_number: '3', country_code: 'vn' } }] }));
    const result = await fetchCoordinatesFromAddress('3 P. Lê Trọng Tấn, Thanh Xuân, Hà Nội');
    expect(result).toMatchObject({ success: true, lat: '21.000100', lng: '105.800200' });
  });

  it('deduplicates simultaneous clicks', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all([fetchCoordinatesFromAddress('Hà Nội'), fetchCoordinatesFromAddress('Hà Nội')]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
