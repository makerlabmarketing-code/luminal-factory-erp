import { businessDateFromInstant } from './business-date';

export function projectCodePrefix(value: Date | string): string {
  const date = businessDateFromInstant(value);
  const day = String(date.day).padStart(2, '0');
  const month = String(date.month).padStart(2, '0');
  const year = String(date.year % 100).padStart(2, '0');
  return `LF-${day}${month}${year}`;
}

export function nextProjectCode(prefix: string, existingCodes: readonly string[]): string {
  const escapedPrefix = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-(\\d{2,})$`, 'i');
  const highestSequence = existingCodes.reduce((highest, code) => {
    const match = code.trim().match(pattern);
    return match ? Math.max(highest, Number(match[1])) : highest;
  }, 0);

  return `${prefix}-${String(highestSequence + 1).padStart(2, '0')}`;
}
