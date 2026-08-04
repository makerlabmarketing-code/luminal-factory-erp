export type GeocodeErrorCode =
  | 'empty_address'
  | 'no_match'
  | 'ambiguous'
  | 'malformed_response'
  | 'rate_limited'
  | 'network_failure'
  | 'invalid_coordinates';

export interface GeocodeMatch {
  lat: string;
  lng: string;
  displayName: string;
  normalizedQuery: string;
  confidence: 'high' | 'medium' | 'low';
  selectionReason: string;
}

export interface GeocodeResponse {
  lat: string;
  lng: string;
  success: boolean;
  displayName?: string;
  normalizedQuery?: string;
  confidence?: GeocodeMatch['confidence'];
  selectionReason?: string;
  alternatives?: GeocodeMatch[];
  error?: string;
  errorCode?: GeocodeErrorCode;
}

type NominatimResult = {
  lat?: unknown;
  lon?: unknown;
  display_name?: unknown;
  class?: unknown;
  type?: unknown;
  importance?: unknown;
  address?: Record<string, unknown>;
};

const MAX_CANDIDATES = 4;
const ERROR_MESSAGES: Record<GeocodeErrorCode, string> = {
  empty_address: 'Địa chỉ không được để trống.',
  no_match: 'Không tìm thấy địa chỉ phù hợp.',
  ambiguous: 'Địa chỉ có nhiều kết quả gần giống, vui lòng chọn lại.',
  malformed_response: 'Dịch vụ bản đồ trả về dữ liệu không hợp lệ.',
  rate_limited: 'Dịch vụ bản đồ đang giới hạn yêu cầu. Vui lòng thử lại sau.',
  network_failure: 'Không thể kết nối dịch vụ bản đồ.',
  invalid_coordinates: 'Dịch vụ bản đồ trả về tọa độ không hợp lệ.',
};

const normalizeSpace = (value: string) => value.trim().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ');
const comparable = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

export function normalizeVietnameseAddress(address: string): string {
  const normalized = normalizeSpace(address);
  if (!normalized || /(?:việt\s*nam|viet\s*nam)\s*$/i.test(normalized)) return normalized;
  return `${normalized}, Việt Nam`;
}

function expandP(address: string, meaning: 'Phố' | 'Phường') {
  return address.replace(/(^|[\s,])P\.\s*(?=\p{L}|\d)/giu, `$1${meaning} `);
}

function expandHierarchy(address: string) {
  const segments = address.split(',').map((segment) => segment.trim());
  return segments.map((segment, index) => {
    if (index === 0 || /^(?:quận|huyện|thành phố|tp\.?|tỉnh|việt nam)/i.test(segment)) return segment;
    if (index === segments.length - 3 && !/^(?:phường|xã)/i.test(segment)) return `quận ${segment}`;
    return segment;
  }).join(', ');
}

/** Search-only candidates. The caller's stored address is never changed. */
export function buildVietnameseAddressCandidates(address: string): string[] {
  const original = normalizeVietnameseAddress(address);
  if (!original) return [];
  const candidates = [original];
  if (/(^|[\s,])P\./iu.test(original)) {
    const streetLikely = /(?:^|,)\s*\d+[A-Za-zÀ-ỹ\/-]*\s+P\./iu.test(original);
    const wardLikely = /,\s*P\.\s*\p{L}/iu.test(original);
    if (streetLikely) candidates.push(expandHierarchy(expandP(original, 'Phố')));
    if (wardLikely) candidates.push(expandP(original, 'Phường'));
    candidates.push(expandP(original, streetLikely ? 'Phường' : 'Phố'));
  }
  const expanded = expandHierarchy(original);
  if (expanded !== original) candidates.push(expanded);
  return Array.from(new Set(candidates)).slice(0, MAX_CANDIDATES);
}

export function buildNominatimSearchUrl(query: string): string {
  const params = new URLSearchParams({ format: 'jsonv2', q: query, countrycodes: 'vn', addressdetails: '1', limit: '5' });
  return `https://nominatim.openstreetmap.org/search?${params.toString()}`;
}

function tokens(value: string) {
  return new Set(comparable(value).split(' ').filter((token) => token.length > 1 && !['viet', 'nam', 'pho', 'phuong', 'quan'].includes(token)));
}

function similarity(query: string, displayName: string) {
  const expected = tokens(query);
  const actual = tokens(displayName);
  if (!expected.size) return 0;
  return Array.from(expected).filter((token) => actual.has(token)).length / expected.size;
}

export function scoreNominatimResult(query: string, result: NominatimResult): number {
  const displayName = typeof result.display_name === 'string' ? result.display_name : '';
  const address = result.address || {};
  const countryCode = String(address.country_code || '').toLowerCase();
  if (!displayName || (countryCode && countryCode !== 'vn')) return -100;
  let score = similarity(query, displayName) * 70;
  const houseNumber = query.match(/(?:^|,\s*)(\d+[A-Za-zÀ-ỹ\/-]*)\b/u)?.[1];
  if (houseNumber) score += comparable(String(address.house_number || '')).startsWith(comparable(houseNumber)) ? 15 : -12;
  if (countryCode === 'vn' || /việt nam|viet nam/i.test(displayName)) score += 10;
  if (['house', 'residential', 'road', 'street', 'administrative'].includes(String(result.type || ''))) score += 5;
  return score;
}

function fail(errorCode: GeocodeErrorCode): GeocodeResponse {
  return { lat: '', lng: '', success: false, errorCode, error: ERROR_MESSAGES[errorCode] };
}

function mapResult(query: string, result: NominatimResult, score: number): GeocodeMatch | null {
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return {
    lat: latitude.toFixed(6), lng: longitude.toFixed(6),
    displayName: String(result.display_name), normalizedQuery: query,
    confidence: score >= 76 ? 'high' : score >= 58 ? 'medium' : 'low',
    selectionReason: score >= 76 ? 'Khớp tốt số nhà, tên đường và khu vực tại Việt Nam.' : 'Kết quả gần đúng; cần quản trị viên xác nhận.',
  };
}

let activeRequest: Promise<GeocodeResponse> | null = null;

export function fetchCoordinatesFromAddress(address: string): Promise<GeocodeResponse> {
  if (activeRequest) return activeRequest;
  const task = geocode(address).finally(() => { activeRequest = null; });
  activeRequest = task;
  return task;
}

async function geocode(address: string): Promise<GeocodeResponse> {
  const candidates = buildVietnameseAddressCandidates(address);
  if (!candidates.length) return fail('empty_address');
  const matches: Array<{ match: GeocodeMatch; score: number }> = [];
  let sawInvalidCoordinate = false;

  try {
    for (const candidate of candidates) {
      const response = await fetch(buildNominatimSearchUrl(candidate), { headers: { 'User-Agent': 'Luminal-Factory-ERP' } });
      if (response.status === 429) return fail('rate_limited');
      if (!response.ok) return fail('network_failure');
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) return fail('malformed_response');
      for (const raw of payload) {
        if (!raw || typeof raw !== 'object') continue;
        const result = raw as NominatimResult;
        const score = scoreNominatimResult(candidate, result);
        if (score < 45) continue;
        const match = mapResult(candidate, result, score);
        if (match) matches.push({ match, score }); else sawInvalidCoordinate = true;
      }
      matches.sort((a, b) => b.score - a.score);
      if (matches[0]?.score >= 82 && (!matches[1] || matches[0].score - matches[1].score >= 12)) break;
    }
  } catch {
    return fail('network_failure');
  }

  if (!matches.length) return fail(sawInvalidCoordinate ? 'invalid_coordinates' : 'no_match');
  const unique = matches.filter((entry, index, list) => list.findIndex((other) => other.match.lat === entry.match.lat && other.match.lng === entry.match.lng) === index);
  const best = unique[0];
  const alternatives = unique.slice(0, 3).map(({ match }) => match);
  const ambiguous = best.match.confidence !== 'high' || (unique[1] && best.score - unique[1].score < 8);
  return { ...best.match, success: true, alternatives: ambiguous ? alternatives : undefined, errorCode: ambiguous ? 'ambiguous' : undefined, error: ambiguous ? ERROR_MESSAGES.ambiguous : undefined };
}
