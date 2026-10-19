export interface PhaseMember { employeeId: number; fullName: string }
export interface PhaseMembersResponse { enabled: boolean; members: PhaseMember[] }

export function phaseMemberIds(value: unknown): number[] {
  if (!Array.isArray(value) || value.length > 100 || value.some(id => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('Danh sách người thực hiện không hợp lệ.');
  }
  return Array.from(new Set<number>(value)).sort((a, b) => a - b);
}
export function samePhaseMemberIds(left: number[], right: number[]): boolean {
  return JSON.stringify(phaseMemberIds(left)) === JSON.stringify(phaseMemberIds(right));
}
