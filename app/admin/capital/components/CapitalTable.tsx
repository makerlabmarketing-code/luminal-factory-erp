import { Edit2, Trash2, QrCode, ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';

interface CapitalTableProps {
  selectedMonth: string;
  searchTerm: string;
  setSearchTerm: (val: string) => void;
  currentLedgerData: any[];
  currentPage: number;
  setCurrentPage: (val: number | ((prev: number) => number)) => void;
  totalPages: number;
  totalFiltered: number;
  itemsPerPage: number;
  handleTogglePaid: (id: number, status: boolean) => void;
  handleGenerateVietQR: (item: any) => void;
  handleOpenEdit: (item: any) => void;
  handleDeleteLedger: (id: number) => void;
}

export default function CapitalTable(props: CapitalTableProps) {
  const getTypeLabel = (item: any) => {
    if (item.type === 'HOAN_UNG') {
      return item.is_paid 
        ? <><span className="text-red-400">❌</span> <span className="text-slate-400 font-normal line-through text-[10px] mr-1">Hoàn ứng</span> {item.category}</> 
        : <><span className="text-cyan-400">🔄</span> [Hoàn ứng treo] {item.category}</>;
    }
    switch(item.type) {
      case 'CHI_PHI':
      case 'CHI_TIEU': return <><span className="text-red-400">❌</span> {item.category}</>;
      case 'VON_GOP': return <><span className="text-emerald-400">🟢</span> {item.sub_type === 'HIEN_VAT' ? '[Hiện vật] ' : ''}{item.category}</>;
      case 'DOANH_THU': return <><span className="text-yellow-400">💰</span> {item.category}</>;
      default: return item.category;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <span className="text-xs font-bold uppercase text-slate-400">Nhật Ký Hạch Toán Kỳ {props.selectedMonth}</span>
        <input 
          type="text" 
          placeholder="Tìm kiếm nội dung..." 
          className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none w-full sm:w-64" 
          value={props.searchTerm} 
          onChange={e => props.setSearchTerm(e.target.value)} 
        />
      </div>
      
      <table className="w-full text-left text-xs text-slate-300">
        <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
          <tr>
            <th className="p-4">Khoản Mục</th>
            <th className="p-4">Nhân sự thực hiện</th>
            <th className="p-4">Trạng thái quỹ</th>
            <th className="p-4 text-right">Số tiền</th>
            <th className="p-4 text-center">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
          {props.currentLedgerData.map(l => (
            <tr key={l.id} className="hover:bg-slate-950/20 transition">
              <td className="p-4 font-bold text-slate-200 flex items-center gap-1.5">{getTypeLabel(l)}</td>
              <td className="p-4 text-slate-400">{l.requested_by}</td>
              <td className="p-4">
                <button 
                  onClick={() => props.handleTogglePaid(l.id, l.is_paid)} 
                  className={`px-2 py-1 rounded text-[9px] border font-black ${l.is_paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
                >
                  {l.is_paid ? 'Đã Trả' : 'Treo nợ'}
                </button>
              </td>
              <td className="p-4 text-right font-mono font-bold text-slate-200">{Number(l.amount).toLocaleString()} đ</td>
              <td className="p-4 text-center space-x-1">
                {!l.is_paid && (
                  <button onClick={() => props.handleGenerateVietQR(l)} className="p-1.5 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400">
                    <QrCode className="w-3.5 h-3.5"/>
                  </button>
                )}
                <button onClick={() => props.handleOpenEdit(l)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400">
                  <Edit2 className="w-3.5 h-3.5"/>
                </button>
                <button onClick={() => props.handleDeleteLedger(l.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      
      {/* Phân trang */}
      {props.totalFiltered > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
          <span className="text-xs text-slate-500 mb-3 sm:mb-0">
            Hiển thị {(props.currentPage - 1) * props.itemsPerPage + 1} - {Math.min(props.currentPage * props.itemsPerPage, props.totalFiltered)} trong tổng số {props.totalFiltered} bản ghi
          </span>
          <div className="flex items-center gap-1.5">
            <button onClick={() => props.setCurrentPage(1)} disabled={props.currentPage === 1} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronsLeft className="w-4 h-4" /></button>
            <button onClick={() => props.setCurrentPage(prev => Math.max(1, prev - 1))} disabled={props.currentPage === 1} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-mono font-bold text-slate-300 px-3">{props.currentPage} / {props.totalPages}</span>
            <button onClick={() => props.setCurrentPage(prev => Math.min(props.totalPages, prev + 1))} disabled={props.currentPage === props.totalPages} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
            <button onClick={() => props.setCurrentPage(props.totalPages)} disabled={props.currentPage === props.totalPages} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronsRight className="w-4 h-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}