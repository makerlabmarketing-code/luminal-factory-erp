// app/admin/capital/components/CapitalShareCard.tsx
'use client';
import { ShieldCheck, User, ArrowDownRight } from 'lucide-react';

interface CapitalShareCardProps {
  ledgerData: any[];
}

export default function CapitalShareCard({ ledgerData }: CapitalShareCardProps) {
  // Lọc và nhóm dữ liệu vốn góp thực tế của từng nhân sự trong kỳ hạch toán
  const memberStats = ledgerData.reduce((acc: any, item: any) => {
    if (item.type !== 'VON_GOP' || !item.is_paid) return acc;
    
    const name = item.requested_by || 'Không xác định';
    if (!acc[name]) {
      acc[name] = { totalCash: 0, totalAsset: 0 };
    }
    
    if (item.sub_type === 'HIEN_VAT') {
      acc[name].totalAsset += Number(item.amount);
    } else {
      acc[name].totalCash += Number(item.amount);
    }
    
    return acc;
  }, {});

  const members = Object.keys(memberStats);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-blue-500" /> Trạng thái phân bổ vốn & Công nợ đối ứng
        </h3>
        <span className="text-[10px] text-slate-500 font-mono">Dữ liệu phân tích thời gian thực</span>
      </div>

      {members.length === 0 ? (
        <p className="text-xs text-slate-500 italic text-center py-2">Chưa ghi nhận dữ liệu đóng góp vốn trong kỳ này.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((name) => {
            const { totalCash, totalAsset } = memberStats[name];
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
                    <span className="text-slate-500 block text-[9px] uppercase font-sans font-bold">Vốn tiền mặt:</span>
                    <span className="text-emerald-400 font-bold">+{totalCash.toLocaleString()} đ</span>
                  </div>
                  <div className="bg-slate-900/40 p-2 rounded-lg border border-slate-800/40">
                    <span className="text-slate-500 block text-[9px] uppercase font-sans font-bold">Vốn ứng trước (Nợ):</span>
                    <span className="text-amber-400 font-bold">+{totalAsset.toLocaleString()} đ</span>
                  </div>
                </div>

                {totalAsset > 0 && (
                  <div className="bg-amber-500/5 border border-amber-500/10 text-[10px] text-amber-400/80 p-2 rounded-lg flex items-center gap-1">
                    <ArrowDownRight className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>Xưởng ghi nhận công nợ cần hoàn trả lại dần từ lợi nhuận ròng.</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}