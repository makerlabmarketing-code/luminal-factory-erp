import { BUSINESS_TIME_ZONE } from './business-date';

export function projectCodePrefix(value: Date | string): string {
  const instant = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error('Invalid project code instant.');
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: BUSINESS_TIME_ZONE,
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant).reduce<Record<string, string>>((result, part) => {
    result[part.type] = part.value;
    return result;
  }, {});
  return `LF-${parts.day}${parts.month}${parts.year}-${parts.hour}${parts.minute}${parts.second}`;
}

export const projectCodePreview = projectCodePrefix;

export function nextProjectCode(prefix: string, existingCodes: readonly string[]): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}(?:-(\\d{2,}))?$`, 'i');
  const highestSequence = existingCodes.reduce((highest, code) => {
    const match = code.trim().match(pattern);
    return match ? Math.max(highest, match[1] ? Number(match[1]) : 1) : highest;
  }, 0);

  return highestSequence === 0 ? prefix : `${prefix}-${String(highestSequence + 1).padStart(2, '0')}`;
}
