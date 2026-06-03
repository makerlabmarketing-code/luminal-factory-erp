// app/admin/capital/components/LedgerTable.tsx
'use client';
import { Edit2, Trash2, QrCode, Lock } from 'lucide-react';

interface LedgerTableProps {
  data: any[];
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
  
  const getTypeLabel = (item: any) => {
    if (item.type === 'HOAN_UNG') {
      return item.is_paid ? (
        <><span className="text-red-400">❌</span> <span className="text-slate-400 font-normal line-through text-[10px] mr-1">Hoàn ứng</span> {item.category}</>
      ) : (
        <><span className="text-cyan-400">🔄</span> [Hoàn ứng treo] {item.category}</>
      );
    }
    switch(item.type) {
      case 'CHI_PHI':
      case 'CHI_TIEU': return <><span className="text-red-400">❌</span> {item.category}</>;
      case 'VON_GOP': return <><span className="text-emerald-400">🟢</span> {item.sub_type === 'HIEN_VAT' ? '[Cá nhân tự chi] ' : ''}{item.category}</>;
      case 'DOANH_THU': return <><span className="text-yellow-400">💰</span> {item.category}</>;
      default: return item.category;
    }
  };

  return (
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
        {data.map((l) => {
          // Khóa kiểm tra: Xác định bản ghi hệ thống tự sinh đối ứng
          const isCounterEntry = l.type === 'VON_GOP' && l.sub_type === 'HIEN_VAT' && l.category?.startsWith('[Đối ứng]');

          return (
            <tr key={l.id} className="hover:bg-slate-950/20 transition">
              <td className="p-4 font-bold text-slate-200 flex items-center gap-1.5">{getTypeLabel(l)}</td>
              <td className="p-4 text-slate-400">{l.requested_by}</td>
              <td className="p-4">
                <button 
                  disabled={isCounterEntry}
                  onClick={() => onTogglePaid(l.id, l.is_paid)} 
                  className={`px-2 py-1 rounded text-[9px] border font-black ${isCounterEntry ? 'opacity-60 cursor-not-allowed' : ''} ${l.is_paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}
                >
                  {l.is_paid ? 'Đã Trả' : 'Treo nợ'}
                </button>
              </td>
              <td className="p-4 text-right font-mono font-bold text-slate-200">{Number(l.amount).toLocaleString()} đ</td>
              <td className="p-4 text-center space-x-1">
                {isCounterEntry ? (
                  // Khóa giao diện: Không cho phép thao tác sửa xóa trực tiếp
                  <div className="flex items-center justify-center gap-1 text-slate-500 text-[10px] italic select-none">
                    <Lock className="w-3 h-3 text-slate-600" /> Hệ thống tự động
                  </div>
                ) : (
                  <>
                    {!l.is_paid && (
                      <button onClick={() => onGenerateQr(l)} className="p-1.5 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400">
                        <QrCode className="w-3.5 h-3.5"/>
                      </button>
                    )}
                    <button onClick={() => onOpenEdit(l)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400">
                      <Edit2 className="w-3.5 h-3.5"/>
                    </button>
                    <button onClick={() => onDelete(l.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500">
                      <Trash2 className="w-3.5 h-3.5"/>
                    </button>
                  </>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}