export type ActivityEntity = 'employee' | 'ledger';
export interface ActivityEvent {
  id: string;
  occurredAt: string;
  actorName: string;
  action: string;
  entity: ActivityEntity;
  entityId: string;
  screen: string;
  summary: string;
  changesText: string;
  href: string;
}
export function activityHref(entity: ActivityEntity, id: string): string {
  return entity === 'employee' ? `/admin/employees/${encodeURIComponent(id)}` : `/admin/capital?ledgerId=${encodeURIComponent(id)}`;
}
export function validateCorrectionReason(value: unknown): string {
  if (typeof value !== 'string' || value.trim().length < 5 || value.trim().length > 500) throw new Error('Lý do điều chỉnh cần từ 5 đến 500 ký tự.');
  return value.trim();
}
