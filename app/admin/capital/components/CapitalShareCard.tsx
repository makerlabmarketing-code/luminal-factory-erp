// app/admin/capital/components/CapitalShareCard.tsx
'use client';
import { ShieldCheck, User } from 'lucide-react';
import type { FinancialLedgerEntry } from '@/lib/types/finance';

interface CapitalShareCardProps {
  ledgerData: FinancialLedgerEntry[];
}

export default function CapitalShareCard({ ledgerData }: CapitalShareCardProps) {
  const memberStats = new Map<string, { name: string; totalCash: number; totalAsset: number; pending: number }>();
  for (const item of ledgerData) {
    if (item.type !== 'VON_GOP' || item.source_type === 'PERSONAL_ADVANCE' || item.cancelled_at) continue;
    if (!item.is_paid && item.source_type !== 'MONTHLY_CAPITAL') continue;

    const name = item.payer_name || item.requested_by || 'Chưa xác định';
    const stats = memberStats.get(name) ?? { name, totalCash: 0, totalAsset: 0, pending: 0 };
    const amount = Number(item.amount) || 0;
    if (!item.is_paid) stats.pending += amount;
    else if (item.sub_type === 'HIEN_VAT') stats.totalAsset += amount;
    else stats.totalCash += amount;
    memberStats.set(name, stats);
  }
  const members = Array.from(memberStats.values());

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" /> Đóng góp theo kỳ
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Kỳ đang xem</span>
      </div>

      {members.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-2">Chưa ghi nhận dữ liệu đóng góp vốn trong kỳ này.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map(({ name, totalCash, totalAsset, pending }) => {
            return (
              <div key={name} className="bg-slate-950 border border-slate-800/60 rounded-xl p-3.5 space-y-2.5">
                <div className="flex items-center gap-2 text-slate-200 font-bold text-xs">
                  <div className="bg-slate-900 p-1 rounded-lg border border-slate-800">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                  <span>{name}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono leading-relaxed">
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/40">
                    <span className="text-slate-500 block text-[9px] uppercase font-sans font-bold">Đã góp vào quỹ</span>
                    <span className="text-emerald-400 font-bold">+{totalCash.toLocaleString()} đ</span>
                  </div>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/40">
                    <span className="text-slate-500 block text-[9px] uppercase font-sans font-bold">Đối ứng cũ trong kỳ</span>
                    <span className="text-amber-400 font-bold">+{totalAsset.toLocaleString()} đ</span>
                  </div>
                </div>
                {pending > 0 && (
                  <p className="text-xs text-amber-300">Chờ thu {pending.toLocaleString('vi-VN')} đ</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}