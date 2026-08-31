'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  CalendarDays,
  CheckCircle2,
  CircleDot,
  Factory,
  RefreshCcw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { AdminMetricCard, AdminPage, AdminPageHeader, AdminPanel, AdminPanelHeader } from '@/component/AdminUI';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { LoadingLink } from '@/component/GlobalLoading';
import {
  PRODUCTION_ORDER_STATUS_LABELS,
  PRODUCTION_PRIORITY_LABELS,
  PRODUCTION_STAGE_STATUS_LABELS,
  type ProductionOrderStatus,
  type ProductionStageStatus,
} from '@/lib/production-order-workflow';
import type {
  ProductionOrderDetail,
  ProductionOrderDetailResponse,
} from '@/lib/types/production-order-read';

const STATUS_TONES: Record<ProductionOrderStatus, string> = {
  DRAFT: 'border-slate-700 bg-slate-900 text-slate-300',
  NOT_STARTED: 'border-slate-700 bg-slate-900 text-slate-300',
  PREPARING: 'border-cyan-800 bg-cyan-950/50 text-cyan-300',
  IN_PRODUCTION: 'border-blue-800 bg-blue-950/50 text-blue-300',
  PENDING_REVIEW: 'border-violet-800 bg-violet-950/50 text-violet-300',
  ON_HOLD: 'border-amber-800 bg-amber-950/50 text-amber-300',
  BLOCKED: 'border-red-800 bg-red-950/50 text-red-300',
  COMPLETED: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  CANCELLED: 'border-slate-700 bg-slate-900 text-slate-500',
};

const STAGE_TONES: Record<ProductionStageStatus, string> = {
  LOCKED: 'border-slate-800 bg-slate-950 text-slate-500',
  READY: 'border-cyan-800 bg-cyan-950/40 text-cyan-300',
  IN_PROGRESS: 'border-blue-700 bg-blue-950/50 text-blue-200',
  PENDING_REVIEW: 'border-violet-800 bg-violet-950/50 text-violet-300',
  COMPLETED: 'border-emerald-800 bg-emerald-950/50 text-emerald-300',
  ON_HOLD: 'border-amber-800 bg-amber-950/50 text-amber-300',
  BLOCKED: 'border-red-800 bg-red-950/50 text-red-300',
  SKIPPED_WITH_APPROVAL: 'border-slate-700 bg-slate-900 text-slate-300',
};

function formatDate(value: string | null): string {
  if (!value) return 'Chưa đặt hạn';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt hạn';
  return date.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
}

function completionPercent(order: ProductionOrderDetail): number {
  if (order.plannedQuantity <= 0) return 0;
  return Math.min(100, Math.round((order.completedQuantity / order.plannedQuantity) * 100));
}

export default function ProductionOrderDetailPage() {
  const params = useParams<{ productionOrderId: string }>();
  const productionOrderId = params.productionOrderId;
  const [order, setOrder] = useState<ProductionOrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadOrder = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(`/api/admin/production-orders/${encodeURIComponent(productionOrderId)}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as (ProductionOrderDetailResponse & { message?: string }) | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message || 'Không thể tải chi tiết lệnh sản xuất.');
      setOrder(payload.order);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không thể tải chi tiết lệnh sản xuất.');
    } finally {
      setLoading(false);
    }
  }, [productionOrderId]);

  useEffect(() => {
    void loadOrder();
  }, [loadOrder]);

  if (loading && !order) return <CenteredPageLoading message="Đang tải chi tiết lệnh sản xuất..." />;

  if (!order) {
    return (
      <AdminPage>
        <LoadingLink href="/admin/production-orders" loadingMessage="Đang tải lệnh sản xuất..." className="admin-button-secondary w-fit"><ArrowLeft className="h-4 w-4" />Quay lại danh sách</LoadingLink>
        <div className="admin-card flex flex-col items-center px-5 py-14 text-center">
          <ShieldAlert className="h-8 w-8 text-red-300" aria-hidden="true" />
          <h1 className="mt-4 text-base font-bold text-slate-100">Không thể mở lệnh sản xuất</h1>
          <p className="mt-2 max-w-xl text-sm text-slate-400">{loadError || 'Không tìm thấy lệnh sản xuất hoặc bạn không có quyền xem.'}</p>
          <button type="button" className="admin-button-secondary mt-5" onClick={() => void loadOrder()}>Thử lại</button>
        </div>
      </AdminPage>
    );
  }

  const percent = completionPercent(order);
  const completedStages = order.stages.filter((stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED_WITH_APPROVAL').length;
  const needsAttention = order.stages.filter((stage) => ['BLOCKED', 'PENDING_REVIEW', 'ON_HOLD'].includes(stage.status)).length;

  return (
    <AdminPage>
      <div>
        <LoadingLink href="/admin/production-orders" loadingMessage="Đang tải lệnh sản xuất..." className="inline-flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-slate-100"><ArrowLeft className="h-4 w-4" />Lệnh sản xuất</LoadingLink>
      </div>
      <AdminPageHeader
        title={order.displayName || order.productOrCollection}
        description={`${order.productionCode} · ${order.projectName} · ${order.colorway}`}
        icon={Factory}
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <span className={`admin-badge ${STATUS_TONES[order.status]}`}>{PRODUCTION_ORDER_STATUS_LABELS[order.status]}</span>
            <button type="button" className="admin-button-secondary" onClick={() => void loadOrder()} disabled={loading}><RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />Làm mới</button>
          </div>
        )}
      />

      {loadError ? (
        <div className="admin-card flex items-center gap-3 border-amber-900/70 p-4 text-xs text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Dữ liệu đang hiển thị có thể chưa phải bản mới nhất. {loadError}</span>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Sản lượng" value={`${order.completedQuantity}/${order.plannedQuantity}`} supportingText={`${percent}% kế hoạch`} tone={percent === 100 ? 'emerald' : 'cyan'} icon={<Boxes className="h-5 w-5" />} />
        <AdminMetricCard label="Giai đoạn" value={`${completedStages}/${order.stages.length}`} supportingText={order.currentStageName || 'Chưa bắt đầu'} icon={<CircleDot className="h-5 w-5" />} />
        <AdminMetricCard label="Cần xử lý" value={needsAttention} supportingText="Bị vướng, tạm dừng hoặc chờ duyệt" tone={needsAttention > 0 ? 'amber' : 'neutral'} icon={<AlertTriangle className="h-5 w-5" />} />
        <AdminMetricCard label="Thành viên" value={order.activeMemberCount} supportingText="Thành viên sản xuất đang hoạt động" icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,0.7fr)]">
        <AdminPanel>
          <AdminPanelHeader title="Tiến trình sản xuất" description="Thứ tự và trạng thái hiện tại của từng giai đoạn." />
          {order.stages.length > 0 ? (
            <ol className="divide-y divide-slate-800/80">
              {order.stages.map((stage) => (
                <li key={stage.stageId} className="grid gap-3 p-4 sm:grid-cols-[44px_minmax(0,1fr)_auto] sm:items-center sm:px-5">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-full border font-mono text-xs font-bold ${stage.status === 'COMPLETED' ? 'border-emerald-700 bg-emerald-950/50 text-emerald-300' : 'border-slate-700 bg-slate-950 text-slate-400'}`}>
                    {stage.status === 'COMPLETED' ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : stage.sequence}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-sm font-bold text-slate-100">{stage.name}</h2>
                      {stage.requiresReview ? <span className="admin-badge border-violet-900 bg-violet-950/30 text-violet-300">Cần duyệt</span> : null}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-blue-500" style={{ width: `${stage.progress}%` }} /></div>
                      <span className="w-9 text-right font-mono text-[10px] text-slate-500">{stage.progress}%</span>
                    </div>
                  </div>
                  <span className={`admin-badge w-fit ${STAGE_TONES[stage.status]}`}>{PRODUCTION_STAGE_STATUS_LABELS[stage.status]}</span>
                </li>
              ))}
            </ol>
          ) : (
            <div className="px-5 py-14 text-center"><Factory className="mx-auto h-8 w-8 text-slate-700" /><p className="mt-3 text-sm font-bold text-slate-300">Chưa có giai đoạn sản xuất</p><p className="mt-1 text-xs text-slate-500">Lệnh này chưa được gắn quy trình sản xuất.</p></div>
          )}
        </AdminPanel>

        <div className="space-y-6">
          <AdminPanel>
            <AdminPanelHeader title="Thông tin lệnh" description="Thông tin tham chiếu ở chế độ chỉ xem." />
            <dl className="divide-y divide-slate-800/80 text-xs">
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Mã lệnh</dt><dd className="break-all font-mono font-bold text-cyan-300">{order.productionCode}</dd></div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Dự án</dt><dd className="text-right font-semibold text-slate-200">{order.projectName}</dd></div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Sản phẩm</dt><dd className="text-right text-slate-300">{order.productOrCollection}</dd></div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Mẫu màu</dt><dd className="text-right text-slate-300">{order.colorway}</dd></div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Ưu tiên</dt><dd className="text-right text-slate-300">{PRODUCTION_PRIORITY_LABELS[order.priority]}</dd></div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="flex items-center gap-1.5 text-slate-500"><CalendarDays className="h-3.5 w-3.5" />Hạn hoàn thành</dt><dd className="text-right text-slate-300">{formatDate(order.targetCompletionDate)}</dd></div>
              <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-3 px-4 py-3"><dt className="text-slate-500">Vật tư dự kiến</dt><dd className="text-right text-slate-300">{order.materialRequirementCount} mục</dd></div>
            </dl>
          </AdminPanel>

          <AdminPanel>
            <AdminPanelHeader title="Sản lượng hoàn thành" description="Số lượng đã hoàn thành so với kế hoạch." />
            <div className="p-5">
              <div className="flex items-end justify-between gap-3"><span className="font-mono text-2xl font-black text-slate-100">{percent}%</span><span className="text-xs text-slate-500">{order.completedQuantity}/{order.plannedQuantity}</span></div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${percent}%` }} /></div>
            </div>
          </AdminPanel>
        </div>
      </div>
    </AdminPage>
  );
}
