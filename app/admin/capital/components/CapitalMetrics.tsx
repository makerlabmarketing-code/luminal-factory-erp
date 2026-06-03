import { Wallet, ArrowUpRight, TrendingUp, History, Banknote } from 'lucide-react';

interface CapitalMetricsProps {
  totalGop: number;
  totalDoanhThu: number;
  totalChiPhi: number;
  totalTreo: number;
  totalRemainingBalance: number;
}

export default function CapitalMetrics({
  totalGop,
  totalDoanhThu,
  totalChiPhi,
  totalTreo,
  totalRemainingBalance
}: CapitalMetricsProps) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-bold uppercase tracking-wider select-none">
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
        <p className="text-slate-500 text-[9px] flex items-center gap-1"><Wallet className="w-3 h-3 text-emerald-500"/> Vốn Đầu Tư</p>
        <p className="text-xs font-black text-emerald-400 mt-1 font-mono">+{totalGop.toLocaleString()}</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
        <p className="text-slate-500 text-[9px] flex items-center gap-1"><ArrowUpRight className="w-3 h-3 text-blue-400"/> Doanh Thu</p>
        <p className="text-xs font-black text-blue-400 mt-1 font-mono">+{totalDoanhThu.toLocaleString()}</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
        <p className="text-slate-500 text-[9px] flex items-center gap-1"><TrendingUp className="w-3 h-3 text-red-400"/> Tổng Chi Phí</p>
        <p className="text-xs font-black text-red-400 mt-1 font-mono">-{totalChiPhi.toLocaleString()}</p>
      </div>
      <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex flex-col justify-center">
        <p className="text-slate-500 text-[9px] flex items-center gap-1"><History className="w-3 h-3 text-amber-400"/> Khoản Treo Nợ</p>
        <p className="text-xs font-black text-amber-400 mt-1 font-mono">{totalTreo.toLocaleString()}</p>
      </div>
      <div className="bg-slate-900 border-2 border-emerald-500/30 p-3 rounded-2xl flex flex-col justify-center shadow-lg col-span-2 lg:col-span-1">
        <p className="text-emerald-400 text-[9px] flex items-center gap-1"><Banknote className="w-3 h-3"/> Tiền mặt trong két</p>
        <p className="text-xs font-black text-emerald-400 mt-1 font-mono">{totalRemainingBalance.toLocaleString()} đ</p>
      </div>
    </div>
  );
}