'use client';
import { Fragment, useState } from 'react';
import { Edit2, Trash2, QrCode, Lock, ChevronDown, ChevronRight, Link as LinkIcon } from 'lucide-react';

interface LedgerTableProps {
  data: any[]; // Data nhận vào lúc này đã kèm theo thuộc tính l.linkedChild
  onTogglePaid: (id: number, currentStatus: boolean) => void;
  onOpenEdit: (item: any) => void;
  onDelete: (id: number) => void;
  onGenerateQr: (item: any) => void;
}

export default function LedgerTable({
  data,
  onTogglePaid,
  onOpenEdit,
  onDelete,
  onGenerateQr
}: LedgerTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getTypeLabel = (item: any) => {
    if (item.type === 'HOAN_UNG') {
      return item.is_paid ? (
        <><span className="text-red-400">❌</span> <span className="text-slate-400 font-normal line-through text-[10px] mr-1">Hoàn ứng</span> {item.category}</>
      ) : (
        <><span className="text-cyan-400">🔄</span> <span className="text-slate-300 font-normal text-[10px] mr-1">[Hoàn ứng treo]</span> {item.category}</>
      );
    }
    switch(item.type) {
      case 'CHI_PHI':
      case 'CHI_TIEU': return <><span className="text-red-400">❌</span> {item.category}</>;
      case 'VON_GOP': return <><span className="text-emerald-400">🟢</span> {item.sub_type === 'HIEN_VAT' ? <span className="text-slate-400 font-normal text-[10px] mr-1">[Cá nhân tự chi]</span> : ''}{item.category}</>;
      case 'DOANH_THU': return <><span className="text-yellow-400">💰</span> {item.category}</>;
      default: return item.category;
    }
  };

  return (
    <table className="w-full text-left text-xs text-slate-300">
      <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
        <tr>
          <th className="p-4 w-[45%]">Khoản Mục</th>
          <th className="p-4 w-[20%]">Nhân sự thực hiện</th>
          <th className="p-4 w-[15%]">Trạng thái quỹ</th>
          <th className="p-4 w-[10%] text-right">Số tiền</th>
          <th className="p-4 w-[10%] text-center">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
        {data.map((l) => {
          // Lấy bản ghi con từ thuộc tính linkedChild (đã được page.tsx gán vào)
          const child = l.linkedChild;
          const hasChild = !!child;
          const isExpanded = expandedRows.has(l.id);
          
          const isOrphanedCounterEntry = l.type === 'VON_GOP' && l.category?.startsWith('[Đối ứng]');

          return (
            <Fragment key={l.id}>
              {/* === DÒNG CHA (GIAO DỊCH CHÍNH) === */}
              <tr className={`hover:bg-slate-950/20 transition ${isExpanded ? 'bg-slate-950/40' : ''}`}>
                <td className="p-4 font-bold text-slate-200 flex items-center gap-1.5">
                  {hasChild && (
                    <button onClick={() => toggleRow(l.id)} className="mr-1 p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition">
                      {isExpanded ? <ChevronDown className="w-4 h-4"/> : <ChevronRight className="w-4 h-4"/>}
                    </button>
                  )}
                  {!hasChild && <span className="w-6 mr-1 inline-block"></span>}
                  
                  {getTypeLabel(l)}
                  
                  {hasChild && (
                    <span onClick={() => toggleRow(l.id)} className="ml-2 px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[9px] flex items-center gap-1 cursor-pointer hover:bg-blue-500/20 transition">
                      <LinkIcon className="w-2.5 h-2.5" /> Có đối ứng
                    </span>
                  )}
                </td>
                <td className="p-4 text-slate-400">{l.requested_by}</td>
                <td className="p-4">
                  <button 
                    disabled={isOrphanedCounterEntry}
                    onClick={() => onTogglePaid(l.id, l.is_paid)} 
                    className={`px-2 py-1 rounded text-[9px] border font-black ${isOrphanedCounterEntry ? 'opacity-60 cursor-not-allowed' : ''} ${l.is_paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
                  >
                    {l.is_paid ? 'Đã Trả' : 'Treo nợ'}
                  </button>
                </td>
                <td className="p-4 text-right font-mono font-bold text-slate-200">{Number(l.amount).toLocaleString()} đ</td>
                <td className="p-4 text-center space-x-1 flex justify-center">
                  {isOrphanedCounterEntry ? (
                    <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] italic select-none">
                      <Lock className="w-3 h-3 text-slate-600" /> Auto
                    </div>
                  ) : (
                    <>
                      {!l.is_paid && (
                        <button onClick={() => onGenerateQr(l)} className="p-1.5 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400 hover:bg-cyan-900 transition"><QrCode className="w-3.5 h-3.5"/></button>
                      )}
                      <button onClick={() => onOpenEdit(l)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400 hover:bg-slate-900 transition"><Edit2 className="w-3.5 h-3.5"/></button>
                      <button onClick={() => onDelete(l.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500 hover:bg-slate-900 transition"><Trash2 className="w-3.5 h-3.5"/></button>
                    </>
                  )}
                </td>
              </tr>

              {/* === DÒNG SỔ RA (BẢN GHI ĐỐI ỨNG) === */}
              {hasChild && isExpanded && (
                <tr className="bg-[#0b0f19]/80 border-l-[3px] border-l-blue-500 relative shadow-inner">
                  <td className="p-4 pl-14 font-bold text-slate-400 flex items-center gap-1.5 relative">
                    <div className="absolute left-[26px] top-0 bottom-1/2 w-4 border-l-2 border-b-2 border-slate-700 rounded-bl-lg"></div>
                    <Lock className="w-3 h-3 text-slate-500 z-10" />
                    {getTypeLabel(child)}
                  </td>
                  <td className="p-4 text-slate-500">{child.requested_by}</td>
                  <td className="p-4 opacity-50 pointer-events-none">
                    <button className="px-2 py-1 rounded text-[9px] border font-black bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Đã Trả</button>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-500">{Number(child.amount).toLocaleString()} đ</td>
                  <td className="p-4 text-center">
                    <span className="text-slate-500 text-[10px] italic">Liên kết tự động</span>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
  );
}