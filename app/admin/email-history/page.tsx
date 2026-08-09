'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  Mail,
  RefreshCcw,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from 'lucide-react';

interface EmailHistoryLog {
  id: number;
  recipient: string | null;
  subject: string | null;
  group_type: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
}

const HISTORY_LOAD_ERROR = 'Không thể tải lịch sử email. Vui lòng thử lại.';

export default function AdminEmailHistoryLog() {
  const [history, setHistory] = useState<EmailHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const latestRequestRef = useRef(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [pageInput, setPageInput] = useState('1');
  const [selectedLog, setSelectedLog] = useState<EmailHistoryLog | null>(null);

  const loadHistoryData = useCallback(async () => {
    const requestId = ++latestRequestRef.current;
    setLoading(true);
    setDbError(null);
    try {
      const params = new URLSearchParams({
        page: String(currentPage),
        pageSize: String(itemsPerPage),
      });
      if (searchTerm.trim()) params.set('search', searchTerm.trim());

      const response = await fetch(`/api/admin/email-history?${params.toString()}`, {
        cache: 'no-store',
      });
      const body = await response.json();
      if (requestId !== latestRequestRef.current) return;
      if (!response.ok) throw new Error(body.message || HISTORY_LOAD_ERROR);

      const nextHistory = (body.rows || []) as EmailHistoryLog[];
      setHistory(nextHistory);
      setTotalCount(Number(body.totalCount || 0));
      setSelectedLog((current) => nextHistory.find((row) => row.id === current?.id) || null);
    } catch (error) {
      if (requestId !== latestRequestRef.current) return;
      console.error('[email-history-load]', { code: 'controlled_read_failure', requestId });
      setDbError(error instanceof Error ? error.message : HISTORY_LOAD_ERROR);
      setHistory([]);
      setTotalCount(0);
      setSelectedLog(null);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadHistoryData(), searchTerm ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      latestRequestRef.current += 1;
    };
  }, [loadHistoryData, searchTerm]);

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4));
    return start + index;
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 bg-slate-950 p-6 text-center font-mono text-xs text-slate-500">
        <RefreshCcw className="h-4 w-4 animate-spin" />
        <span>Đang tải lịch sử email...</span>
      </div>
    );
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 bg-slate-950 p-6 font-sans text-slate-100">
      <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-800 pb-4 sm:flex-row sm:items-center">
        <div className="flex items-center gap-2">
          <Mail className="h-5 w-5 text-amber-500" />
          <div>
            <h1 className="text-base font-bold">Lịch sử email hệ thống</h1>
            <p className="mt-0.5 font-mono text-[11px] font-bold text-emerald-400">Tổng số bản ghi phù hợp: {totalCount}</p>
          </div>
        </div>
        <button onClick={() => void loadHistoryData()} className="flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-bold text-slate-300 transition hover:text-white">
          <RefreshCcw className="h-3.5 w-3.5" /> Làm mới
        </button>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs text-amber-100">
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <p>Lịch sử đang ở chế độ chỉ đọc. Xóa vĩnh viễn, lưu trữ và gửi lại email vẫn bị khóa cho tới khi chính sách lưu trữ, quyền và audit được phê duyệt.</p>
      </div>

      {dbError && <div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/40 p-4 font-mono text-xs text-red-400">⚠️ {dbError}</div>}

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex flex-col items-start justify-between gap-3 border-b border-slate-800 bg-slate-950/40 px-5 py-3 sm:flex-row sm:items-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Bảng giám sát email</span>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              maxLength={100}
              placeholder="Tìm người nhận, tiêu đề, nhóm..."
              className="w-full rounded-xl border border-slate-800 bg-slate-950 py-2 pl-9 pr-3 text-xs text-slate-200 focus:border-amber-500/30 focus:outline-none"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setPageInput('1'); }}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="border-b border-slate-800 bg-slate-950 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="w-1/6 p-4">Thời gian gửi</th>
                <th className="w-1/6 p-4">Phân hệ</th>
                <th className="w-1/4 p-4">Người nhận</th>
                <th className="p-4">Tiêu đề</th>
                <th className="w-32 p-4 text-center">Trạng thái</th>
                <th className="w-20 p-4 text-center">Xem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {history.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center font-mono text-slate-500">Không có bản ghi email phù hợp bộ lọc.</td></tr>
              ) : history.map((item) => (
                <tr key={item.id} className="transition hover:bg-slate-950/20">
                  <td className="p-4 font-mono text-slate-500">{item.sent_at ? new Date(item.sent_at).toLocaleString('vi-VN') : 'Chưa xác định'}</td>
                  <td className="p-4"><span className="rounded border border-slate-800 bg-slate-950 px-2 py-1 font-mono text-[9px] font-bold uppercase text-purple-400">{item.group_type || 'SYSTEM'}</span></td>
                  <td className="p-4 font-mono font-bold text-slate-200">{item.recipient || '(Không có)'}</td>
                  <td className="max-w-xs truncate p-4 font-medium text-slate-300">{item.subject || '(Trống tiêu đề)'}</td>
                  <td className="p-4 text-center">
                    {item.status === 'SUCCESS' ? (
                      <span className="mx-auto flex w-fit items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1 text-[10px] font-bold text-emerald-400"><CheckCircle2 className="h-3 w-3" /> THÀNH CÔNG</span>
                    ) : (
                      <span className="mx-auto flex w-fit items-center gap-1 rounded-md border border-red-500/20 bg-red-500/10 px-2 py-1 text-[10px] font-bold text-red-400"><XCircle className="h-3 w-3" /> THẤT BẠI</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button onClick={() => setSelectedLog(item)} className="rounded-lg border border-slate-800 bg-slate-950 p-1.5 text-slate-400 transition hover:text-white" title="Xem chi tiết"><Eye className="h-3.5 w-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-slate-800 bg-slate-950/50 p-4 font-mono text-xs text-slate-400 md:flex-row">
          <div>Tổng cộng <span className="font-bold text-amber-400">{totalCount}</span> bản ghi</div>
          <div className="flex w-full flex-wrap items-center justify-end gap-4 md:w-auto">
            <div className="flex items-center gap-1.5">
              <span>Số dòng:</span>
              <select className="cursor-pointer rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 font-bold text-slate-200 focus:outline-none" value={itemsPerPage} onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); setPageInput('1'); }}>
                <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
              </select>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setCurrentPage(1); setPageInput('1'); }} disabled={currentPage === 1} className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 transition hover:bg-slate-800 disabled:opacity-20"><ChevronsLeft className="h-4 w-4" /></button>
              <button onClick={() => { const page = Math.max(1, currentPage - 1); setCurrentPage(page); setPageInput(String(page)); }} disabled={currentPage === 1} className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 transition hover:bg-slate-800 disabled:opacity-20"><ChevronLeft className="h-4 w-4" /></button>
              {visiblePages.map((page) => <button key={page} onClick={() => { setCurrentPage(page); setPageInput(String(page)); }} className={`h-7 w-7 rounded-lg text-[11px] font-black transition ${currentPage === page ? 'bg-red-600 text-white' : 'border border-slate-800 bg-slate-900 text-slate-400 hover:bg-slate-800'}`}>{page}</button>)}
              <button onClick={() => { const page = Math.min(totalPages, currentPage + 1); setCurrentPage(page); setPageInput(String(page)); }} disabled={currentPage === totalPages} className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 transition hover:bg-slate-800 disabled:opacity-20"><ChevronRight className="h-4 w-4" /></button>
              <button onClick={() => { setCurrentPage(totalPages); setPageInput(String(totalPages)); }} disabled={currentPage === totalPages} className="rounded-lg border border-slate-800 bg-slate-900 p-1.5 transition hover:bg-slate-800 disabled:opacity-20"><ChevronsRight className="h-4 w-4" /></button>
            </div>
            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={totalPages} className="w-12 rounded-lg border border-slate-800 bg-slate-900 p-1 text-center font-bold text-slate-100 focus:outline-none" value={pageInput} onChange={(e) => setPageInput(e.target.value)} />
              <button onClick={() => { const page = Number(pageInput); if (page >= 1 && page <= totalPages) setCurrentPage(page); }} className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1 font-black text-slate-200 transition hover:bg-slate-800">Đi</button>
            </div>
          </div>
        </div>
      </div>

      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="relative w-full max-w-lg space-y-4 rounded-3xl border border-slate-800 bg-slate-900 p-6 text-xs text-slate-200 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
              <h3 className="font-bold uppercase tracking-wide text-amber-500">Chi tiết email đã gửi</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-[11px] leading-relaxed">
                <p><span className="text-slate-500">Người nhận:</span> <span className="font-bold text-slate-100">{selectedLog.recipient || '(Không có)'}</span></p>
                <p><span className="text-slate-500">Tiêu đề:</span> <span className="font-bold text-amber-400">{selectedLog.subject || '(Không có tiêu đề)'}</span></p>
                <p><span className="text-slate-500">Nhóm:</span> <span className="font-bold text-purple-400">{selectedLog.group_type || 'SYSTEM'}</span></p>
              </div>
              <div>
                <label className="mb-1.5 block font-bold text-slate-400">Nội dung email:</label>
                <div className="max-h-[260px] min-h-[160px] overflow-y-auto whitespace-pre-wrap rounded-xl border border-slate-800/80 bg-slate-950 p-4 leading-relaxed text-slate-300">{selectedLog.body || 'Không có nội dung được lưu.'}</div>
              </div>
            </div>
            <div className="flex justify-end border-t border-slate-800 pt-2">
              <button type="button" onClick={() => setSelectedLog(null)} className="rounded-xl border border-slate-800 bg-slate-950 px-6 py-2.5 text-xs font-bold text-slate-400 transition hover:bg-slate-800">Đóng</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
