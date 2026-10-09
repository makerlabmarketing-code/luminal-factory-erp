const referenceLabels = {
  'Dự án': 'project',
  'Người thực hiện': 'employee',
  'Người hưởng lợi': 'employee',
  'Người chi trả': 'employee',
} as const;

type ReferenceKind = 'project' | 'employee';
interface ReferenceChange {
  label: keyof typeof referenceLabels;
  kind: ReferenceKind;
  before: string;
  after: string;
}

// Only interpret the trigger's reference lines, never free-text reasons or notes.
function parseReferenceChange(line: string): ReferenceChange | null {
  const match = /^(Dự án|Người thực hiện|Người hưởng lợi|Người chi trả): (null|[1-9]\d{0,18}) → (null|[1-9]\d{0,18})$/.exec(line);
  if (!match) return null;
  const label = match[1] as keyof typeof referenceLabels;
  return { label, kind: referenceLabels[label], before: match[2], after: match[3] };
}

export function collectActivityReferenceIds(texts: string[]) {
  const project = new Set<string>(), employee = new Set<string>();
  for (const text of texts) {
    // The correction reason can contain newlines resembling audit fields.
    const changes = text.split('\nLý do:')[0];
    for (const line of changes.split('\n')) {
      const change = parseReferenceChange(line);
      if (!change) continue;
      for (const id of [change.before, change.after]) {
        if (id !== 'null') (change.kind === 'project' ? project : employee).add(id);
      }
    }
  }
  return { project: Array.from(project), employee: Array.from(employee) };
}

export function formatActivityReferenceChanges(
  text: string,
  names: { project: ReadonlyMap<string, string>; employee: ReadonlyMap<string, string> },
): string {
  const reasonStart = text.indexOf('\nLý do:');
  const changes = reasonStart < 0 ? text : text.slice(0, reasonStart);
  const reason = reasonStart < 0 ? '' : text.slice(reasonStart);
  return changes.split('\n').map(line => {
    const change = parseReferenceChange(line);
    if (!change) return line;
    const display = (id: string) => {
      if (id === 'null') return 'Chưa chọn';
      const name = names[change.kind].get(id)?.trim();
      return name ? `${name} (#${id})` : `${change.kind === 'project' ? 'Dự án' : 'Nhân sự'} #${id} (không còn trong danh sách)`;
    };
    return `${change.label}: ${display(change.before)} → ${display(change.after)}`;
  }).join('\n') + reason;
}
