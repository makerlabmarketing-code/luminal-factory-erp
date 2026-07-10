import { businessMonthFromInstant, formatBusinessMonthPeriod } from '@/lib/business-date';

export function formatCurrency(value: string): string {
  if (!value) return '';

  const onlyNumbers = value.replace(/[^0-9]/g, '');
  return onlyNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function parseCurrency(value: string): number {
  if (!value) return 0;
  return Number(value.replace(/,/g, ''));
}

export function getCurrentMonthPeriod(): string {
  return formatBusinessMonthPeriod(businessMonthFromInstant(new Date()));
}
