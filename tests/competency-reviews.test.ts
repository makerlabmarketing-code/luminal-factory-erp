import { describe, expect, it } from 'vitest';
import { competencyResult, emptyCompetencyScores, parseCompetencyScores } from '../lib/competency-reviews';

describe('competency reviews', () => {
  it('preserves zero scores and leaves incomplete reviews unranked', () => {
    expect(competencyResult([0, 0, 0, 0])).toBe('0 + 0 + 0 + 0 = 0/8');
    expect(competencyResult([2, 2, 2, 2])).toBe('2 + 2 + 2 + 2 = 8/8');
    expect(competencyResult([2, 1, 2, 2])).toBe('2 + 1 + 2 + 2 = 7/8');
    expect(competencyResult([0, 0, null, null])).toBe('Chưa đủ dữ liệu · 2/4 tiêu chí');
  });

  it('validates the four scores without coercing client input', () => {
    expect(parseCompetencyScores({ ...emptyCompetencyScores(), scores: [0, 1, null, 2] })?.scores).toEqual([0, 1, null, 2]);
    expect(parseCompetencyScores({ ...emptyCompetencyScores(), scores: [0, 1, 2, 3] })).toBeNull();
    expect(parseCompetencyScores({ ...emptyCompetencyScores(), scores: ['0', 1, 2, null] })).toBeNull();
    expect(parseCompetencyScores({ ...emptyCompetencyScores(), scores: [0, 1] })).toBeNull();
  });
});
