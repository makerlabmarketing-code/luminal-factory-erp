import type { PersonalAdvance } from '@/lib/types/finance';

const money = (amount: number) => `${amount.toLocaleString('vi-VN')} đ`;

export default function PersonalAdvancesCard({
  advances, canPay, onRefund,
}: {
  advances: PersonalAdvance[];
  canPay: boolean;
  onRefund: (advance: PersonalAdvance) => void;
}) {
  const byPerson = new Map<string, PersonalAdvance[]>();
  for (const advance of advances) {
    const key = String(advance.shareholder_id);
    const rows = byPerson.get(key) || [];
    rows.push(advance);
    byPerson.set(key, rows);
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="text-sm font-semibold">Tiền cá nhân chờ hoàn</h2>
      <p className="text-xs text-slate-400">Tổng qua các kỳ, theo các phiếu đã ghi nhận nguồn cá nhân.</p>
      {byPerson.size === 0 && <p className="text-xs text-slate-400">Chưa có khoản ứng đã ghi nhận.</p>}
      {Array.from(byPerson).map(([id, rows]) => {
        const advanced = rows.reduce((total, row) => total + Number(row.advanced), 0);
        const refunded = rows.reduce((total, row) => total + Number(row.refunded), 0);
        return (
          <details key={id} className="rounded-lg border border-slate-700 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              {rows[0].person} · Còn phải hoàn {money(advanced - refunded)}
            </summary>
            <p className="my-2 text-xs text-slate-400">Đã ứng {money(advanced)} · Đã hoàn {money(refunded)}</p>
            <ul className="divide-y divide-slate-700">
              {rows.map(row => {
                const remaining = Number(row.advanced) - Number(row.refunded);
                return (
                  <li key={row.ledger_id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                    <span>{row.category} · {row.month_period} · Còn {money(remaining)}</span>
                    {canPay && remaining > 0 && (
                      <button type="button" className="admin-button-secondary" onClick={() => onRefund(row)}>Hoàn tiền</button>
                    )}
                  </li>
                );
              })}
            </ul>
          </details>
        );
      })}
    </section>
  );
}
