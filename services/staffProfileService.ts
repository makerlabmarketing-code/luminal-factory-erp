export function getShiftWageByTitle(title?: string | null): number {
  const formattedTitle = (title || '').trim().toUpperCase();

  if (formattedTitle === 'A1') return 150000;

  return 100000;
}

export interface StaffProfileUpdate {
  phone?: string;
  bankName?: string;
  bankAccountNumber?: string;
}

export async function updateStaffProfile(params: StaffProfileUpdate): Promise<{ phone: string | null; bank_name: string | null; bank_account_number: string | null }> {
  const response = await fetch('/api/staff/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    cache: 'no-store',
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as { error?: string; correlationId?: string } | null;

    const reference = result?.correlationId ? ` Mã tra cứu: ${result.correlationId}.` : '';
    throw new Error(`${result?.error || 'Không thể lưu hồ sơ.'}${reference}`);
  }
  const result = await response.json() as { employee: { phone: string | null; bank_name: string | null; bank_account_number: string | null } };
  return result.employee;
}
