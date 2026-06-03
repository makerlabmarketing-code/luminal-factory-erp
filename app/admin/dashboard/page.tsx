'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { RefreshCcw } from 'lucide-react';

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
  const [monthlyData, setMonthlyData] = useState<any[]>([]);
  const [pieData, setPieData] = useState<any[]>([]);

  useEffect(() => {
    const fetchAndProcessData = async () => {
      setLoading(true);
      try {
        // Lấy toàn bộ dữ liệu hạch toán đã được xác nhận (is_paid = true)
        const { data: ledger } = await supabase
          .from('financial_ledger')
          .select('*')
          .eq('is_paid', true);

        if (!ledger) return;

        // Xử lý dữ liệu cho Biểu đồ cột (Thu Chi theo tháng)
        const groupedByMonth: Record<string, { name: string; thu: number; chi: number }> = {};
        
        // Xử lý dữ liệu cho Biểu đồ tròn (Tỷ trọng nghiệp vụ)
        let totalVon = 0, totalDoanhThu = 0, totalChiPhi = 0, totalHoanUng = 0;

        ledger.forEach((item) => {
          // 1. Group by Month
          const month = item.month_period || 'Khác';
          if (!groupedByMonth[month]) {
            groupedByMonth[month] = { name: month, thu: 0, chi: 0 };
          }

          const amount = Number(item.amount) || 0;

          if (item.type === 'VON_GOP' || item.type === 'DOANH_THU') {
            groupedByMonth[month].thu += amount;
          } else if (item.type === 'CHI_PHI' || item.type === 'CHI_TIEU' || item.type === 'HOAN_UNG') {
            groupedByMonth[month].chi += amount;
          }

          // 2. Group by Type for Pie Chart
          if (item.type === 'VON_GOP') totalVon += amount;
          if (item.type === 'DOANH_THU') totalDoanhThu += amount;
          if (item.type === 'CHI_PHI' || item.type === 'CHI_TIEU') totalChiPhi += amount;
          if (item.type === 'HOAN_UNG') totalHoanUng += amount;
        });

        // Chuyển object thành array và sort theo tháng
        const chartData = Object.values(groupedByMonth).sort((a, b) => {
          // Format month_period là MM/YYYY, cần sort đúng logic thời gian
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
        ].filter(d => d.value > 0)); // Chỉ hiện các mục có dữ liệu lớn hơn 0

      } catch (error) {
        console.error("Lỗi lấy dữ liệu biểu đồ:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAndProcessData();
  }, []);

  // Custom Tooltip cho biểu đồ
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
      
      {/* 1. BIỂU ĐỒ CỘT: THỐNG KÊ DÒNG TIỀN THEO THÁNG */}
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

      {/* 2. BIỂU ĐỒ TRÒN: CƠ CẤU NGHIỆP VỤ LŨY KẾ */}
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

        {/* Chú thích (Legend) tùy chỉnh cho Biểu đồ tròn */}
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
  );
}