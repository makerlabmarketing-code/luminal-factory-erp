import { COMPETENCY_RUBRIC, competencyResult, type CompetencyScores, type PublishedCompetencyReview } from '@/lib/competency-reviews';

export function ReviewRubric({ rubric = COMPETENCY_RUBRIC }: { rubric?: PublishedCompetencyReview['rubric'] | typeof COMPETENCY_RUBRIC }) {
  return (
    <details className="rounded-lg border border-slate-700 p-3">
      <summary className="cursor-pointer font-semibold">Cách tính điểm</summary>
      <p className="my-2 text-sm text-slate-300">Cộng bốn tiêu chí, tối đa 8 điểm. Tiêu chí chưa đánh giá không được tính là 0.</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rubric.map(item => (
          <div key={item.key} className="rounded border border-slate-700 p-2 text-sm">
            <strong>{item.title}</strong>
            {item.descriptions.map((description, score) => <p key={description}>{score} điểm · {description}</p>)}
          </div>
        ))}
      </div>
    </details>
  );
}

export function ReviewDetails({ content, rubric = COMPETENCY_RUBRIC }: {
  content: CompetencyScores;
  rubric?: PublishedCompetencyReview['rubric'] | typeof COMPETENCY_RUBRIC;
}) {
  return (
    <div className="space-y-2 text-sm">
      <strong>{competencyResult(content.scores)}</strong>
      {content.workGroups.length > 0 && <p>{content.workGroups.join(' · ')}</p>}
      {rubric.map((item, index) => (
        <p key={item.key} className="whitespace-pre-wrap break-words">
          <strong>{item.title}</strong> · {content.scores[index] ?? 'Chưa đánh giá'}
          {content.evidence[index] && <span className="block text-slate-400">{content.evidence[index]}</span>}
        </p>
      ))}
      {([['Điểm mạnh', content.strengths], ['Cần cải thiện', content.improvements], ['Mục tiêu', content.goals]]).map(([label, value]) => value && (
        <p key={label} className="whitespace-pre-wrap break-words"><strong>{label}</strong><span className="block">{value}</span></p>
      ))}
    </div>
  );
}
