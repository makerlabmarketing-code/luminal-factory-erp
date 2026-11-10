export const COMPETENCY_RUBRIC = [
  { key: 'quality', title: 'Chất lượng', descriptions: ['Lỗi lặp lại, phải sửa nhiều', 'Đạt sau khi được nhắc hoặc sửa', 'Đạt ngay, ổn định theo mẫu chuẩn'] },
  { key: 'productivity', title: 'Năng suất', descriptions: ['Chậm hơn mốc đã thống nhất', 'Đạt mốc nhưng cần hỗ trợ', 'Tự đạt mốc, vẫn giữ chất lượng'] },
  { key: 'autonomy', title: 'Tự chủ', descriptions: ['Cần kèm từng bước', 'Tự làm việc quen, cần nhắc', 'Tự chuẩn bị, kiểm tra và bàn giao'] },
  { key: 'collaboration', title: 'Phối hợp', descriptions: ['Lỡ lịch hoặc bàn giao thiếu, không báo', 'Có lúc cần nhắc báo và bàn giao', 'Giữ lịch, chủ động báo và bàn giao đủ'] },
] as const;

export const COMPETENCY_WORK_GROUPS = [
  'In 3D và xử lý mẫu', 'Khuôn, casting và hậu kỳ', 'Đóng gói', 'Tìm mẫu 3D', 'Chỉnh file và gắn support',
] as const;

export interface CompetencyScores {
  scores: Array<0 | 1 | 2 | null>;
  evidence: string[];
  workGroups: string[];
  strengths: string;
  improvements: string;
  goals: string;
}

export const emptyCompetencyScores = (): CompetencyScores => ({
  scores: [null, null, null, null], evidence: ['', '', '', ''], workGroups: [],
  strengths: '', improvements: '', goals: '',
});

export function competencyResult(scores: CompetencyScores['scores']): string {
  const assessed = scores.filter((score): score is 0 | 1 | 2 => score !== null);
  if (assessed.length !== COMPETENCY_RUBRIC.length) return `Chưa đủ dữ liệu · ${assessed.length}/4 tiêu chí`;
  return `${assessed.join(' + ')} = ${assessed.reduce<number>((sum, score) => sum + score, 0)}/8`;
}

export function isReviewMonth(value: unknown): value is string {
  return typeof value === 'string' && /^20\d\d-(0[1-9]|1[0-2])$/.test(value);
}

export function parseCompetencyScores(value: unknown): CompetencyScores | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const { scores, evidence, workGroups, strengths, improvements, goals } = value as Record<string, unknown>;
  const isText = (item: unknown): item is string => typeof item === 'string' && item.length <= 2000;
  if (!Array.isArray(scores) || scores.length !== 4 || !scores.every(score => score === null || score === 0 || score === 1 || score === 2)) return null;
  if (!Array.isArray(evidence) || evidence.length !== 4 || !evidence.every(isText)) return null;
  if (!Array.isArray(workGroups) || !workGroups.every(group => COMPETENCY_WORK_GROUPS.includes(group)) || new Set(workGroups).size !== workGroups.length) return null;
  if (!isText(strengths) || !isText(improvements) || !isText(goals)) return null;
  return { scores, evidence: evidence.map(item => item.trim()), workGroups, strengths: strengths.trim(), improvements: improvements.trim(), goals: goals.trim() };
}

export interface PublishedCompetencyReview {
  id: string;
  revision: number;
  month: string;
  published_at: string;
  publisher_name: string;
  viewed_at: string | null;
  rubric: Array<{ key: string; title: string; descriptions: readonly string[] }>;
  manager: CompetencyScores;
  self_review: CompetencyScores | null;
  correction: string;
}
