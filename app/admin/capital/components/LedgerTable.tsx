'use client';
import { Fragment, useState } from 'react';
import { Check, Edit2, QrCode, Lock, ChevronDown, ChevronRight, Link as LinkIcon, X, ArrowDownLeft, ArrowUpRight, RefreshCcw } from 'lucide-react';
import type { FinancialLedgerEntry } from '@/lib/types/finance';

type LedgerRow = FinancialLedgerEntry & { linkedChild?: FinancialLedgerEntry | null };

interface LedgerTableProps {
  data: LedgerRow[];
  onTogglePaid: (id: number | string, currentStatus: boolean) => void;
  onOpenEdit: (item: LedgerRow) => void;
  onGenerateQr: (item: LedgerRow) => void;
  reimbursementCapabilities: {
    currentEmployeeId: string;
    canApprove: boolean;
    canPay: boolean;
  };
  activeReimbursementActionId: number | string | null;
  onTransitionReimbursement: (item: LedgerRow, status: 'APPROVED' | 'REJECTED' | 'PAID') => void;
}

export default function LedgerTable({
  data,
  onTogglePaid,
  onOpenEdit,
  onGenerateQr,
  reimbursementCapabilities,
  activeReimbursementActionId,
  onTransitionReimbursement,
}: LedgerTableProps) {
  const [expandedRows, setExpandedRows] = useState<Set<number | string>>(new Set());

  const toggleRow = (id: number | string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getDisplayCategory = (item: FinancialLedgerEntry) =>
    (item.category || '').replace(/^\[(Đối ứng|Hủy đối ứng)\]\s*/, '');

  const getTypeBadge = (item: FinancialLedgerEntry) => {
    if (item.type === 'HOAN_UNG') {
      return <span className="inline-flex items-center gap-1 text-cyan-300"><RefreshCcw className="h-3 w-3" /> Hoàn ứng</span>;
    }
    switch(item.type) {
      case 'CHI_PHI':
      case 'CHI_TIEU': return <span className="inline-flex items-center gap-1 text-rose-300"><ArrowUpRight className="h-3 w-3" /> Khoản chi</span>;
      case 'VON_GOP': return <span className="inline-flex items-center gap-1 text-emerald-300"><ArrowDownLeft className="h-3 w-3" /> {item.sub_type === 'HIEN_VAT' ? 'Ghi nhận vốn hiện vật' : 'Góp vốn'}</span>;
      case 'DOANH_THU': return <span className="inline-flex items-center gap-1 text-amber-300"><ArrowDownLeft className="h-3 w-3" /> Khoản thu</span>;
      default: return <span>Giao dịch</span>;
    }
  };

  return (
    <div className="overflow-x-auto">
    <table className="min-w-[1180px] w-full text-left text-xs text-slate-300">
      <thead className="bg-slate-950 text-[10px] uppercase tracking-wide text-slate-400">
        <tr>
          <th className="w-[27%] p-4">Khoản mục</th>
          <th className="w-[14%] p-4">Người thực hiện</th>
          <th className="w-[14%] p-4">Người hưởng lợi</th>
          <th className="w-[13%] p-4">Trạng thái quỹ</th>
          <th className="w-[10%] p-4 text-right">Số tiền</th>
          <th className="w-[22%] p-4 text-center">Hành động</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-800/60 text-xs font-medium">
        {data.map((l) => {
          // Lấy bản ghi con từ thuộc tính linkedChild (đã được page.tsx gán vào)
          const child = l.linkedChild;
          const hasChild = !!child;
          const isExpanded = expandedRows.has(l.id);

          const isOrphanedCounterEntry = l.type === 'VON_GOP' && /^\[(Đối ứng|Hủy đối ứng)\]/.test(l.category || '');
          const isReimbursement = l.type === 'HOAN_UNG';
          const isOwnReimbursement = String(l.reimbursement_requester_employee_id) === reimbursementCapabilities.currentEmployeeId;
          const reimbursementBusy = String(activeReimbursementActionId) === String(l.id);

          return (
            <Fragment key={l.id}>
              {/* === DÒNG CHA (GIAO DỊCH CHÍNH) === */}
              <tr className={`hover:bg-slate-950/20 transition ${isExpanded ? 'bg-slate-950/40' : ''}`}>
                <td className="p-4 font-bold text-slate-200">
                  <div className="flex items-start gap-1.5">
                    {hasChild && (
                      <button type="button" aria-label={isExpanded ? 'Thu gọn khoản ghi nhận vốn' : 'Mở khoản ghi nhận vốn'} onClick={() => toggleRow(l.id)} className="mr-1 rounded p-1 text-slate-400 transition hover:bg-slate-800 hover:text-white">
                        {isExpanded ? <ChevronDown className="h-4 w-4"/> : <ChevronRight className="h-4 w-4"/>}
                      </button>
                    )}
                    {!hasChild && <span className="mr-1 inline-block w-6"></span>}

                    <div className="min-w-0">
                      <p className="break-words leading-5 text-slate-100">{getDisplayCategory(l)}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold">
                        <span className="rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5">{getTypeBadge(l)}</span>
                        {Boolean(l.attachments?.length) && <span className="whitespace-nowrap rounded bg-purple-500/10 px-1.5 py-0.5 text-purple-300">{l.attachments?.length} chứng từ</span>}
                        {hasChild && (
                          <button type="button" onClick={() => toggleRow(l.id)} className="inline-flex items-center gap-1 whitespace-nowrap rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-blue-300 transition hover:bg-blue-500/20">
                            <LinkIcon className="h-3 w-3" /> Có ghi nhận vốn kèm
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="max-w-[180px] break-words p-4 text-slate-400">{l.payer_name || l.requested_by || 'Chưa xác định'}</td>
                <td className="max-w-[180px] break-words p-4 text-slate-300">{l.beneficiary_name || 'Chưa xác định'}</td>
                <td className="p-4">
                  {isReimbursement ? (
                    <span className={`inline-flex whitespace-nowrap rounded border px-2.5 py-1.5 text-[10px] font-black ${l.reimbursement_status === 'PAID' ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : l.reimbursement_status === 'APPROVED' ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : l.reimbursement_status === 'REJECTED' ? 'border-red-500/20 bg-red-500/10 text-red-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-400'}`}>
                      {l.reimbursement_status === 'PAID' ? 'Đã thanh toán' : l.reimbursement_status === 'APPROVED' ? 'Đã duyệt' : l.reimbursement_status === 'REJECTED' ? 'Đã từ chối' : 'Chờ duyệt'}
                    </span>
                  ) : (
                    <button
                      disabled={isOrphanedCounterEntry}
                      onClick={() => onTogglePaid(l.id, Boolean(l.is_paid))}
                      className={`whitespace-nowrap rounded border px-2.5 py-1.5 text-[10px] font-black ${isOrphanedCounterEntry ? 'cursor-not-allowed opacity-60' : ''} ${l.is_paid ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400' : 'border-amber-500/20 bg-amber-500/10 text-amber-500'}`}
                    >
                      {l.is_paid ? 'Đã trả' : 'Treo nợ'}
                    </button>
                  )}
                </td>
                <td className="p-4 text-right font-mono font-bold text-slate-200">{Number(l.amount).toLocaleString()} đ</td>
                <td className="whitespace-nowrap p-4 text-center">
                  <div className="flex flex-nowrap items-center justify-center gap-2">
                    {isReimbursement ? (
                      isOwnReimbursement ? (
                        <span className="text-[11px] text-slate-500">Không tự duyệt</span>
                      ) : l.reimbursement_status === 'SUBMITTED' ? (
                        <>
                          <button type="button" disabled={!reimbursementCapabilities.canApprove || reimbursementBusy} onClick={() => onTransitionReimbursement(l, 'APPROVED')} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-emerald-700 bg-emerald-950 px-3 py-2 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40"><Check className="h-3.5 w-3.5" /> Duyệt</button>
                          <button type="button" disabled={!reimbursementCapabilities.canApprove || reimbursementBusy} onClick={() => onTransitionReimbursement(l, 'REJECTED')} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-red-800 bg-red-950 px-3 py-2 text-[11px] font-bold text-red-300 transition hover:bg-red-900 disabled:cursor-not-allowed disabled:opacity-40"><X className="h-3.5 w-3.5" /> Từ chối</button>
                        </>
                      ) : l.reimbursement_status === 'APPROVED' ? (
                        <>
                          <button type="button" disabled={!reimbursementCapabilities.canPay || reimbursementBusy} onClick={() => onGenerateQr(l)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-800 bg-cyan-950 px-3 py-2 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-40"><QrCode className="h-3.5 w-3.5" /> Mã QR</button>
                          <button type="button" disabled={!reimbursementCapabilities.canPay || reimbursementBusy} onClick={() => onTransitionReimbursement(l, 'PAID')} className="whitespace-nowrap rounded-lg border border-emerald-700 bg-emerald-950 px-3 py-2 text-[11px] font-bold text-emerald-300 transition hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-40">Xác nhận đã trả</button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500">Đã hoàn tất</span>
                      )
                    ) : isOrphanedCounterEntry ? (
                      <span className="flex items-center justify-center gap-1 text-[11px] italic text-slate-500 select-none">
                        <Lock className="h-3 w-3 text-slate-600" /> Tự động
                      </span>
                    ) : (
                      <>
                        {!l.is_paid && (
                          <button type="button" onClick={() => onGenerateQr(l)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-cyan-800 bg-cyan-950 px-3 py-2 text-[11px] font-bold text-cyan-300 transition hover:bg-cyan-900"><QrCode className="h-3.5 w-3.5"/> Mã QR</button>
                        )}
                        <button type="button" onClick={() => onOpenEdit(l)} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-blue-800 bg-blue-950 px-3 py-2 text-[11px] font-bold text-blue-300 transition hover:bg-blue-900"><Edit2 className="h-3.5 w-3.5"/> Chỉnh sửa</button>
                      </>
                    )}
                  </div>
                </td>
              </tr>

              {/* === DÒNG SỔ RA (BẢN GHI ĐỐI ỨNG) === */}
              {hasChild && isExpanded && (
                <tr className="bg-[#0b0f19]/80 border-l-[3px] border-l-blue-500 relative shadow-inner">
                  <td className="relative p-4 pl-14 font-bold text-slate-400">
                    <div className="absolute bottom-1/2 left-[26px] top-0 w-4 rounded-bl-lg border-b-2 border-l-2 border-slate-700"></div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="z-10 h-3 w-3 text-slate-500" />
                      <div className="min-w-0">
                        <p className="break-words leading-5 text-slate-300">{getDisplayCategory(child)}</p>
                        <span className="mt-1 inline-flex rounded border border-slate-700 bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-semibold">{getTypeBadge(child)}</span>
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-slate-500">{child.requested_by}</td>
                  <td className="p-4 text-slate-600">Không áp dụng</td>
                  <td className="p-4 opacity-50 pointer-events-none">
                    <button className="whitespace-nowrap rounded border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1.5 text-[10px] font-black text-emerald-400">Đã trả</button>
                  </td>
                  <td className="p-4 text-right font-mono font-bold text-slate-500">{Number(child.amount).toLocaleString()} đ</td>
                  <td className="p-4 text-center">
                    <span className="text-slate-500 text-[10px] italic">Hệ thống tự ghi nhận</span>
                  </td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </table>
    </div>
  );
}
