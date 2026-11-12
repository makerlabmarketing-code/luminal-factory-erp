'use client';
import { CONFIRM_PAID_LABEL } from '../../../../lib/financeExpenseWorkflow';
import { SALARY_EMAIL_LABELS, isSalaryLedger } from '@/lib/salary-payment';
import { isLinkedPayrollLedger, isZeroPayrollObligation } from '@/lib/payroll-ledger-link';
import { CommonTable, TableRowActions } from '@/component/data-table/CommonTable';
import { Fragment, useState } from 'react';
import { Check, Edit2, QrCode, Lock, ChevronDown, ChevronRight, X, ArrowDownLeft, ArrowUpRight, RefreshCcw } from 'lucide-react';
import type { FinancialLedgerEntry, PersonalAdvance } from '@/lib/types/finance';

type LedgerRow = FinancialLedgerEntry & { linkedChild?: FinancialLedgerEntry | null };

interface LedgerTableProps {
  salaryMailEnabled: boolean;
  personalAdvances?: PersonalAdvance[] | null;
  onChangeSource?: (row: LedgerRow) => void;
  onRetrySalaryEmail: (id: number | string) => void;
  activityEnabled: boolean;
  canUpdate: boolean;
  canManageTestRecords: boolean;
  onTestArchive: (item: LedgerRow) => void;
  onHistory: (item: LedgerRow) => void;
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

export function LedgerTableHeader() {
  return (
    <thead>
      <tr>
        <th scope="col" className="w-[27%]">Khoản mục</th>
        <th scope="col" className="w-[14%]">Người thực hiện</th>
        <th scope="col" className="w-[14%]">Người hưởng lợi</th>
        <th scope="col" className="w-[13%]">Trạng thái quỹ</th>
        <th scope="col" className="w-[10%] text-right">Số tiền</th>
        <th scope="col" className="w-[22%] text-right">Thao tác</th>
      </tr>
    </thead>
  );
}

const badgeTone = {
  neutral: 'border-slate-600/60 bg-slate-800/50 text-slate-300',
  success: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300',
  pending: 'border-amber-500/25 bg-amber-500/10 text-amber-300',
  info: 'border-blue-500/25 bg-blue-500/10 text-blue-300',
  error: 'border-red-500/25 bg-red-500/10 text-red-300',
};

const rowAction = 'admin-button-secondary px-3';

function ledgerStatus(row: FinancialLedgerEntry): { label: string; tone: keyof typeof badgeTone } {
  if (row.cancelled_at) return { label: isLinkedPayrollLedger(row) ? 'Đã thay thế' : 'Đã xóa', tone: 'neutral' };
  if (isZeroPayrollObligation(row)) return { label: 'Không phát sinh thanh toán', tone: 'neutral' };
  if (row.type === 'HOAN_UNG') {
    switch (row.reimbursement_status) {
      case 'PAID': return { label: 'Đã thanh toán', tone: 'success' };
      case 'APPROVED': return { label: 'Đã duyệt', tone: 'info' };
      case 'REJECTED': return { label: 'Đã từ chối', tone: 'error' };
      default: return { label: 'Chờ duyệt', tone: 'pending' };
    }
  }
  const tone = row.is_paid ? 'success' : 'pending';
  if (row.type === 'VON_GOP' && row.sub_type === 'HIEN_VAT') return { label: row.is_paid ? 'Đã ghi nhận' : 'Chờ ghi nhận', tone };
  if (row.source_type === 'MONTHLY_CAPITAL' || row.type === 'VON_GOP' || row.type === 'DOANH_THU') {
    return { label: row.is_paid ? 'Đã thu' : 'Chờ thu', tone };
  }
  return { label: row.is_paid ? 'Đã trả' : isLinkedPayrollLedger(row) ? 'Chưa trả' : 'Treo nợ', tone };
}

function LedgerStatusBadge({ row }: { row: FinancialLedgerEntry }) {
  const { label, tone } = ledgerStatus(row);
  return <span className={`admin-badge whitespace-nowrap ${badgeTone[tone]}`}>{label}</span>;
}

export default function LedgerTable({
  data,
  salaryMailEnabled, personalAdvances, onChangeSource, onRetrySalaryEmail,
  activityEnabled, canUpdate, onHistory, canManageTestRecords, onTestArchive,
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
    <CommonTable className="min-w-[980px]">
      <LedgerTableHeader />
      <tbody>
        {data.map((l) => {
          // Lấy bản ghi con từ thuộc tính linkedChild (đã được page.tsx gán vào)
          const child = l.linkedChild;
          const hasChild = !!child;
          const isExpanded = expandedRows.has(l.id);

          const isOrphanedCounterEntry = l.type === 'VON_GOP' && /^\[(Đối ứng|Hủy đối ứng)\]/.test(l.category || '');
          const isReimbursement = l.type === 'HOAN_UNG';
          const monthlyCapital = l.source_type === 'MONTHLY_CAPITAL';
          const linkedPayroll = isLinkedPayrollLedger(l);
          const personalAdvance = personalAdvances?.find(item => String(item.ledger_id) === String(l.id));
          const generatedAdvance = l.source_type === 'PERSONAL_ADVANCE' || l.source_type === 'PERSONAL_ADVANCE_REFUND';
          const zeroPayroll = isZeroPayrollObligation(l);
          const isOwnReimbursement = String(l.reimbursement_requester_employee_id) === reimbursementCapabilities.currentEmployeeId;
          const reimbursementBusy = String(activeReimbursementActionId) === String(l.id);
          const canTogglePaid = !l.cancelled_at && !isReimbursement && !generatedAdvance && !isOrphanedCounterEntry && !zeroPayroll && canUpdate
            && (!linkedPayroll || (salaryMailEnabled && reimbursementCapabilities.canPay))
            && (!salaryMailEnabled || !isSalaryLedger(l) || reimbursementCapabilities.canPay)
            && (!l.is_paid || (!activityEnabled && !monthlyCapital));
          const isIncome = monthlyCapital || l.type === 'VON_GOP' || l.type === 'DOANH_THU';
          const isInKind = l.type === 'VON_GOP' && l.sub_type === 'HIEN_VAT';
          const paymentAction = l.is_paid ? 'Đánh dấu chưa tất toán' : isInKind ? 'Xác nhận ghi nhận vốn' : isIncome ? 'Xác nhận đã thu' : CONFIRM_PAID_LABEL;
          const childRowId = `ledger-counter-${l.id}`;

          return (
            <Fragment key={l.id}>
              <tr className={l.cancelled_at || isExpanded ? 'bg-slate-950/35' : undefined}>
                <td>
                  <p className="break-words font-semibold leading-5 text-slate-100">{getDisplayCategory(l)}</p>
                  {personalAdvance && <p className="mt-1 text-[11px] text-amber-300">{personalAdvance.person} ứng trước</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className={`admin-badge ${badgeTone.neutral}`}>{getTypeBadge(l)}</span>
                    {Boolean(l.attachments?.length) && (
                      <span className={`admin-badge whitespace-nowrap ${badgeTone.neutral}`}>{l.attachments?.length} chứng từ</span>
                    )}
                    {hasChild && (
                      <button type="button" aria-expanded={isExpanded} aria-controls={isExpanded ? childRowId : undefined}
                        onClick={() => toggleRow(l.id)} className="ledger-counter-toggle inline-flex items-center gap-1 whitespace-nowrap rounded px-1.5 font-medium text-blue-300 hover:bg-blue-500/10 hover:text-blue-200">
                        {isExpanded ? <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /> : <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />}
                        Vốn kèm
                      </button>
                    )}
                  </div>
                </td>
                <td className="max-w-[180px] break-words p-4 text-slate-400">{monthlyCapital && <span className="block">Người góp: {l.payer_name || l.requested_by || 'Chưa xác định'}</span>}{!monthlyCapital && !l.payroll_settler_name && !l.approver_name && !l.payment_confirmer_name && 'Chưa ghi nhận'}{l.payroll_settler_name && <span className="mt-1 block text-[10px]">Chốt lương: {l.payroll_settler_name}</span>}{l.approver_name && <span className="mt-1 block text-[10px]">Duyệt: {l.approver_name}</span>}{l.payment_confirmer_name && <span className="mt-1 block text-[10px]">{monthlyCapital ? 'Xác nhận thu' : 'Thanh toán'}: {l.payment_confirmer_name}</span>}</td>
                <td className="max-w-[180px] break-words p-4 text-slate-300">{monthlyCapital ? 'Quỹ chung' : l.beneficiary_name || 'Chưa xác định'}</td>
                <td>
                  <LedgerStatusBadge row={l} />
                  {l.salaryEmailStatus && <p className="mt-1 text-[10px] text-slate-400">{SALARY_EMAIL_LABELS[l.salaryEmailStatus]}</p>}
                </td>
                <td className="whitespace-nowrap text-right font-semibold tabular-nums text-slate-100">{Number(l.amount).toLocaleString('vi-VN')} đ</td>
                <td>
                  <TableRowActions renderActions={function renderRowActions() { return <>
                    {personalAdvances && canUpdate && linkedPayroll && l.is_paid && !l.cancelled_at && !Number(personalAdvance?.refunded) &&
                      <button type="button" className={rowAction} onClick={() => onChangeSource?.(l)}>Đổi nguồn chi</button>}
                    {generatedAdvance ? null : l.cancelled_at ? (canManageTestRecords && isReimbursement && !l.source_type && !l.source_reference ? <button type="button" onClick={() => onTestArchive(l)} className={rowAction}><RefreshCcw className="h-3.5 w-3.5" />Khôi phục</button> : null) : isReimbursement ? (
                      l.reimbursement_status === 'PAID' && activityEnabled && canUpdate ? (
                        <button type="button" onClick={()=>onOpenEdit(l)} className={rowAction}>Điều chỉnh</button>
                      ) : isOwnReimbursement ? (
                        <span className="text-[11px] text-slate-500">Không tự duyệt</span>
                      ) : l.reimbursement_status === 'SUBMITTED' ? (
                        <>
                          <button type="button" disabled={!reimbursementCapabilities.canApprove || reimbursementBusy} onClick={() => onTransitionReimbursement(l, 'APPROVED')} className={rowAction}><Check className="h-3.5 w-3.5" /> Duyệt</button>
                          <button type="button" disabled={!reimbursementCapabilities.canApprove || reimbursementBusy} onClick={() => onTransitionReimbursement(l, 'REJECTED')} className={`${rowAction} text-red-300`}><X className="h-3.5 w-3.5" /> Từ chối</button>
                        </>
                      ) : l.reimbursement_status === 'APPROVED' ? (
                        <>
                          <button type="button" disabled={!reimbursementCapabilities.canPay || reimbursementBusy} onClick={() => onGenerateQr(l)} className={rowAction}><QrCode className="h-3.5 w-3.5" /> Mã QR</button>
                          <button type="button" disabled={!reimbursementCapabilities.canPay || reimbursementBusy} onClick={() => onTransitionReimbursement(l, 'PAID')} className={rowAction}>{CONFIRM_PAID_LABEL}</button>
                        </>
                      ) : (
                        <span className="text-[11px] text-slate-500">Đã hoàn tất</span>
                      )
                    ) : zeroPayroll ? <span className="text-slate-500">Không cần trả tiền</span> : isOrphanedCounterEntry ? (
                      <span className="flex items-center justify-end gap-1 text-[11px] text-slate-400">
                        <Lock className="h-3 w-3 text-slate-600" /> Tự động
                      </span>
                    ) : (
                      <>
                        {monthlyCapital && canTogglePaid && (
                          <button type="button" onClick={() => onTogglePaid(l.id, false)} className={rowAction}>{paymentAction}</button>
                        )}
                        {!linkedPayroll && <button type="button" disabled={!canUpdate} onClick={() => onOpenEdit(l)} className={rowAction}><Edit2 className="h-3.5 w-3.5"/> Chỉnh sửa</button>}
                        {!l.is_paid && !zeroPayroll && (
                          <button type="button" onClick={() => onGenerateQr(l)} className={rowAction}><QrCode className="h-3.5 w-3.5"/> Mã QR</button>
                        )}
                      </>
                    )}
                    {!monthlyCapital && canTogglePaid && (
                      <button type="button" className={rowAction} onClick={() => onTogglePaid(l.id, Boolean(l.is_paid))}>{paymentAction}</button>
                    )}
                    {salaryMailEnabled && canUpdate && reimbursementCapabilities.canPay && (l.salaryEmailStatus === 'PENDING' || l.salaryEmailStatus === 'BLOCKED') && <button type="button" onClick={() => onRetrySalaryEmail(l.id)} className={rowAction}>Thử gửi email</button>}
                    {canManageTestRecords && !l.cancelled_at && isReimbursement && !l.source_type && !l.source_reference && <button type="button" onClick={()=>onTestArchive(l)} className={rowAction}>Xóa bản ghi thử</button>}
                    <button type="button" onClick={()=>onHistory(l)} className={rowAction}>Lịch sử</button>
                  </>; }} />
                </td>
              </tr>

              {child && isExpanded && (
                <tr id={childRowId} className="bg-slate-950/35 text-slate-400">
                  <td>
                    <div className="ml-1 border-l-2 border-slate-600 pl-3">
                      <p className="break-words font-medium leading-5 text-slate-200">{getDisplayCategory(child)}</p>
                      <span className={`admin-badge mt-1 ${badgeTone.neutral}`}>{getTypeBadge(child)}</span>
                    </div>
                  </td>
                  <td>Hệ thống</td>
                  <td>Không áp dụng</td>
                  <td><LedgerStatusBadge row={child} /></td>
                  <td className="whitespace-nowrap text-right font-semibold tabular-nums">{Number(child.amount).toLocaleString('vi-VN')} đ</td>
                  <td className="text-right text-[11px]">Hệ thống tự ghi nhận</td>
                </tr>
              )}
            </Fragment>
          );
        })}
      </tbody>
    </CommonTable>
    </div>
  );
}
