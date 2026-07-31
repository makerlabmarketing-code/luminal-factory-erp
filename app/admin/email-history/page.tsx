// app/admin/email-history/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/utils/supabase/client';
import { Mail, Search, RefreshCcw, ChevronLeft, X, ChevronRight, ChevronsLeft, ChevronsRight, CheckCircle2, XCircle, Trash2, Eye } from 'lucide-react';

interface EmailHistoryLog {
  id: number;
  recipient: string | null;
  subject: string | null;
  group_type: string | null;
  body: string | null;
  status: string | null;
  sent_at: string | null;
}

const HISTORY_SELECT = 'id, recipient, subject, group_type, body, status, sent_at';
const HISTORY_LOAD_ERROR = 'Không thể tải lịch sử email. Vui lòng thử lại.';
const HISTORY_DELETE_ERROR = 'Không thể xóa lịch sử email. Vui lòng thử lại.';

function sanitizeHistorySearch(value: string) {
  return value.trim().replace(/[(),.%_*]/g, ' ').replace(/\s+/g, ' ').slice(0, 100);
}

export default function AdminEmailHistoryLog() {
  const [history, setHistory] = useState<EmailHistoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const latestRequestRef = useRef(0);

  // States tra cứu tìm kiếm văn bản & lưới phân trang mẫu image_cbeb6a.png
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10); // Show rows mặc định 10 dòng
  const [pageInput, setPageInput] = useState('1');

  // State bật Popup coi chi tiết nội dung bức thư đã bắn đi quá khứ
  const [selectedLog, setSelectedLog] = useState<EmailHistoryLog | null>(null);

  const loadHistoryData = useCallback(async () => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;
    setLoading(true);
    setDbError(null);
    try {
      const from = (currentPage - 1) * itemsPerPage;
      const to = from + itemsPerPage - 1;
      const safeSearch = sanitizeHistorySearch(searchTerm);
      let query = supabase
        .from('email_history')
        .select(HISTORY_SELECT, { count: 'exact' })
        .order('id', { ascending: false })
        .range(from, to);

      if (safeSearch) {
        query = query.or(`recipient.ilike.%${safeSearch}%,subject.ilike.%${safeSearch}%,group_type.ilike.%${safeSearch}%`);
      }

      const { data, error, count } = await query;
      if (requestId !== latestRequestRef.current) return;
      if (error) {
        console.error('[email-history-load]', { code: error.code || 'unknown', requestId });
        setDbError(HISTORY_LOAD_ERROR);
      } else {
        const nextHistory = (data || []) as EmailHistoryLog[];
        setHistory(nextHistory);
        setTotalCount(count || 0);
        setSelectedLog((current) => nextHistory.find((row) => row.id === current?.id) || null);
      }
    } catch {
      if (requestId !== latestRequestRef.current) return;
      console.error('[email-history-load]', { code: 'unexpected_error', requestId });
      setDbError(HISTORY_LOAD_ERROR);
    } finally {
      if (requestId === latestRequestRef.current) setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm]);

  useEffect(() => {
    const timer = window.setTimeout(loadHistoryData, searchTerm ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [loadHistoryData, searchTerm]);

  const handleDeleteLog = async (id: number) => {
    if (deletingId !== null) return;
    if (window.confirm('⚠️ Sếp có chắc chắn muốn xóa vĩnh viễn dòng nhật ký bắn thư này không?')) {
      setDeletingId(id);
      const { error } = await supabase.from('email_history').delete().eq('id', id);
      if (error) {
        console.error('[email-history-delete]', { code: error.code || 'unknown', historyId: id });
        setDbError(HISTORY_DELETE_ERROR);
      } else {
        setSelectedLog((current) => current?.id === id ? null : current);
        await loadHistoryData();
      }
      setDeletingId(null);
    }
  };

  const totalPages = Math.ceil(totalCount / itemsPerPage) || 1;
  const visiblePages = Array.from({ length: Math.min(5, totalPages) }, (_, index) => {
    const start = Math.min(Math.max(1, currentPage - 2), Math.max(1, totalPages - 4));
    return start + index;
  });

  if (loading) {
    return (
      <div className="p-6 text-xs text-center font-mono text-slate-500 min-h-screen bg-slate-950 flex items-center justify-center gap-2">
        <RefreshCcw className="w-4 h-4 animate-spin inline" />
        <span>Đang quét nhật ký bắn mail viễn thông xưởng...</span>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER TỔNG BAR */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <Mail className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="text-base font-bold">Nhật Ký Lịch Sử Bắn Email Tự Động</h1>
            <p className="text-[11px] text-emerald-400 font-mono font-bold mt-0.5">Tổng số bản ghi phù hợp: {totalCount}</p>
          </div>
        </div>
        <button onClick={loadHistoryData} className="bg-slate-900 border border-slate-800 text-slate-300 hover:text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition">
          <RefreshCcw className="w-3.5 h-3.5" /> Làm Mới Nhật Ký
        </button>
      </div>

      {dbError && <div className="p-4 bg-red-950/40 border border-red-500/30 rounded-xl text-xs text-red-400 font-mono">⚠️ LỖI TRUY VẤN LOG: {dbError}</div>}

      {/* RENDER GRID TABLE NHẬT KÝ */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        
        {/* THANH ĐIỀU KHIỂN GÓC BẢNG TRÊN CÙNG */}
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-400 tracking-wider">Bảng giám sát vận hành luồng Mail viễn thông</span>
          
          {/* Ô TÌM KIẾM TEXT BOX TẠI GÓC BẢNG THEO LỆNH SẾP */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-500" />
            <input 
              type="text" 
              placeholder="Tìm hòm thư nhận, tiêu đề..." 
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-amber-500/30" 
              value={searchTerm} 
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); setPageInput('1'); }} 
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px] tracking-wider">
              <tr>
                <th className="p-4 w-1/6">Thời Gian Bắn</th>
                <th className="p-4 w-1/6">Phân Hệ Gửi</th>
                <th className="p-4 w-1/4">Địa Chỉ Thư Nhận (Recipient)</th>
                <th className="p-4">Tiêu Đề Bức Thư (Subject)</th>
                <th className="p-4 w-32 text-center">Trạng Thái</th>
                <th className="p-4 text-center w-24">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-[11px]">
              {history.length === 0 ? (
                <tr><td colSpan={6} className="p-8 text-center text-slate-500 font-mono">Chưa ghi nhận dòng lịch sử bắn mail nào khớp bộ lọc tra cứu.</td></tr>
              ) : (
                history.map(h => (
                  <tr key={h.id} className="hover:bg-slate-950/20 transition">
                    <td className="p-4 text-slate-500 font-mono select-none">{h.sent_at ? new Date(h.sent_at).toLocaleString('vi-VN') : 'Vừa xong'}</td>
                    <td className="p-4"><span className="bg-slate-950 border border-slate-800 px-2 py-1 rounded text-purple-400 font-mono font-bold uppercase text-[9px]">{h.group_type || 'SYSTEM'}</span></td>
                    <td className="p-4 font-bold text-slate-200 font-mono select-all">{h.recipient}</td>
                    <td className="p-4 text-slate-300 font-medium truncate max-w-xs">{h.subject || '(Trống tiêu đề)'}</td>
                    
                    {/* BADGE TRẠNG THÁI BẮN MAIL THÀNH CÔNG HOẶC THẤT BẠI TRỰC QUAN */}
                    <td className="p-4 text-center select-none">
                      {h.status === 'SUCCESS' ? (
                        <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold px-2 py-1 rounded-md flex items-center gap-1 w-fit mx-auto text-[10px]"><CheckCircle2 className="w-3 h-3" /> THÀNH CÔNG</span>
                      ) : (
                        <span className="bg-red-500/10 border border-red-500/20 text-red-400 font-bold px-2 py-1 rounded-md flex items-center gap-1 w-fit mx-auto text-[10px]"><XCircle className="w-3 h-3" /> THẤT BẠI</span>
                      )}
                    </td>

                    <td className="p-4 text-center space-x-1.5 font-sans">
                      <button onClick={() => setSelectedLog(h)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition" title="Xem chi tiết nội dung bức thư cổ"><Eye className="w-3.5 h-3.5"/></button>
                      <button onClick={() => handleDeleteLog(h.id)} disabled={deletingId !== null} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-400 hover:bg-red-950/20 transition disabled:cursor-not-allowed disabled:opacity-40" title="Xóa vết log"><Trash2 className="w-3.5 h-3.5"/></button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* 💥 THANH PHÂN TRANG CAO CẤP ENTERPRISE KHỚP 100% THEO TRANG MẪU IMAGE_CBEB6A.PNG CỦA SẾP */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4 text-xs font-mono text-slate-400 select-none">
          <div>Tổng cộng <span className="text-amber-400 font-bold">{totalCount}</span> bản ghi</div>
          
          <div className="flex flex-wrap items-center justify-end gap-4 w-full md:w-auto">
            <div className="flex items-center gap-1.5">
              <span>Show rows:</span>
              <select 
                className="bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 font-bold text-slate-200 focus:outline-none cursor-pointer"
                value={itemsPerPage}
                onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); setPageInput('1'); }}
              >
                <option value={5}>5</option><option value={10}>10</option><option value={20}>20</option><option value={50}>50</option>
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button onClick={() => { setCurrentPage(1); setPageInput('1'); }} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronsLeft className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => { const p = Math.max(1, currentPage - 1); setCurrentPage(p); setPageInput(String(p)); }} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
              
              {visiblePages.map(page => (
                <button key={page} onClick={() => { setCurrentPage(page); setPageInput(String(page)); }} className={`w-7 h-7 rounded-lg font-black transition text-[11px] ${currentPage === page ? 'bg-red-600 text-white shadow-md' : 'bg-slate-900 border border-slate-800 text-slate-400 hover:bg-slate-800'}`}>{page}</button>
              ))}

              <button onClick={() => { const p = Math.min(totalPages, currentPage + 1); setCurrentPage(p); setPageInput(String(p)); }} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
              <button onClick={() => { setCurrentPage(totalPages); setPageInput(String(totalPages)); }} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 hover:bg-slate-800 transition"><ChevronsRight className="w-4 h-4 text-slate-300" /></button>
            </div>

            <div className="flex items-center gap-1.5">
              <input type="number" min={1} max={totalPages} className="w-12 bg-slate-900 border border-slate-800 rounded-lg p-1 text-center font-bold text-slate-100 focus:outline-none" value={pageInput} onChange={(e) => setPageInput(e.target.value)} />
              <button onClick={() => { const p = Number(pageInput); if (p >= 1 && p <= totalPages) setCurrentPage(p); }} className="bg-slate-900 border border-slate-800 px-3 py-1 rounded-lg font-black hover:bg-slate-800 text-slate-200 transition">Go</button>
            </div>
          </div>
        </div>

      </div>

      {/* POPUP COI CHI TIẾT NỘI DUNG VĂN BẢN BỨC THƯ ĐÃ BẮN TRONG QUÁ KHỨ */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-lg space-y-4 text-xs text-slate-200 shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-amber-500 uppercase tracking-wide font-sans">📄 Chi Tiết Văn Bản Mail Đã Gửi</h3>
              <button onClick={() => setSelectedLog(null)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="space-y-3">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] leading-relaxed">
                <p><span className="text-slate-500">Đích đến (To):</span> <span className="text-slate-100 font-bold select-all">{selectedLog.recipient}</span></p>
                <p><span className="text-slate-500">Tiêu đề (Subject):</span> <span className="text-amber-400 font-bold">{selectedLog.subject || '(Không có tiêu đề)'}</span></p>
                <p><span className="text-slate-500">Mã kịch bản (Group):</span> <span className="text-purple-400 font-bold">{selectedLog.group_type}</span></p>
              </div>

              <div>
                <label className="text-slate-400 font-bold block mb-1.5">Nội dung bức thư chi tiết (Mail Body Content):</label>
                <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 min-h-[160px] max-h-[260px] overflow-y-auto text-slate-300 font-sans whitespace-pre-wrap select-text leading-relaxed">
                  {selectedLog.body || 'Bức thư này được hệ thống gửi tự động dạng mã token ẩn hoặc trống nội dung văn bản.'}
                </div>
              </div>
            </div>

            {/* THIẾT KẾ NÚT UX TỐI GIẢN - CHỈ CẦN NÚT ĐÓNG / HỦY QUYỀN VIEW */}
            <div className="pt-2 border-t border-slate-800 flex justify-end font-sans">
              <button 
                type="button" 
                onClick={() => setSelectedLog(null)} 
                className="bg-slate-950 border border-slate-800 px-6 py-2.5 rounded-xl font-bold text-slate-400 text-center transition hover:bg-slate-850 text-xs"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
