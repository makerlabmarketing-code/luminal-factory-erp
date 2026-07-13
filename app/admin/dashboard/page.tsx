'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { AlertTriangle, RefreshCcw, Wallet, Banknote, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type {
  MonthlyChartData,
  PieChartData,
} from '@/lib/types/dashboard';
// Bảng màu cho biểu đồ (Khớp với hệ màu Tailwind của dự án)
const COLORS = {
  thu: '#34d399',      // emerald-400
  chi: '#f87171',      // red-400
  von_gop: '#10b981',  // emerald-500
  doanh_thu: '#eab308',// yellow-500
  chi_phi: '#ef4444',  // red-500
  hoan_ung: '#22d3ee', // cyan-400
};

export default function DashboardCharts() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  
  const [monthlyData, setMonthlyData] = useState<MonthlyChartData[]>([]);
  const [pieData, setPieData] = useState<PieChartData[]>([]);
  
  // State lưu trữ dữ liệu tổng kết theo năm (YTD)
  const [ytdStats, setYtdStats] = useState({
    year: new Date().getFullYear().toString(),
    capital: 0,
    revenue: 0,
    expense: 0,
    balance: 0
  });

  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoading(true);
      setLoadError('');
      try {
        // Lấy toàn bộ dữ liệu hạch toán đã được xác nhận (is_paid = true)
        const { data: ledger, error } = await supabase
          .from('financial_ledger')
          .select('id, type, category, amount, is_paid, month_period')
          .eq('is_paid', true);

        if (error) {
          setLoadError('Không tải được dữ liệu dashboard. Vui lòng kiểm tra quyền đọc dữ liệu.');
          return;
        }

        if (!ledger) {
          setLoadError('Không tải được dữ liệu dashboard. Vui lòng thử lại.');
          return;
        }

        const currentYear = new Date().getFullYear().toString();
        const groupedByMonth: Record<string, { name: string; thu: number; chi: number }> = {};
        
        let totalVon = 0, totalDoanhThu = 0, totalChiPhi = 0, totalHoanUng = 0;
        
        // Biến tạm tính tổng theo năm
        let ytdCap = 0, ytdRev = 0, ytdExp = 0;

        ledger.forEach((item) => {
          const amount = Number(item.amount) || 0;
          const month = item.month_period || 'Khác';

          // --- 1. XỬ LÝ DỮ LIỆU TỔNG KẾT NĂM (YTD) ---
          if (month.includes(currentYear)) {
            if (item.type === 'VON_GOP') ytdCap += amount;
            else if (item.type === 'DOANH_THU') ytdRev += amount;
            else if (['CHI_PHI', 'CHI_TIEU', 'HOAN_UNG'].includes(item.type)) ytdExp += amount;
          }

          // --- 2. XỬ LÝ DỮ LIỆU CHO BIỂU ĐỒ CỘT ---
          if (!groupedByMonth[month]) {
            groupedByMonth[month] = { name: month, thu: 0, chi: 0 };
          }

          if (item.type === 'VON_GOP' || item.type === 'DOANH_THU') {
            groupedByMonth[month].thu += amount;
          } else if (['CHI_PHI', 'CHI_TIEU', 'HOAN_UNG'].includes(item.type)) {
            groupedByMonth[month].chi += amount;
          }

          // --- 3. XỬ LÝ DỮ LIỆU CHO BIỂU ĐỒ TRÒN ---
          if (item.type === 'VON_GOP') totalVon += amount;
          if (item.type === 'DOANH_THU') totalDoanhThu += amount;
          if (item.type === 'CHI_PHI' || item.type === 'CHI_TIEU') totalChiPhi += amount;
          if (item.type === 'HOAN_UNG') totalHoanUng += amount;
        });

        // Cập nhật State Box Tổng Kết
        setYtdStats({
          year: currentYear,
          capital: ytdCap,
          revenue: ytdRev,
          expense: ytdExp,
          balance: (ytdCap + ytdRev) - ytdExp
        });

        // Chuyển object thành array và sort theo tháng cho biểu đồ
        const chartData = Object.values(groupedByMonth).sort((a, b) => {
          const [monthA, yearA] = a.name.split('/');
          const [monthB, yearB] = b.name.split('/');
          return new Date(Number(yearA), Number(monthA) - 1).getTime() - new Date(Number(yearB), Number(monthB) - 1).getTime();
        });

        setMonthlyData(chartData);

        setPieData([
          { name: 'Vốn Góp', value: totalVon, color: COLORS.von_gop },
          { name: 'Doanh Thu', value: totalDoanhThu, color: COLORS.doanh_thu },
          { name: 'Chi Phí', value: totalChiPhi, color: COLORS.chi_phi },
          { name: 'Hoàn Ứng', value: totalHoanUng, color: COLORS.hoan_ung },
        ].filter(d => d.value > 0)); 

      } catch {
        setLoadError('Không tải được dữ liệu dashboard. Vui lòng thử lại.');
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-xl text-xs font-mono">
          <p className="text-slate-400 font-bold mb-2 pb-2 border-b border-slate-800 text-center">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex justify-between gap-4 py-1">
              <span style={{ color: entry.color }} className="font-bold uppercase">{entry.name === 'thu' ? 'Tổng Thu' : entry.name === 'chi' ? 'Tổng Chi' : entry.name}:</span>
              <span className="text-slate-200">{Number(entry.value).toLocaleString()} đ</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return <div className="flex justify-center p-10"><RefreshCcw className="w-5 h-5 text-emerald-500 animate-spin" /></div>;
  }

  if (loadError) {
    return (
      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
          <div>
            <p className="font-bold">Không tải được dữ liệu</p>
            <p className="mt-1 text-xs text-red-200/80">{loadError}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 mt-4">
      
      {/* KHỐI BOX TỔNG QUAN THEO NĂM (YTD METRICS) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 select-none">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center shadow-lg transition hover:border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-500" /> Vốn nạp ({ytdStats.year})
          </p>
          <p className="text-lg font-black text-emerald-400 mt-1 font-mono tracking-wide">
            +{ytdStats.capital.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center shadow-lg transition hover:border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-yellow-500" /> Doanh thu ({ytdStats.year})
          </p>
          <p className="text-lg font-black text-yellow-400 mt-1 font-mono tracking-wide">
            +{ytdStats.revenue.toLocaleString()}
          </p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-center shadow-lg transition hover:border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-500" /> Tổng chi ({ytdStats.year})
          </p>
          <p className="text-lg font-black text-red-400 mt-1 font-mono tracking-wide">
            -{ytdStats.expense.toLocaleString()}
          </p>
        </div>

        <div className="bg-[#0b0f19] border-2 border-emerald-500/20 rounded-2xl p-4 flex flex-col justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)] transition hover:border-emerald-500/40 relative overflow-hidden">
          <div className="absolute -right-4 -top-4 opacity-5 pointer-events-none">
            <Banknote className="w-24 h-24 text-emerald-500" />
          </div>
          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider flex items-center gap-1.5 relative z-10">
            <Banknote className="w-3.5 h-3.5" /> Số dư quỹ hiện tại
          </p>
          <p className="text-lg font-black text-emerald-400 mt-1 font-mono tracking-wide relative z-10">
            {ytdStats.balance.toLocaleString()} đ
          </p>
        </div>
      </div>

      {/* KHỐI BIỂU ĐỒ CHARTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* 1. BIỂU ĐỒ CỘT */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Biến động dòng tiền qua các kỳ</h3>
            <p className="text-[10px] text-slate-500 mt-1">So sánh tổng Thu và tổng Chi thực tế theo từng tháng</p>
          </div>
          
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(value) => `${value / 1000000}M`} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#0f172a', opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="thu" name="Tổng Thu" fill={COLORS.thu} radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="chi" name="Tổng Chi" fill={COLORS.chi} radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 2. BIỂU ĐỒ TRÒN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl flex flex-col">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cơ cấu dòng tiền</h3>
            <p className="text-[10px] text-slate-500 mt-1">Phân bổ tỷ trọng các loại nghiệp vụ lũy kế</p>
          </div>
          
          <div className="h-60 w-full flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  stroke="none"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800">
            {pieData.map((item, index) => (
              <div key={index} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }}></span>
                <div>
                  <p className="text-[9px] text-slate-400 uppercase font-bold">{item.name}</p>
                  <p className="text-[10px] font-mono text-slate-200">{Number(item.value).toLocaleString()} đ</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
