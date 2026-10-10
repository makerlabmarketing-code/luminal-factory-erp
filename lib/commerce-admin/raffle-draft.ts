import { isRaffleUuid, type CommerceRaffle } from './raffle-input';

export interface RaffleInformation {
  title: string; summary: string | null; rulesSummary: string | null;
  opensAt: string; closesAt: string;
}
export interface RaffleInformationMutation { operationId: string; information: RaffleInformation }
function record(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
export function parseRaffleInformationMutation(value: unknown): RaffleInformationMutation | null {
  if (!record(value) || Object.keys(value).some(key => !['operationId','information'].includes(key)) ||
      typeof value.operationId !== 'string' || !isRaffleUuid(value.operationId) || !record(value.information)) return null;
  const input = value.information;
  if (Object.keys(input).some(key => !['title','summary','rulesSummary','opensAt','closesAt'].includes(key)) ||
      typeof input.title !== 'string' || !input.title.trim() || input.title.trim().length > 180) return null;
  if (![input.summary,input.rulesSummary].every(text => text === null || typeof text === 'string')) return null;
  if (typeof input.summary === 'string' && input.summary.length > 5000 || typeof input.rulesSummary === 'string' && input.rulesSummary.length > 8000) return null;
  const iso = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  if (typeof input.opensAt !== 'string' || typeof input.closesAt !== 'string' ||
      !iso.test(input.opensAt) || !iso.test(input.closesAt) || !Number.isFinite(Date.parse(input.opensAt)) ||
      !Number.isFinite(Date.parse(input.closesAt)) || Date.parse(input.closesAt) <= Date.parse(input.opensAt)) return null;
  for (const value of [input.opensAt,input.closesAt]) {
    const calendar = new Date(`${value.slice(0,10)}T00:00:00Z`);
    if (!Number.isFinite(calendar.getTime()) || calendar.toISOString().slice(0,10) !== value.slice(0,10)) return null;
  }
  return { operationId: value.operationId, information: {
    title: input.title.trim(), summary: typeof input.summary === 'string' ? input.summary.trim() || null : null,
    rulesSummary: typeof input.rulesSummary === 'string' ? input.rulesSummary.trim() || null : null,
    opensAt: input.opensAt, closesAt: input.closesAt,
  }};
}
export function canEditRaffleInformation(raffle: CommerceRaffle) {
  return raffle.status === 'DRAFT' && !raffle.is_published && !raffle.is_test;
}
// Use explicit UTC+7, never the browser/server's own timezone.
export function raffleDateToVietnamInput(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  return new Date(Date.parse(value) + 7 * 60 * 60 * 1000).toISOString().slice(0,19);
}
export function raffleVietnamInputToDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return null;
  const normalized = value.length === 16 ? `${value}:00` : value;
  const parsed = new Date(`${normalized}+07:00`);
  return Number.isFinite(parsed.getTime()) && raffleDateToVietnamInput(parsed.toISOString()) === normalized ? parsed.toISOString() : null;
}
