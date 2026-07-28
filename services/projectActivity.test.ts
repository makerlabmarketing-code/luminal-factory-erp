import { describe, expect, it } from 'vitest';
import { parseProjectCommentPayload, parseTimelineLimit, sanitizeCommentText } from './projectActivity';

describe('project activity contract', () => {
  it('sanitizes control characters and surrounding whitespace', () => {
    expect(sanitizeCommentText('  Tiến độ\u0000 ổn  ')).toBe('Tiến độ ổn');
  });

  it('rejects client actor and permission fields', () => {
    expect(() => parseProjectCommentPayload({ body: 'Nội dung', actorEmployeeId: 9 })).toThrow('không được phép');
    expect(() => parseProjectCommentPayload({ body: 'Nội dung', permission: 'ADMIN' })).toThrow('không được phép');
  });

  it('bounds timeline loading', () => {
    expect(parseTimelineLimit(null)).toBe(30);
    expect(parseTimelineLimit('50')).toBe(50);
    expect(parseTimelineLimit('500')).toBe(30);
  });
});
