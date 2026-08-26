'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Banknote, Wallet } from 'lucide-react';
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
import { AdminMetricCard, AdminPanel, AdminPanelHeader } from '@/component/AdminUI';
import { LuminalLoadingMark } from '@/component/LuminalLoader';

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

function formatCurrency(value: number | string): string {
  return `${Number(value).toLocaleString('vi-VN')} đ`;
}

function DashboardTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950 p-3 text-xs shadow-xl">
      {label ? <p className="mb-2 border-b border-slate-800 pb-2 text-center font-bold text-slate-400">{label}</p> : null}
      {payload.map((entry, index) => (
        <div key={`${entry.name || 'value'}-${index}`} className="flex justify-between gap-4 py-1">
          <span style={{ color: entry.color }} className="font-bold">
            {entry.name === 'thu' ? 'Tổng thu' : entry.name === 'chi' ? 'Tổng chi' : entry.name}:
          </span>
          <span className="font-mono text-slate-200">{formatCurrency(entry.value || 0)}</span>
        </div>
      ))}
    </div>
  );
}

export default function AdminDashboardCharts({ dashboard }: AdminDashboardChartsProps) {
  const pieData = dashboard.cashFlowComposition.map((entry) => ({
    ...entry,
    color: COMPOSITION_COLORS[entry.name],
  }));

  return (
    <div className="space-y-6">
      <ScrollReveal className="grid select-none grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard
          label={`Vốn nạp · ${dashboard.reportingYear}`}
          value={`+${formatCurrency(dashboard.summary.totalCapital)}`}
          supportingText="Tổng vốn đã ghi nhận"
          tone="emerald"
          icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
        />
        <AdminMetricCard
          label={`Doanh thu · ${dashboard.reportingYear}`}
          value={`+${formatCurrency(dashboard.summary.totalRevenue)}`}
          supportingText="Doanh thu đã thanh toán"
          tone="amber"
          icon={<ArrowUpRight className="h-5 w-5" aria-hidden="true" />}
        />
        <AdminMetricCard
          label={`Tổng chi · ${dashboard.reportingYear}`}
          value={`-${formatCurrency(dashboard.summary.totalExpense)}`}
          supportingText="Chi phí đã thanh toán"
          tone="red"
          icon={<ArrowDownRight className="h-5 w-5" aria-hidden="true" />}
        />
        <AdminMetricCard
          label="Số dư quỹ hiện tại"
          value={formatCurrency(dashboard.summary.currentBalance)}
          supportingText="Vốn và thu sau khi trừ chi"
          tone="emerald"
          featured
          icon={<Banknote className="h-5 w-5" aria-hidden="true" />}
        />
      </ScrollReveal>

      <ScrollReveal className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]" delayMs={40}>
        <AdminPanel>
          <AdminPanelHeader title="Biến động dòng tiền qua các kỳ" description="So sánh tổng thu và tổng chi thực tế theo từng tháng." />
          {dashboard.monthlyCashFlow.length > 0 ? (
            <div className="overflow-x-auto p-4 sm:p-5">
              <div className="h-72 min-w-[560px] sm:min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.monthlyCashFlow} margin={{ top: 10, right: 10, left: -20, bottom: 0 }} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="name" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#64748b" fontSize={10} tickFormatter={(value) => `${Number(value) / 1000000}M`} tickLine={false} axisLine={false} />
                    <Tooltip content={<DashboardTooltip />} cursor={{ fill: '#0f172a', opacity: 0.4 }} />
                    <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '10px' }} />
                    <Bar dataKey="thu" name="Tổng thu" fill={COLORS.thu} radius={[4, 4, 0, 0]} barSize={24} />
                    <Bar dataKey="chi" name="Tổng chi" fill={COLORS.chi} radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="m-4 flex min-h-72 items-center justify-center rounded-lg border border-dashed border-slate-800 px-6 text-center text-xs text-slate-500 sm:m-5">
              Chưa có dòng tiền đã thanh toán để hiển thị theo kỳ.
            </div>
          )}
        </AdminPanel>

        <AdminPanel className="flex flex-col">
          <AdminPanelHeader title="Cơ cấu dòng tiền" description="Phân bổ các loại nghiệp vụ đã ghi nhận lũy kế." />

          {pieData.length > 0 ? (
            <>
              <div className="h-60 w-full flex-1 px-4 pt-4">
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
                    <Tooltip content={<DashboardTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="grid grid-cols-1 gap-2 border-t border-slate-800 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-1 2xl:grid-cols-2">
                {pieData.map((entry) => (
                  <div key={entry.name} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-2.5">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: entry.color }} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold text-slate-400">{entry.name}</p>
                      <p className="truncate font-mono text-xs text-slate-200">{formatCurrency(entry.value)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="m-4 flex min-h-60 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-800 px-6 text-center text-xs text-slate-500 sm:m-5">
              Chưa có dữ liệu cơ cấu dòng tiền.
            </div>
          )}
        </AdminPanel>
      </ScrollReveal>
    </div>
  );
}

export function AdminDashboardLoading() {
  return <div className="flex justify-center p-10"><LuminalLoadingMark compact /></div>;
}

export function AdminDashboardError() {
  const router = useRouter();
  const [isRetrying, startTransition] = useTransition();

  return (
    <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/20 p-5 text-sm text-red-100">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400" />
        <div className="min-w-0">
          <p className="font-bold">Không tải được dữ liệu.</p>
          <p className="mt-1 text-xs leading-5 text-red-200/80">Kết nối dữ liệu vận hành đang bị gián đoạn. Bạn có thể thử tải lại màn hình này.</p>
          <button
            type="button"
            disabled={isRetrying}
            onClick={() => startTransition(() => router.refresh())}
            className="mt-3 inline-flex min-h-10 items-center rounded-lg border border-red-400/30 px-3 py-2 text-xs font-bold text-red-100 transition-colors hover:bg-red-900/30 disabled:opacity-60"
          >
            {isRetrying ? 'Đang thử lại...' : 'Thử lại'}
          </button>
        </div>
      </div>
    </div>
  );
}
