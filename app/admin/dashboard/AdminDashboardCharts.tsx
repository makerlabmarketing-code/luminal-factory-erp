'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, RefreshCcw, Wallet } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminDashboardDto, DashboardCompositionDto } from '@/services/adminDashboardDto';
import { ScrollReveal } from '@/component/ScrollReveal';

const COLORS = {
  thu: '#34d399',
  chi: '#f87171',
  von_gop: '#10b981',
  doanh_thu: '#eab308',
  chi_phi: '#ef4444',
  hoan_ung: '#22d3ee',
};

const COMPOSITION_COLORS: Record<DashboardCompositionDto['name'], string> = {
  'Vốn Góp': COLORS.von_gop,
  'Doanh Thu': COLORS.doanh_thu,
  'Chi Phí': COLORS.chi_phi,
  'Hoàn Ứng': COLORS.hoan_ung,
};

interface AdminDashboardChartsProps {
  dashboard: AdminDashboardDto;
}

interface TooltipPayload {
  color?: string;
  name?: string;
  value?: number | string;
}

interface ChartTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

export default function AdminDashboardCharts({ dashboard }: AdminDashboardChartsProps) {
  const pieData = dashboard.cashFlowComposition.map((entry) => ({
    ...entry,
    color: COMPOSITION_COLORS[entry.name],
  }));

  const CustomTooltip = ({ active, payload, label }: ChartTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl shadow-xl text-xs font-mono">
          <p className="text-slate-400 font-bold mb-2 pb-2 border-b border-slate-800 text-center">{label}</p>
          {payload.map((entry, index) => (
            <div key={`${entry.name || 'value'}-${index}`} className="flex justify-between gap-4 py-1">
              <span style={{ color: entry.color }} className="font-bold uppercase">
                {entry.name === 'thu' ? 'Tổng Thu' : entry.name === 'chi' ? 'Tổng Chi' : entry.name}:
              </span>
              <span className="text-slate-200">{Number(entry.value).toLocaleString()} đ</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <ScrollReveal className="grid grid-cols-2 gap-4 select-none md:grid-cols-4">
        <div className="admin-card flex flex-col justify-center p-4 transition hover:border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <Wallet className="w-3.5 h-3.5 text-emerald-500" /> Vốn nạp ({dashboard.reportingYear})
          </p>
          <p className="text-lg font-black text-emerald-400 mt-1 font-mono tracking-wide">
            +{dashboard.summary.totalCapital.toLocaleString()}
          </p>
        </div>

        <div className="admin-card flex flex-col justify-center p-4 transition hover:border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-yellow-500" /> Doanh thu ({dashboard.reportingYear})
          </p>
          <p className="text-lg font-black text-yellow-400 mt-1 font-mono tracking-wide">
            +{dashboard.summary.totalRevenue.toLocaleString()}
          </p>
        </div>

        <div className="admin-card flex flex-col justify-center p-4 transition hover:border-slate-700">
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
            <ArrowDownRight className="w-3.5 h-3.5 text-red-500" /> Tổng chi ({dashboard.reportingYear})
          </p>
          <p className="text-lg font-black text-red-400 mt-1 font-mono tracking-wide">
            -{dashboard.summary.totalExpense.toLocaleString()}
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
            {dashboard.summary.currentBalance.toLocaleString()} đ
          </p>
        </div>
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-1 gap-6 lg:grid-cols-3" delayMs={40}>
        <div className="admin-card p-5 lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Biến động dòng tiền qua các kỳ</h3>
            <p className="text-[10px] text-slate-500 mt-1">So sánh tổng Thu và tổng Chi thực tế theo từng tháng</p>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.monthlyCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={4}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={10} tickFormatter={(value) => `${Number(value) / 1000000}M`} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#0f172a', opacity: 0.4 }} />
                <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                <Bar dataKey="thu" name="Tổng Thu" fill={COLORS.thu} radius={[4, 4, 0, 0]} barSize={24} />
                <Bar dataKey="chi" name="Tổng Chi" fill={COLORS.chi} radius={[4, 4, 0, 0]} barSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="admin-card flex flex-col p-5">
          <div className="mb-2">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Cơ cấu dòng tiền</h3>
            <p className="text-[10px] text-slate-500 mt-1">Phân bổ tỷ trọng các loại nghiệp vụ lũy kế</p>
          </div>

          {pieData.length > 0 ? (
            <>
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
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-slate-800">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }}></span>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold">{entry.name}</p>
                      <p className="text-[10px] font-mono text-slate-200">{Number(entry.value).toLocaleString()} đ</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex min-h-60 flex-1 items-center justify-center rounded-lg border border-slate-800 text-xs text-slate-500">
              Không có dữ liệu trong kỳ đã chọn.
            </div>
          )}
        </div>
      </ScrollReveal>
    </div>
  );
}

export function AdminDashboardLoading() {
  return <div className="flex justify-center p-10"><RefreshCcw className="w-5 h-5 text-emerald-500 animate-spin" /></div>;
}

export function AdminDashboardError() {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  return (
    <div className="mt-4 rounded-lg border border-red-500/30 bg-red-950/20 p-4 text-sm text-red-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
        <div>
          <p className="font-bold">Không tải được dữ liệu.</p>
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => startTransition(() => router.refresh())}
            className="mt-2 inline-flex text-xs font-bold text-red-100 underline decoration-red-300/60 underline-offset-4 disabled:opacity-60"
          >
            {isRetrying ? 'Đang thử lại...' : 'Thử lại'}
          </button>
        </div>
      </div>
    </div>
  );
}
