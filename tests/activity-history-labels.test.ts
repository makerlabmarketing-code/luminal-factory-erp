import { describe, expect, it } from 'vitest';
import { collectActivityReferenceIds, formatActivityReferenceChanges } from '../lib/activity-history-labels';

const names = { project: new Map([['9', 'Colorway Mono'], ['12', 'Colorway Mono']]), employee: new Map([['3', 'Đào Tùng Duy']]) };

describe('Activity reference display', () => {
  it('shows both selected names and stable IDs, including duplicate names', () => {
    expect(formatActivityReferenceChanges('Dự án: null → 9\nDự án: 9 → 12\nNgười thực hiện: 3 → null\n', names))
      .toBe('Dự án: Chưa chọn → Colorway Mono (#9)\nDự án: Colorway Mono (#9) → Colorway Mono (#12)\nNgười thực hiện: Đào Tùng Duy (#3) → Chưa chọn\n');
  });
  it('keeps deleted references identifiable rather than inventing names', () => {
    expect(formatActivityReferenceChanges('Người hưởng lợi: 99 → 3\nNgười chi trả: null → 99', names))
      .toBe('Người hưởng lợi: Nhân sự #99 (không còn trong danh sách) → Đào Tùng Duy (#3)\nNgười chi trả: Chưa chọn → Nhân sự #99 (không còn trong danh sách)');
  });
  it('preserves private-field redaction, unrelated values and free-text reasons verbatim', () => {
    const text = 'Họ tên: đã thay đổi\nSố tiền: 100 → 200\nLý do: test thử\nDự án: null → 9';
    expect(formatActivityReferenceChanges(text, names)).toBe(text);
    expect(collectActivityReferenceIds([text])).toEqual({ project: [], employee: [] });
  });
  it('only collects bounded numeric reference IDs, deduplicated across changes', () => {
    expect(collectActivityReferenceIds(['Dự án: null → 9\nDự án: 9 → 12\nNgười thực hiện: 3 → 99\nNgười hưởng lợi: null → 3\nDự án: "9" → 12\nDự án: null → 1e10']))
      .toEqual({ project: ['9', '12'], employee: ['3', '99'] });
  });
});
