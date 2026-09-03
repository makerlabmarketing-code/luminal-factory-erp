'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Boxes,
  ChevronLeft,
  ChevronRight,
  Factory,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
} from 'lucide-react';
import { AdminMetricCard, AdminPage, AdminPageHeader, AdminPanel } from '@/component/AdminUI';
import { CenteredPageLoading } from '@/component/LuminalLoader';
import { LoadingLink } from '@/component/GlobalLoading';
import {
  PRODUCTION_ORDER_STATUS_LABELS,
  PRODUCTION_PRIORITY_LABELS,
  type ProductionOrderStatus,
  type ProductionPriority,
} from '@/lib/production-order-workflow';
import type {
  ProductionOrderListResponse,
  ProductionOrderSummary,
} from '@/lib/types/production-order-read';

const PAGE_SIZE = 12;

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

function formatDate(value: string | null): string {
  if (!value) return 'Chưa đặt hạn';
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return 'Chưa đặt hạn';
  return date.toLocaleDateString('vi-VN', { timeZone: 'UTC' });
}

function completionPercent(order: ProductionOrderSummary): number {
  if (order.plannedQuantity <= 0) return 0;
  return Math.min(100, Math.round((order.completedQuantity / order.plannedQuantity) * 100));
}

function ProductionStatusBadge({ status }: { status: ProductionOrderStatus }) {
  return <span className={`admin-badge ${STATUS_TONES[status]}`}>{PRODUCTION_ORDER_STATUS_LABELS[status]}</span>;
}

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrderSummary[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductionOrderStatus | 'ALL'>('ALL');
  const [priority, setPriority] = useState<ProductionPriority | 'ALL'>('ALL');
  const [page, setPage] = useState(1);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch('/api/admin/production-orders', { cache: 'no-store' });
      const payload = await response.json().catch(() => null) as (ProductionOrderListResponse & { message?: string }) | null;
      if (!response.ok || !payload?.success) throw new Error(payload?.message || 'Không thể tải lệnh sản xuất.');
      setOrders(payload.orders);
      setCanCreate(payload.capabilities.canCreate);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Không thể tải lệnh sản xuất.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOrders();
  }, [loadOrders]);

  const filteredOrders = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('vi');
    return orders.filter((order) => {
      const matchesSearch = !query || [
        order.productionCode,
        order.displayName,
        order.projectName,
        order.productOrCollection,
        order.colorway,
      ].some((value) => value?.toLocaleLowerCase('vi').includes(query));
      return matchesSearch && (status === 'ALL' || order.status === status) && (priority === 'ALL' || order.priority === priority);
    });
  }, [orders, priority, search, status]);

  useEffect(() => {
    setPage(1);
  }, [search, status, priority]);

  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginatedOrders = filteredOrders.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const activeCount = orders.filter((order) => ['PREPARING', 'IN_PRODUCTION'].includes(order.status)).length;
  const needsAttentionCount = orders.filter((order) => ['BLOCKED', 'PENDING_REVIEW', 'ON_HOLD'].includes(order.status)).length;
  const plannedQuantity = orders.reduce((total, order) => total + order.plannedQuantity, 0);

  if (loading && orders.length === 0) return <CenteredPageLoading message="Đang tải lệnh sản xuất..." />;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Lệnh sản xuất"
        description="Theo dõi lệnh theo dự án, mẫu màu, giai đoạn hiện tại và sản lượng đã hoàn thành."
        icon={Factory}
        actions={(
          <>
            {canCreate ? (
              <LoadingLink href="/admin/production-orders/new" loadingMessage="Đang tải lệnh sản xuất..." className="admin-button-primary">
                <Plus className="h-4 w-4" aria-hidden="true" />
                Tạo lệnh sản xuất
              </LoadingLink>
            ) : null}
            <button type="button" className="admin-button-secondary" onClick={() => void loadOrders()} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden="true" />
              Làm mới
            </button>
          </>
        )}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <AdminMetricCard label="Tổng lệnh" value={orders.length} supportingText="Lệnh bạn được phép xem" icon={<Boxes className="h-5 w-5" />} />
        <AdminMetricCard label="Đang triển khai" value={activeCount} supportingText="Đang chuẩn bị hoặc sản xuất" tone="cyan" icon={<Factory className="h-5 w-5" />} />
        <AdminMetricCard label="Cần xử lý" value={needsAttentionCount} supportingText="Bị vướng, tạm dừng hoặc chờ duyệt" tone={needsAttentionCount > 0 ? 'amber' : 'neutral'} icon={<AlertTriangle className="h-5 w-5" />} />
        <AdminMetricCard label="Sản lượng kế hoạch" value={plannedQuantity.toLocaleString('vi-VN')} supportingText="Tổng số lượng của các lệnh" icon={<Boxes className="h-5 w-5" />} />
      </div>

      {loadError ? (
        <div className="admin-card flex flex-col items-start gap-4 border-red-900/70 p-5 sm:flex-row sm:items-center">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-red-200">Không thể tải lệnh sản xuất</p>
            <p className="mt-1 text-xs text-slate-400">{loadError}</p>
          </div>
          <button type="button" className="admin-button-secondary" onClick={() => void loadOrders()}>Thử lại</button>
        </div>
      ) : null}

      <AdminPanel>
        <div className="grid gap-3 border-b border-slate-800 p-4 md:grid-cols-[minmax(0,1fr)_220px_180px]">
          <label className="relative">
            <span className="sr-only">Tìm lệnh sản xuất</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" aria-hidden="true" />
            <input className="admin-field pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã lệnh, dự án, sản phẩm..." />
          </label>
          <label>
            <span className="sr-only">Lọc theo trạng thái</span>
            <select className="admin-field" value={status} onChange={(event) => setStatus(event.target.value as ProductionOrderStatus | 'ALL')}>
              <option value="ALL">Tất cả trạng thái</option>
              {Object.entries(PRODUCTION_ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Lọc theo ưu tiên</span>
            <select className="admin-field" value={priority} onChange={(event) => setPriority(event.target.value as ProductionPriority | 'ALL')}>
              <option value="ALL">Mọi mức ưu tiên</option>
              {Object.entries(PRODUCTION_PRIORITY_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
        </div>

        {paginatedOrders.length > 0 ? (
          <>
            <div className="grid gap-3 p-4 md:hidden">
              {paginatedOrders.map((order) => (
                <LoadingLink key={order.productionOrderId} href={`/admin/production-orders/${order.productionOrderId}`} loadingMessage="Đang tải chi tiết lệnh sản xuất..." className="admin-card block p-4 transition-colors hover:border-slate-700 hover:bg-slate-900">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-xs font-bold text-cyan-300">{order.productionCode}</p>
                      <p className="mt-1 truncate text-sm font-bold text-slate-100">{order.displayName || order.productOrCollection}</p>
                    </div>
                    <ProductionStatusBadge status={order.status} />
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div><dt className="text-slate-500">Dự án</dt><dd className="mt-1 truncate text-slate-300">{order.projectName}</dd></div>
                    <div><dt className="text-slate-500">Mẫu màu</dt><dd className="mt-1 truncate text-slate-300">{order.colorway}</dd></div>
                    <div><dt className="text-slate-500">Giai đoạn</dt><dd className="mt-1 truncate text-slate-300">{order.currentStageName || 'Chưa bắt đầu'}</dd></div>
                    <div><dt className="text-slate-500">Hạn hoàn thành</dt><dd className="mt-1 text-slate-300">{formatDate(order.targetCompletionDate)}</dd></div>
                  </dl>
                  <div className="mt-4">
                    <div className="flex justify-between text-[11px] text-slate-500"><span>Sản lượng</span><span>{order.completedQuantity}/{order.plannedQuantity}</span></div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${completionPercent(order)}%` }} /></div>
                  </div>
                </LoadingLink>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-[980px] w-full text-left text-xs">
                <thead className="border-b border-slate-800 bg-slate-950/50 text-slate-500">
                  <tr><th className="px-4 py-3">Lệnh sản xuất</th><th className="px-4 py-3">Dự án / mẫu màu</th><th className="px-4 py-3">Trạng thái</th><th className="px-4 py-3">Giai đoạn</th><th className="px-4 py-3">Sản lượng</th><th className="px-4 py-3">Hạn hoàn thành</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {paginatedOrders.map((order) => (
                    <tr key={order.productionOrderId} className="hover:bg-slate-800/30">
                      <td className="px-4 py-4"><LoadingLink href={`/admin/production-orders/${order.productionOrderId}`} loadingMessage="Đang tải chi tiết lệnh sản xuất..." className="font-mono font-bold text-cyan-300 hover:text-cyan-200">{order.productionCode}</LoadingLink><p className="mt-1 max-w-[220px] truncate text-slate-400">{order.displayName || order.productOrCollection}</p></td>
                      <td className="px-4 py-4"><p className="max-w-[220px] truncate font-semibold text-slate-200">{order.projectName}</p><p className="mt-1 max-w-[220px] truncate text-slate-500">{order.colorway}</p></td>
                      <td className="px-4 py-4"><ProductionStatusBadge status={order.status} /><p className="mt-1.5 text-[10px] text-slate-500">Ưu tiên: {PRODUCTION_PRIORITY_LABELS[order.priority]}</p></td>
                      <td className="px-4 py-4 text-slate-300">{order.currentStageName || 'Chưa bắt đầu'}</td>
                      <td className="px-4 py-4"><p className="font-mono font-semibold text-slate-200">{order.completedQuantity}/{order.plannedQuantity}</p><div className="mt-2 h-1.5 w-24 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-cyan-500" style={{ width: `${completionPercent(order)}%` }} /></div></td>
                      <td className="px-4 py-4 text-slate-300">{formatDate(order.targetCompletionDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div className="px-5 py-14 text-center">
            <Factory className="mx-auto h-8 w-8 text-slate-700" aria-hidden="true" />
            <p className="mt-3 text-sm font-bold text-slate-300">{orders.length === 0 ? 'Chưa có lệnh sản xuất nào' : 'Không tìm thấy kết quả'}</p>
            <p className="mt-1 text-xs text-slate-500">{orders.length === 0 ? 'Dữ liệu sẽ xuất hiện khi lệnh sản xuất được tạo qua quy trình đã duyệt.' : 'Hãy đổi từ khóa hoặc bộ lọc hiện tại.'}</p>
          </div>
        )}

        <div className="flex flex-col gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>Hiển thị {paginatedOrders.length} trong {filteredOrders.length} lệnh phù hợp</p>
          <div className="flex items-center gap-2">
            <button type="button" className="admin-icon-button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={currentPage <= 1} aria-label="Trang trước"><ChevronLeft className="h-4 w-4" /></button>
            <span>Trang {currentPage}/{totalPages}</span>
            <button type="button" className="admin-icon-button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={currentPage >= totalPages} aria-label="Trang sau"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
      </AdminPanel>
    </AdminPage>
  );
}
