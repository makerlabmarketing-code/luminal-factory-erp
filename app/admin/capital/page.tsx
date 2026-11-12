// app/admin/capital/page.tsx
'use client';

import { CommonTable, TableLoadingRows } from '@/component/data-table/CommonTable';
import { isSalaryLedger, normalizeSalaryMonth } from '@/lib/salary-payment';
import { payrollMonthFromLedgerPeriod, isLinkedPayrollLedger } from '@/lib/payroll-ledger-link';
import { retrySalaryLedgerEmail } from '@/services/adminFinancialLedgerService';
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import AdminSidePanel from '@/component/AdminSidePanel';
import ActivityHistoryDialog from '@/component/ActivityHistoryDialog';
import { validateCorrectionReason } from '@/lib/activity-history';
import { supabase } from '@/utils/supabase/client';
import { useNotification } from '@/component/NotificationContext';
import { useGlobalLoading } from '@/component/GlobalLoading';
import MonthPicker from '@/component/MonthPicker';
import LedgerMetrics from './components/LedgerMetrics';
import LedgerTable, { LedgerTableHeader } from './components/LedgerTable';
import { TestLedgerDialog } from './TestLedgerDialog';
import CapitalShareCard from './components/CapitalShareCard';
import MonthlyCapitalSettings from './components/MonthlyCapitalSettings';
import PersonalAdvancesCard from './components/PersonalAdvancesCard';
import type { AdminLedgerMutationInput, ExpensePaymentSourceOption, FinanceAttachment, FinancialLedgerEntry, PersonalAdvance, ShareholderPaymentSourceRow } from '@/lib/types/finance';
import {
  CONFIRM_PAID_LABEL,
  FINANCE_ATTACHMENT_POLICY,
  MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE,
  buildBeneficiaryVietQrUrl,
  validateFinanceAttachment,
} from '@/lib/financeExpenseWorkflow';
import {
  DEFAULT_CAPITAL_CONTRIBUTION_TYPES,
  DEFAULT_FINANCIAL_TRANSACTION_TYPES,
  type SystemMetadataOption,
} from '@/lib/system-metadata-defaults';
import {
  isValidReportingPeriod,
  monthInputFromReportingPeriod,
  reportingPeriodFromMonthInput,
  summarizeFinancialLedger,
} from '@/services/financialReportingService';
import {
  createAdminFinancialLedger,
  loadAdminFinancialLedger,
  mutatePersonalAdvance,
  removeAdminLedgerAttachment,
  replaceAdminLedgerAttachment,
  setAdminFinancialLedgerPaid,
  transitionAdminReimbursement,
  updateAdminFinancialLedger,
  uploadAdminLedgerAttachment,
} from '@/services/adminFinancialLedgerService';
import {
  PiggyBank, Plus, X, ChevronsLeft, ChevronsRight, ChevronLeft, ChevronRight
} from 'lucide-react';

const formatCurrency = (value: string) => {
  if (!value) return '';
  const onlyNumbers = value.replace(/[^0-9]/g, '');
  return onlyNumbers.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

const parseCurrency = (value: string) => {
  if (!value) return 0;
  return Number(value.replace(/,/g, ''));
};

const COMMON_FUND_SOURCE_ID = 'QUY_CHUNG';
const SELF_PAID_SOURCE_PREFIX = 'SHAREHOLDER:';
const DEFAULT_COMPANY_PAYER_NAME = 'Hà';

interface EmployeeOption {
  id: number | string;
  full_name: string;
  bank_name?: string | null;
  bank_account_number?: string | null;
}

function toShareholderPaymentSourceOption(
  row: ShareholderPaymentSourceRow
): ExpensePaymentSourceOption | null {
  const label = row.name?.trim();
  if (!label) return null;

  return {
    id: `${SELF_PAID_SOURCE_PREFIX}${row.id}`,
    label,
    kind: 'SHAREHOLDER',
    reporterName: label,
    isActive: row.status === 'ACTIVE',
  };
}

function getExpensePaymentSourceOptions(
  shareholderRows: ShareholderPaymentSourceRow[]
): ExpensePaymentSourceOption[] {
  return [
    {
      id: COMMON_FUND_SOURCE_ID,
      label: 'Chi từ quỹ tiền mặt chung của xưởng',
      kind: 'COMMON_FUND',
      reporterName: null,
      isActive: true,
    },
    ...shareholderRows
      .map(toShareholderPaymentSourceOption)
      .filter((option): option is ExpensePaymentSourceOption => option !== null),
  ];
}

function findPaymentSourceOption(
  options: ExpensePaymentSourceOption[],
  selectedId: string
): ExpensePaymentSourceOption | null {
  return options.find((option) => option.id === selectedId) || null;
}

function isSelfPaidSource(option: ExpensePaymentSourceOption | null): boolean {
  return option?.kind === 'SHAREHOLDER';
}

function LedgerSkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg border border-slate-800 bg-slate-900 ${className}`} />;
}

function LedgerLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LedgerSkeletonBlock className="h-28" />
        <LedgerSkeletonBlock className="h-28" />
        <LedgerSkeletonBlock className="h-28" />
        <LedgerSkeletonBlock className="h-28" />
      </div>
      <LedgerSkeletonBlock className="h-40" />
      <section className="admin-table-shell">
        <h2 className="border-b border-slate-800 px-5 py-4 text-sm font-semibold">Nhật ký thu chi</h2>
        <LedgerTableLoadingState />
      </section>
    </div>
  );
}

function LedgerTableLoadingState() {
  return (
    <div className="overflow-x-auto">
      <CommonTable aria-busy="true" className="min-w-[980px] w-full">
        <LedgerTableHeader />
        <tbody><TableLoadingRows columns={6} /></tbody>
      </CommonTable>
    </div>
  );
}

export default function AdminFinancialLedger() {
  const { showToast } = useNotification();
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [salaryMailEnabled, setSalaryMailEnabled] = useState(false);
  const [personalAdvances, setPersonalAdvances] = useState<PersonalAdvance[] | null>(null);
  const [advanceSource, setAdvanceSource] = useState('');
  const [sourceTarget, setSourceTarget] = useState<FinancialLedgerEntry | null>(null);
  const [refundTarget, setRefundTarget] = useState<{ row: PersonalAdvance; requestId: string } | null>(null);
  const [refundAmount, setRefundAmount] = useState('');
  const [advanceBusy, setAdvanceBusy] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [ledger, setLedger] = useState<FinancialLedgerEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<SystemMetadataOption[]>(() => [...DEFAULT_FINANCIAL_TRANSACTION_TYPES]);
  const [contributionTypes, setContributionTypes] = useState<SystemMetadataOption[]>(() => [...DEFAULT_CAPITAL_CONTRIBUTION_TYPES]);
  const [expensePaymentSources, setExpensePaymentSources] = useState<ExpensePaymentSourceOption[]>([]);
  const [expenseSourcesError, setExpenseSourcesError] = useState('');
  const [companyBankCode, setCompanyBankCode] = useState<string>('MB');
  const [companyBankAccount, setCompanyBankAccount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [hasLoadedData, setHasLoadedData] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const pendingCreatedLedgerId = useRef<number | string | null>(null);
  const createIdempotencyKey = useRef(crypto.randomUUID());
  const [extendedSchemaEnabled, setExtendedSchemaEnabled] = useState(false);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: number | string; name: string }>>([]);
  const [reimbursementCapabilities, setReimbursementCapabilities] = useState({ currentEmployeeId: '', canApprove: false, canPay: false });
  const [activeReimbursementActionId, setActiveReimbursementActionId] = useState<number | string | null>(null);
  const reimbursementActionLock = useRef(false);

  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const selectedMonth = reportingPeriodFromMonthInput(monthInput);
  useEffect(() => {
    const payrollMonth = new URLSearchParams(window.location.search).get('month');
    if (payrollMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(payrollMonth)) setMonthInput(payrollMonth);
  }, []);

  const [showAddModal, setShowAddModal] = useState(false);

  // Form States Thêm Mới
  const [type, setType] = useState('CHI_PHI');
  const [subType, setSubType] = useState<'TIEN_MAT' | 'HIEN_VAT'>('TIEN_MAT');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [reporter, setReporter] = useState('');
  const [beneficiaryEmployeeId, setBeneficiaryEmployeeId] = useState('');
  const [beneficiaryExternalName, setBeneficiaryExternalName] = useState('');
  const [transactionDate, setTransactionDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [projectId, setProjectId] = useState('');
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [isPaid, setIsPaid] = useState(true);
  const [formMonthInput, setFormMonthInput] = useState(monthInput);
  const [expenseSource, setExpenseSource] = useState<string>('QUY_CHUNG');

  // Edit States Chỉnh Sửa
  const [showEditModal, setShowEditModal] = useState(false);
  const [activityEnabled, setActivityEnabled] = useState(false);
  const [canUpdateLedger, setCanUpdateLedger] = useState(false);
  const [canManageTestRecords,setCanManageTestRecords]=useState(false);
  const [showDeleted,setShowDeleted]=useState(false);
  const [testRecord,setTestRecord]=useState<FinancialLedgerEntry|null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null);
  const [editCorrectionReason, setEditCorrectionReason] = useState('');
  const [editingPaid, setEditingPaid] = useState(false);
  const [editingReimbursement, setEditingReimbursement] = useState(false);
  useEffect(() => { const linkedId = new URLSearchParams(window.location.search).get('ledgerId'); if (linkedId && /^[1-9]\d{0,18}$/.test(linkedId)) setHistoryId(linkedId); }, []);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editType, setEditType] = useState('CHI_PHI');
  const [editSubType, setEditSubType] = useState<'TIEN_MAT' | 'HIEN_VAT'>('TIEN_MAT');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editReporter, setEditReporter] = useState('');
  const [editBeneficiaryEmployeeId, setEditBeneficiaryEmployeeId] = useState('');
  const [editBeneficiaryExternalName, setEditBeneficiaryExternalName] = useState('');
  const [editTransactionDate, setEditTransactionDate] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editProjectId, setEditProjectId] = useState('');
  const [editPendingFiles, setEditPendingFiles] = useState<File[]>([]);
  const [editAttachments, setEditAttachments] = useState<FinanceAttachment[]>([]);
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editMonthInput, setEditMonthInput] = useState(monthInput);
  const [editExpenseSource, setEditExpenseSource] = useState<string>('QUY_CHUNG');
  const [editError, setEditError] = useState<{ message: string; correlationId: string } | null>(null);
  const attachmentActionLock = useRef(false);
  const paymentActionLock = useRef(false);
  const [attachmentActionId, setAttachmentActionId] = useState<number | string | null>(null);

  // VietQR States
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState('');
  const [activeQrTarget, setActiveQrTarget] = useState<{
    id: number | string;
    title: string;
    bankName: string;
    accountNo: string;
    amount: number;
    category: string;
    type: string;
  } | null>(null);

  // Pagination & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);

  const applyLedgerResult = useCallback((ledgerResult: Awaited<ReturnType<typeof loadAdminFinancialLedger>>) => {
    setLedger(ledgerResult.ledger);
    setExpensePaymentSources(getExpensePaymentSourceOptions(ledgerResult.paymentSourceRows ?? []));
    setExpenseSourcesError(ledgerResult.paymentSourceRows === null ? 'Không tải được danh sách nguồn chi cá nhân.' : '');
    setPersonalAdvances(ledgerResult.personalAdvances);
    setSalaryMailEnabled(ledgerResult.salaryPaymentEmailEnabled);
    setActivityEnabled(ledgerResult.activityHistoryEnabled);
    setCanUpdateLedger(ledgerResult.canUpdate);
    setCanManageTestRecords(Boolean(ledgerResult.canManageTestRecords));
    setExtendedSchemaEnabled(ledgerResult.extendedSchemaEnabled);
    setAttachmentsEnabled(ledgerResult.attachmentsEnabled);
    setProjects(ledgerResult.projects);
    setReimbursementCapabilities(ledgerResult.reimbursementCapabilities);
    setCompanyBankCode(ledgerResult.companyBankCode || 'MB');
    setCompanyBankAccount(ledgerResult.companyBankAccount || '');
    setTransactionTypes(ledgerResult.transactionTypes);
    setContributionTypes(ledgerResult.contributionTypes);
    setHasLoadedData(true);
  }, []);

  const refreshLedger = useCallback(async () => {
    applyLedgerResult(await loadAdminFinancialLedger(selectedMonth));
  }, [applyLedgerResult, selectedMonth]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [
        { data: emps, error: employeesError },
        ledgerResult,
      ] = await Promise.all([
        supabase.from('employees').select('id, full_name, bank_name, bank_account_number'),
        loadAdminFinancialLedger(selectedMonth),
      ]);

      if (employeesError) throw employeesError;
      setEmployees(emps || []);
      if (emps && emps.length > 0) {
        const defaultPayer = emps.find((employee) => employee.full_name?.trim() === DEFAULT_COMPANY_PAYER_NAME) || emps[0];
        setReporter((current) => current || String(defaultPayer.id));
      }

      setType((current) => ledgerResult.transactionTypes.some((option) => option.code === current)
        ? current
        : ledgerResult.transactionTypes[0]?.code || 'CHI_PHI');

      setSubType((current) => ledgerResult.contributionTypes.some((option) => option.code === current)
        ? current
        : (ledgerResult.contributionTypes[0]?.code as 'TIEN_MAT' | 'HIEN_VAT' | undefined) || 'TIEN_MAT');

      applyLedgerResult(ledgerResult);
    } catch (e) {
      console.error(e);
      setLoadError('Không tải được dữ liệu.');
      showToast('Không tải được sổ thu chi', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  }, [applyLedgerResult, selectedMonth, showToast]);

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [loadData]);

  useEffect(() => {
    setFormMonthInput(monthInput);
  }, [monthInput]);

  // Tìm kiếm dữ liệu
  const filteredLedger = ledger.filter(l => showDeleted ? Boolean(l.cancelled_at) : !l.cancelled_at).filter(l =>
    (l.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.requested_by || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.payer_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.beneficiary_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  // --- MỚI: THUẬT TOÁN GOM NHÓM DATA TRƯỚC KHI PHÂN TRANG ---
  const mainRecords: Array<FinancialLedgerEntry & { linkedChild?: FinancialLedgerEntry | null }> = [];
  const potentialChildren = filteredLedger.filter(l => l.type === 'VON_GOP' && l.category?.startsWith('[Đối ứng]'));
  const remainingChildren = [...potentialChildren];

  filteredLedger.forEach(l => {
    // Bỏ qua dòng con
    if (l.type === 'VON_GOP' && l.category?.startsWith('[Đối ứng]')) return;

    // Tìm đối ứng cho dòng hiện tại
    const cIndex = remainingChildren.findIndex(
      c => c.category === `[Đối ứng] Vốn hiện vật: ${l.category}` && c.requested_by === l.requested_by
    );

    let linkedChild = null;
    if (cIndex > -1) {
      linkedChild = remainingChildren[cIndex];
      remainingChildren.splice(cIndex, 1);
    }

    mainRecords.push({ ...l, linkedChild }); // Nhúng luôn data con vào data cha
  });

  // Gom nốt các bản ghi đối ứng mồ côi (nếu không tìm thấy cha)
  const finalGroupedData = [...mainRecords, ...remainingChildren];

  // --- PHÂN TRANG TRÊN DỮ LIỆU ĐÃ ĐƯỢC GOM NHÓM ---
  const totalPages = Math.ceil(finalGroupedData.length / itemsPerPage) || 1;
  const currentLedgerData = finalGroupedData.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const validateSelectedFiles = (files: File[], existingCount = 0): string | null => {
    if (files.length + existingCount > FINANCE_ATTACHMENT_POLICY.maxCount) return `Mỗi giao dịch tối đa ${FINANCE_ATTACHMENT_POLICY.maxCount} chứng từ.`;
    const unique = new Set<string>();
    for (const file of files) {
      const error = validateFinanceAttachment(file);
      if (error) return error;
      const key = `${file.name}:${file.size}:${file.lastModified}`;
      if (unique.has(key)) return 'Danh sách có chứng từ bị trùng.';
      unique.add(key);
    }
    return null;
  };

  const mutationInput = (values: {
    type: string; subType: string; category: string; amount: string; monthInput: string;
    reporterId: string; beneficiaryEmployeeId: string; beneficiaryExternalName: string;
    transactionDate: string; description: string; projectId: string; isPaid: boolean; expenseSource: string;
  }): AdminLedgerMutationInput | null => {
    const numericAmount = parseCurrency(values.amount);
    const targetPeriod = reportingPeriodFromMonthInput(values.monthInput);
    if (!values.category.trim()) {
      showToast('Thiếu khoản mục', 'Vui lòng nhập nội dung giao dịch.', 'error');
      return null;
    }
    if (!numericAmount) {
      showToast('Số tiền không hợp lệ', 'Số tiền phải lớn hơn 0.', 'error');
      return null;
    }
    if (!isValidReportingPeriod(targetPeriod)) {
      showToast('Kỳ báo cáo không hợp lệ', 'Vui lòng chọn kỳ báo cáo hợp lệ.', 'error');
      return null;
    }
    if (extendedSchemaEnabled && ['CHI_PHI', 'CHI_TIEU', 'HOAN_UNG'].includes(values.type) && !values.beneficiaryEmployeeId && !values.beneficiaryExternalName.trim()) {
      showToast('Thiếu Người hưởng lợi', 'Vui lòng chọn nhân sự hoặc nhập Người hưởng lợi bên ngoài.', 'error');
      return null;
    }
    if (values.beneficiaryEmployeeId && values.beneficiaryExternalName.trim()) {
      showToast('Người hưởng lợi chưa hợp lệ', 'Chỉ chọn nhân sự hoặc nhập người bên ngoài.', 'error');
      return null;
    }
    const selectedSource = findPaymentSourceOption(expensePaymentSources, values.expenseSource);
    const payer = employees.find((employee) => String(employee.id) === values.reporterId);
    return {
      type: values.type,
      subType: values.type === 'VON_GOP' ? values.subType : null,
      category: values.category.trim(),
      amount: numericAmount,
      monthPeriod: targetPeriod,
      transactionDate: extendedSchemaEnabled ? values.transactionDate || null : null,
      description: extendedSchemaEnabled ? values.description.trim() || null : null,
      projectId: extendedSchemaEnabled ? values.projectId || null : null,
      beneficiaryEmployeeId: values.beneficiaryEmployeeId || null,
      beneficiaryExternalName: values.beneficiaryExternalName.trim() || null,
      payerEmployeeId: selectedSource?.kind === 'SHAREHOLDER' ? null : values.reporterId || null,
      requestedBy: selectedSource?.reporterName || payer?.full_name || null,
      isPaid: values.type === 'CHI_PHI' && isSelfPaidSource(selectedSource) ? true : values.isPaid,
      expenseSourceId: values.expenseSource,
      idempotencyKey: crypto.randomUUID(),
    };
  };

  const handleInsertLedger = async () => {
    if (submitLock.current) return;
    const fileError = validateSelectedFiles(pendingFiles);
    if (fileError) return showToast('Chứng từ chưa hợp lệ', fileError, 'error');
    if (pendingFiles.length > 0 && !attachmentsEnabled) return showToast('Kho chứng từ chưa sẵn sàng', 'Vui lòng chờ kho riêng tư được kiểm tra và kích hoạt.', 'error');
    const draftInput = mutationInput({ type, subType, category, amount, monthInput: formMonthInput, reporterId: reporter, beneficiaryEmployeeId, beneficiaryExternalName, transactionDate, description, projectId, isPaid, expenseSource });
    const input = draftInput ? { ...draftInput, idempotencyKey: createIdempotencyKey.current } : null;
    if (!input) return;
    submitLock.current = true;
    setIsSubmitting(true);
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      const existingLedgerId = pendingCreatedLedgerId.current;
      const ledgerId = existingLedgerId || await createAdminFinancialLedger(input);
      pendingCreatedLedgerId.current = ledgerId;
      if (existingLedgerId) {
        await updateAdminFinancialLedger(ledgerId, input);
      }
      for (let index = 0; index < pendingFiles.length; index += 1) {
        await uploadAdminLedgerAttachment(ledgerId, pendingFiles[index]);
        setPendingFiles(pendingFiles.slice(index + 1));
      }
      pendingCreatedLedgerId.current = null;
      createIdempotencyKey.current = crypto.randomUUID();
      setCategory(''); setAmount(''); setExpenseSource(COMMON_FUND_SOURCE_ID); setSubType('TIEN_MAT');
      setBeneficiaryEmployeeId(''); setBeneficiaryExternalName(''); setDescription(''); setProjectId(''); setPendingFiles([]);
      if (input.monthPeriod === selectedMonth) await refreshLedger();
      else setMonthInput(formMonthInput);
      setShowAddModal(false);
      showToast('Ghi sổ thành công', 'Giao dịch và chứng từ đã được lưu.', 'success');
    } catch (error) {
      const retryNote = pendingCreatedLedgerId.current ? ' Giao dịch đã được giữ; hãy thử lại để hoàn tất chứng từ, hệ thống sẽ không tạo dòng trùng.' : '';
      showToast('Không thể ghi sổ', `${error instanceof Error ? error.message : 'Dữ liệu biểu mẫu được giữ nguyên để bạn thử lại.'}${retryNote}`, 'error');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
      hideGlobalLoading();
    }
  };

  const handleOpenEdit = (item: FinancialLedgerEntry & { linkedChild?: FinancialLedgerEntry | null }) => {
    const numericId = Number(item.id);
    if (!Number.isFinite(numericId)) return;

    setEditingId(numericId);
    setEditingPaid(Boolean(item.is_paid));
    setEditingReimbursement(item.type === 'HOAN_UNG');
    setEditCorrectionReason('');
    setEditType(item.type || 'CHI_PHI');
    setEditCategory(item.category || '');
    setEditAmount(formatCurrency(String(item.amount || '')));
    setEditReporter(item.payer_employee_id == null ? '' : String(item.payer_employee_id));
    setEditBeneficiaryEmployeeId(item.beneficiary_employee_id == null ? '' : String(item.beneficiary_employee_id));
    setEditBeneficiaryExternalName(item.beneficiary_external_name || '');
    setEditTransactionDate(item.transaction_date || '');
    setEditDescription(item.description || '');
    setEditProjectId(item.project_id == null ? '' : String(item.project_id));
    setEditAttachments(item.attachments || []);
    setEditPendingFiles([]);
    setEditIsPaid(Boolean(item.is_paid));
    setEditMonthInput(monthInputFromReportingPeriod(item.month_period || selectedMonth));
    setEditSubType(item.sub_type === 'HIEN_VAT' ? 'HIEN_VAT' : 'TIEN_MAT');

    setEditExpenseSource(COMMON_FUND_SOURCE_ID);
    setEditError(null);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (submitLock.current) return;
    if (!editingId) return;
    const fileError = validateSelectedFiles(editPendingFiles, editAttachments.length);
    if (fileError) return showToast('Chứng từ chưa hợp lệ', fileError, 'error');
    if (editPendingFiles.length > 0 && !attachmentsEnabled) return showToast('Kho chứng từ chưa sẵn sàng', 'Vui lòng chờ kho riêng tư được kiểm tra và kích hoạt.', 'error');
    const input = mutationInput({ type: editType, subType: editSubType, category: editCategory, amount: editAmount, monthInput: editMonthInput, reporterId: editReporter, beneficiaryEmployeeId: editBeneficiaryEmployeeId, beneficiaryExternalName: editBeneficiaryExternalName, transactionDate: editTransactionDate, description: editDescription, projectId: editProjectId, isPaid: editIsPaid, expenseSource: editExpenseSource });
    if (!input) return;
    if (activityEnabled && editingPaid) {
      try { input.correctionReason = validateCorrectionReason(editCorrectionReason); }
      catch { return showToast('Cần lý do điều chỉnh', 'Nhập lý do từ 5 đến 500 ký tự.', 'error'); }
    }
    submitLock.current = true;
    setIsSubmitting(true);
    showGlobalLoading('Đang lưu thay đổi...');
    setEditError(null);
    const correlationId = crypto.randomUUID();
    try {
      await updateAdminFinancialLedger(editingId, input);
      for (let index = 0; index < editPendingFiles.length; index += 1) {
        await uploadAdminLedgerAttachment(editingId, editPendingFiles[index]);
        setEditPendingFiles(editPendingFiles.slice(index + 1));
      }
      setShowEditModal(false); setEditingId(null);
      if (input.monthPeriod === selectedMonth) await refreshLedger();
      else setMonthInput(editMonthInput);
      showToast('Đã cập nhật', 'Giao dịch và chứng từ đã được lưu.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu thay đổi. Dữ liệu biểu mẫu được giữ nguyên.';
      setEditError({ message, correlationId });
      showToast('Không thể cập nhật giao dịch', message, 'error');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
      hideGlobalLoading();
    }
  };

  const handleRetrySalaryEmail = async (id: number | string) => {
    if (paymentActionLock.current) return;
    paymentActionLock.current = true;
    try {
      const result = await retrySalaryLedgerEmail(id);
      showToast('Thông báo lương', result.notification.message, 'info');
      await refreshLedger();
    } catch (error) { showToast('Chưa gửi email', error instanceof Error ? error.message : 'Tải lại để kiểm tra kết quả.', 'error'); }
    finally { paymentActionLock.current = false; }
  };

  const handleTogglePaid = async (id: number | string, currentStatus: boolean) => {
    if (paymentActionLock.current) return;
    const row = ledger.find((entry) => String(entry.id) === String(id));
    if (personalAdvances && row && isLinkedPayrollLedger(row) && !currentStatus) {
      setPaymentError('');
      setAdvanceSource('');
      setSourceTarget(row);
      return;
    }
    const confirmCapitalReceipt = row?.source_type === 'MONTHLY_CAPITAL' && !currentStatus;
    if (confirmCapitalReceipt && !confirm(`Quỹ đã nhận ${Number(row.amount).toLocaleString('vi-VN')} đ góp vốn từ ${row.payer_name || row.requested_by || 'người góp'}?`)) return;

    let salaryMonth: string | undefined;
    if (salaryMailEnabled && row && isSalaryLedger(row) && !currentStatus) {
      const chosen = isLinkedPayrollLedger(row) ? payrollMonthFromLedgerPeriod(row.month_period) : prompt('Tháng lương đã chuyển tiền (MM/YYYY). Nhập đúng tháng lương, có thể khác kỳ sổ:');
      if (chosen === null) return;
      if (!normalizeSalaryMonth(chosen)) return showToast('Tháng lương không hợp lệ', 'Nhập theo MM/YYYY.', 'error');
      salaryMonth = chosen.trim();
      if (!confirm(`Xác nhận đã chuyển ${Number(row.amount).toLocaleString('vi-VN')} đồng lương tháng ${salaryMonth} cho ${row.beneficiary_name || 'Người hưởng lợi'} và gửi thông báo email?`)) return;
    }
    paymentActionLock.current = true;
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      const result = await setAdminFinancialLedgerPaid(id, !currentStatus, salaryMonth);
      setLedger(prev => prev.map(l => l.id === id ? { ...l, is_paid: !currentStatus } : l));
      showToast(confirmCapitalReceipt ? 'Đã ghi nhận thu' : 'Đã cập nhật thanh toán', result.notification?.message || (confirmCapitalReceipt ? 'Khoản góp đã được tính vào quỹ.' : 'Đã cập nhật trạng thái tất toán.'), result.notification?.status === 'BLOCKED' || result.notification?.status === 'UNKNOWN' ? 'info' : 'success');
      if (result.notification || confirmCapitalReceipt) {
        try { await refreshLedger(); }
        catch {
          showToast('Đã cập nhật', 'Chưa tải lại được sổ thu chi. Tải lại trang để xem kết quả.', 'info');
        }
      }
    } catch (error) {
      showToast('Không thể đổi trạng thái', error instanceof Error ? error.message : 'Không thể kiểm tra kết quả. Tải lại sổ trước khi thử lại.', 'error');
    } finally {
      paymentActionLock.current = false;
      hideGlobalLoading();
    }
  };

  const handleTransitionReimbursement = async (
    item: FinancialLedgerEntry,
    status: 'APPROVED' | 'REJECTED' | 'PAID',
  ) => {
    if (reimbursementActionLock.current) return;
    let reason: string | null = null;
    if (status === 'REJECTED') {
      reason = prompt('Nhập lý do từ chối (ít nhất 3 ký tự):')?.trim() || null;
      if (!reason || reason.length < 3) return showToast('Thiếu lý do', 'Vui lòng nhập lý do từ chối ít nhất 3 ký tự.', 'error');
    } else if (!confirm(status === 'APPROVED' ? 'Xác nhận duyệt phiếu hoàn ứng này?' : 'Xác nhận đã thanh toán phiếu hoàn ứng này?')) {
      return;
    }
    reimbursementActionLock.current = true;
    setActiveReimbursementActionId(item.id);
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      await transitionAdminReimbursement(item.id, status, reason);
      await refreshLedger();
      showToast('Đã cập nhật hoàn ứng', status === 'APPROVED' ? 'Phiếu đã được duyệt.' : status === 'REJECTED' ? 'Phiếu đã bị từ chối.' : 'Phiếu đã được xác nhận thanh toán.', 'success');
    } catch (error) {
      showToast('Không thể cập nhật hoàn ứng', error instanceof Error ? error.message : 'Vui lòng thử lại.', 'error');
    } finally {
      reimbursementActionLock.current = false;
      setActiveReimbursementActionId(null);
      hideGlobalLoading();
    }
  };

  const handleInstantPaymentSuccess = async () => {
    if (!activeQrTarget?.id || paymentActionLock.current) return;
    const targetId = activeQrTarget.id;
    const row = ledger.find(item => String(item.id) === String(targetId));
    const source = personalAdvances && row && isLinkedPayrollLedger(row) ? advanceSource : undefined;
    if (source === '' || (source && !isAvailableAdvanceSource)) return;
    paymentActionLock.current = true;
    setPaymentError('');
    setAdvanceBusy(true);
    try {
      if (activeQrTarget.type === 'HOAN_UNG') {
        await transitionAdminReimbursement(targetId, 'PAID');
      } else {
        const result = await setAdminFinancialLedgerPaid(targetId, true, undefined, source);
        if (result.notification) showToast('Đã ghi nhận thanh toán', result.notification.message, 'info');
      }
      closeQr();
      await refreshAfterPayment('Đã ghi nhận thanh toán');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Không thể xác nhận thanh toán.');
    } finally {
      paymentActionLock.current = false;
      setAdvanceBusy(false);
    }
  };

  const handleGenerateVietQR = (item: FinancialLedgerEntry) => {
    setPaymentError('');
    setAdvanceSource('');
    if (item.type === 'CHI_PHI' || item.type === 'CHI_TIEU' || item.type === 'HOAN_UNG') {
      const matchedBeneficiary = employees.find(e => String(e.id) === String(item.beneficiary_employee_id));
      const qrResult = buildBeneficiaryVietQrUrl({
        beneficiary: matchedBeneficiary
          ? {
              employeeId: matchedBeneficiary.id,
              fullName: matchedBeneficiary.full_name,
              bankName: matchedBeneficiary.bank_name,
              bankAccountNumber: matchedBeneficiary.bank_account_number,
            }
          : null,
        amount: item.amount || 0,
        note: item.category || '',
      });
      if (!qrResult.ok) return showToast('Thiếu thông tin nhận tiền', MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE, 'error');
      setActiveQrUrl(qrResult.url);
      setActiveQrTarget({ id: item.id, type: item.type || '', title: item.type === 'HOAN_UNG' ? 'QR thanh toán hoàn ứng' : 'QR thanh toán', bankName: matchedBeneficiary?.bank_name || '', accountNo: matchedBeneficiary?.bank_account_number || '', amount: Number(item.amount || 0), category: item.category || '' });
      setShowQrModal(true);
    } else {
      if (!companyBankAccount) return showToast('Thiếu cấu hình', 'Chưa cấu hình tài khoản công ty nhận tiền!', 'error');
      const prefix = item.type === 'DOANH_THU' ? 'Thu' : 'Gop von';
      const cleanCategory = encodeURIComponent(`${prefix}: ${item.requested_by}`);
      const qrUrl = `https://img.vietqr.io/image/${companyBankCode}-${companyBankAccount}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, type: item.type || '', title: item.type === 'DOANH_THU' ? 'QR thu tiền khách hàng' : 'QR nộp vốn vào quỹ', bankName: companyBankCode, accountNo: companyBankAccount, amount: Number(item.amount || 0), category: item.category || '' });
      setShowQrModal(true);
    }
  };

  const handleRemoveAttachment = async (attachment: FinanceAttachment) => {
    if (!editingId || String(attachment.id).startsWith('legacy:') || attachmentActionLock.current) return;
    attachmentActionLock.current = true;
    setAttachmentActionId(attachment.id);
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      const result = await removeAdminLedgerAttachment(editingId, attachment.id);
      setEditAttachments((current) => current.filter((item) => item.id !== attachment.id));
      showToast('Đã gỡ chứng từ', result.cleanupPending ? 'Chứng từ đã được gỡ; tệp cũ đang chờ dọn nền.' : 'Chứng từ không còn hiển thị trong giao dịch.', result.cleanupPending ? 'info' : 'success');
    } catch (error) {
      showToast('Không thể gỡ chứng từ', error instanceof Error ? error.message : 'Vui lòng thử lại.', 'error');
    } finally {
      attachmentActionLock.current = false;
      setAttachmentActionId(null);
      hideGlobalLoading();
    }
  };

  const handleReplaceAttachment = async (attachment: FinanceAttachment, file: File) => {
    if (!editingId || String(attachment.id).startsWith('legacy:') || attachmentActionLock.current) return;
    const validation = validateFinanceAttachment(file);
    if (validation) return showToast('Chứng từ chưa hợp lệ', validation, 'error');
    attachmentActionLock.current = true;
    setAttachmentActionId(attachment.id);
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      const replaceResult = await replaceAdminLedgerAttachment(editingId, attachment.id, file);
      const result = await loadAdminFinancialLedger(selectedMonth);
      setLedger(result.ledger);
      setAttachmentsEnabled(result.attachmentsEnabled);
      const refreshed = result.ledger.find((entry) => String(entry.id) === String(editingId));
      setEditAttachments(refreshed?.attachments || []);
      showToast('Đã thay chứng từ', replaceResult.cleanupPending ? 'Chứng từ mới đã lưu; tệp cũ đang chờ dọn nền.' : 'Chứng từ mới đã được lưu trước khi dọn tệp cũ.', replaceResult.cleanupPending ? 'info' : 'success');
    } catch (error) {
      showToast('Không thể thay chứng từ', error instanceof Error ? error.message : 'Vui lòng thử lại.', 'error');
    } finally {
      attachmentActionLock.current = false;
      setAttachmentActionId(null);
      hideGlobalLoading();
    }
  };

  const activeSources = expensePaymentSources.filter(option => option.isActive);
  const isAvailableAdvanceSource = activeSources.some(option => option.id === advanceSource);
  const currentAdvance = sourceTarget?.is_paid
    ? personalAdvances?.find(row => String(row.ledger_id) === String(sourceTarget.id))
    : undefined;
  const currentSourceId = currentAdvance ? `${SELF_PAID_SOURCE_PREFIX}${currentAdvance.shareholder_id}` : COMMON_FUND_SOURCE_ID;
  const canSaveSource = isAvailableAdvanceSource && (!sourceTarget?.is_paid || advanceSource !== currentSourceId);
  const qrNeedsSource = Boolean(personalAdvances && ledger.some(row => String(row.id) === String(activeQrTarget?.id) && isLinkedPayrollLedger(row)));

  const closeQr = () => {
    setShowQrModal(false);
    setActiveQrUrl('');
    setActiveQrTarget(null);
  };

  const closeAdvance = () => {
    setSourceTarget(null);
    setRefundTarget(null);
  };

  const refreshAfterPayment = async (title: string) => {
    try {
      await refreshLedger();
      showToast(title, 'Sổ thu chi đã cập nhật.', 'success');
    } catch {
      showToast(title, 'Tải lại trang để xem số liệu mới.', 'info');
    }
  };

  const saveAdvance = async () => {
    if (paymentActionLock.current) return;
    const amount = Number(refundAmount);
    if (refundTarget && (!Number.isSafeInteger(amount) || amount <= 0 ||
      amount > Number(refundTarget.row.advanced) - Number(refundTarget.row.refunded))) return;
    if (sourceTarget && !canSaveSource) return;
    paymentActionLock.current = true;
    setAdvanceBusy(true);
    setPaymentError('');
    try {
      if (refundTarget) {
        await mutatePersonalAdvance(refundTarget.row.ledger_id, { action: 'refundPersonalAdvance', amount, requestId: refundTarget.requestId });
      } else if (sourceTarget?.is_paid) {
        await mutatePersonalAdvance(sourceTarget.id, { action: 'changePersonalAdvanceSource', expenseSource: advanceSource });
      } else if (sourceTarget) {
        const result = await setAdminFinancialLedgerPaid(sourceTarget.id, true, undefined, advanceSource);
        if (result.notification) showToast('Thông báo lương', result.notification.message, 'info');
      }
      closeAdvance();
      await refreshAfterPayment(refundTarget ? 'Đã ghi nhận hoàn tiền' : sourceTarget?.is_paid ? 'Đã đổi nguồn chi' : 'Đã ghi nhận thanh toán');
    } catch (error) {
      setPaymentError(error instanceof Error ? error.message : 'Không thể lưu thay đổi.');
    } finally {
      paymentActionLock.current = false;
      setAdvanceBusy(false);
    }
  };

  const sourceSelector = (
    <div className="space-y-2">
      <label className="block text-sm font-semibold">
        Nguồn chi
        <select className="admin-field mt-1" required disabled={advanceBusy}
          value={isAvailableAdvanceSource ? advanceSource : ''} onChange={event => { setAdvanceSource(event.target.value); setPaymentError(''); }}>
          <option value="">Chọn nguồn chi</option>
          {activeSources.map(option => (
            <option key={option.id} value={option.id}>{option.kind === 'COMMON_FUND' ? 'Quỹ chung' : `Cá nhân · ${option.label}`}</option>
          ))}
        </select>
      </label>
      {expenseSourcesError ? <p role="status" className="text-sm text-amber-300">{expenseSourcesError}</p>
        : !activeSources.some(option => option.kind === 'SHAREHOLDER') && <p className="text-sm text-amber-300">Chưa có nguồn chi cá nhân đang hoạt động.</p>}
      {advanceSource.startsWith(SELF_PAID_SOURCE_PREFIX) && isAvailableAdvanceSource && (
        <p className="text-sm text-slate-400">Khoản này được ghi vào tiền cá nhân chờ hoàn. Quỹ chung chưa bị trừ.</p>
      )}
    </div>
  );
  const ledgerSummary = summarizeFinancialLedger(ledger);
  const totalGop = ledgerSummary.capital;
  const totalDoanhThu = ledgerSummary.revenue;
  const totalChiPhi = ledgerSummary.expense;
  const totalTreo = ledgerSummary.pending;
  const totalVonHienVat = ledgerSummary.inKindCapital;
  const totalRemainingBalance = ledgerSummary.balance;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-emerald-500" /> Sổ Cái & Quản Lý Giao Dịch</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Quản lý tài chính đa kỳ tích hợp các component độc lập hiệu năng cao</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button type="button" onClick={() => { const defaultPayer = employees.find((employee) => employee.full_name.trim() === DEFAULT_COMPANY_PAYER_NAME) || employees[0]; pendingCreatedLedgerId.current = null; createIdempotencyKey.current = crypto.randomUUID(); setType('CHI_PHI'); setExpenseSource(COMMON_FUND_SOURCE_ID); setSubType('TIEN_MAT'); setCategory(''); setAmount(''); setReporter(defaultPayer ? String(defaultPayer.id) : ''); setBeneficiaryEmployeeId(''); setBeneficiaryExternalName(''); setTransactionDate(new Date().toISOString().slice(0, 10)); setDescription(''); setProjectId(''); setPendingFiles([]); setIsPaid(true); setFormMonthInput(monthInput); setShowAddModal(true); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg">
            <Plus className="w-4 h-4" /> Thêm Giao Dịch
          </button>
          <div className="flex items-center gap-2 z-10">
            <span className="text-xs font-mono font-bold text-slate-400">Kỳ báo cáo:</span>
            <MonthPicker value={monthInput} onChange={setMonthInput} />
          </div>
        </div>
      </div>

      {loading && !hasLoadedData ? (
        <LedgerLoadingSkeleton />
      ) : loadError && !hasLoadedData ? (
        <div className="rounded-2xl border border-red-900/40 bg-red-950/20 p-8 text-center text-sm font-bold text-red-300">
          <p>Không tải được dữ liệu.</p>
          <button type="button" onClick={() => void loadData()} className="mt-3 rounded-lg border border-red-500/40 px-3 py-2 text-xs hover:bg-red-950/40">Thử lại</button>
        </div>
      ) : (
        <>
          <LedgerMetrics
            totalGop={totalGop}
            totalDoanhThu={totalDoanhThu}
            totalChiPhi={totalChiPhi}
            totalTreo={totalTreo}
            totalRemainingBalance={totalRemainingBalance}
            totalVonHienVat={totalVonHienVat}
          />

          <MonthlyCapitalSettings canUpdate={canUpdateLedger} />
          <CapitalShareCard ledgerData={ledger.filter(row=>!row.cancelled_at)} />
          {personalAdvances && <PersonalAdvancesCard advances={personalAdvances} canPay={reimbursementCapabilities.canPay} onRefund={row => {
            setRefundAmount(String(Number(row.advanced) - Number(row.refunded)));
            setPaymentError(''); setRefundTarget({ row, requestId: crypto.randomUUID() });
          }} />}

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="flex flex-col gap-4 border-b border-slate-800 bg-slate-950/40 px-5 py-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-100">Nhật ký thu chi</h2>
              <p className="mt-1 text-xs text-slate-400">Kỳ {selectedMonth}</p>
            </div>
            <input aria-label="Tìm giao dịch" type="search" placeholder="Tìm khoản mục, người liên quan…" className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 sm:w-72" value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          {canManageTestRecords && <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div role="group" aria-label="Lọc trạng thái giao dịch" className="inline-flex w-fit items-center gap-1 rounded-lg border border-slate-700/70 bg-slate-950 p-1">
              {[{ deleted: false, label: 'Đang dùng' }, { deleted: true, label: 'Đã xóa' }].map(view => <button key={view.label} type="button" aria-pressed={showDeleted === view.deleted} onClick={() => { setShowDeleted(view.deleted); setCurrentPage(1); }} className={`inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${showDeleted === view.deleted ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-200'}`}>
                {view.label}<span className={`min-w-5 rounded px-1.5 py-0.5 text-center text-[10px] tabular-nums ${showDeleted === view.deleted ? 'bg-slate-600 text-slate-100' : 'bg-slate-800 text-slate-400'}`}>{ledger.filter(row => Boolean(row.cancelled_at) === view.deleted).length}</span>
              </button>)}
            </div>
            {showDeleted && <p className="text-xs text-slate-400">Bản ghi đã xóa không được tính vào báo cáo.</p>}
          </div>}
        </div>
        {loading ? (
          <LedgerTableLoadingState />
        ) : loadError ? (
          <div className="p-8 text-center text-sm font-bold text-red-300">
            <p>Không tải được dữ liệu của kỳ này.</p>
            <button type="button" onClick={() => void loadData()} className="mt-3 rounded-lg border border-red-500/40 px-3 py-2 text-xs hover:bg-red-950/40">Thử lại</button>
          </div>
        ) : filteredLedger.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            {searchTerm ? 'Không tìm thấy giao dịch phù hợp.' : showDeleted ? 'Chưa có bản ghi đã xóa trong kỳ này.' : 'Chưa có giao dịch trong kỳ này.'}
          </div>
        ) : (
          <>
          <LedgerTable
            data={currentLedgerData}
            salaryMailEnabled={salaryMailEnabled}
            onRetrySalaryEmail={handleRetrySalaryEmail}
            onTogglePaid={handleTogglePaid}
            canManageTestRecords={canManageTestRecords} onTestArchive={setTestRecord}
            onOpenEdit={handleOpenEdit} activityEnabled={activityEnabled} canUpdate={canUpdateLedger} onHistory={(item) => setHistoryId(String(item.id))}
            onGenerateQr={handleGenerateVietQR}
            personalAdvances={personalAdvances}
            onChangeSource={row => {
              const advance = personalAdvances?.find(item => String(item.ledger_id) === String(row.id));
              setPaymentError('');
              setAdvanceSource(advance ? `${SELF_PAID_SOURCE_PREFIX}${advance.shareholder_id}` : COMMON_FUND_SOURCE_ID);
              setSourceTarget(row);
            }}
            reimbursementCapabilities={reimbursementCapabilities}
            activeReimbursementActionId={activeReimbursementActionId}
            onTransitionReimbursement={handleTransitionReimbursement}
          /></>
        )}

        {!loading && !loadError && filteredLedger.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-5 py-3 bg-slate-950 border-t border-slate-800">
            <span className="text-xs text-slate-500 mb-3 sm:mb-0">Hiển thị {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredLedger.length)} trong tổng số {filteredLedger.length} bản ghi</span>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronsLeft className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronLeft className="w-4 h-4" /></button>
              <span className="text-xs font-mono font-bold text-slate-300 px-3">{currentPage} / {totalPages}</span>
              <button onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages} className="p-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200 disabled:opacity-50"><ChevronsRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
          </div>
        </>
      )}

      {showAddModal && (
        <AdminSidePanel title="Ghi sổ thu chi" wide busy={isSubmitting} onClose={() => setShowAddModal(false)}
          actions={<>
            <button type="button" onClick={() => setShowAddModal(false)} disabled={isSubmitting} className="admin-button-secondary">Hủy</button>
            <button type="button" onClick={handleInsertLedger} disabled={isSubmitting} className="admin-button-primary">{isSubmitting ? 'Đang ghi…' : 'Ghi sổ'}</button>
          </>}>
          <div className="space-y-4 text-xs">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-blue-300">Thông tin giao dịch</h4>
              <div>
                <label className="text-slate-400">Kỳ hạch toán:</label>
                <div className="mt-1"><MonthPicker value={formMonthInput} onChange={setFormMonthInput} /></div>
              </div>
              <div>
                <label className="text-slate-400">Loại nghiệp vụ:</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200"
                  value={type}
                  onChange={e => {
                    const val = e.target.value;
                    setType(val);
                    // LÀM SẠCH NGAY KHI ĐỔI LOẠI
                    if (val !== 'CHI_PHI') setExpenseSource(COMMON_FUND_SOURCE_ID);
                    if (val !== 'VON_GOP') setSubType('TIEN_MAT');
                  }}
                >
                  {transactionTypes.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>

              {type === 'CHI_PHI' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Hình thức thanh toán chi phí:</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    value={expenseSource}
                    onChange={e => setExpenseSource(e.target.value)}
                    disabled={isSubmitting || expensePaymentSources.length === 0}
                  >
                    {expensePaymentSources.map((source) => (
                      <option key={source.id} value={source.id} disabled={!source.isActive}>
                        {source.kind === 'COMMON_FUND' ? '🏢' : '👤'} {source.label}{!source.isActive ? ' (ngừng dùng)' : ''}
                      </option>
                    ))}
                  </select>
                  {expenseSourcesError && (
                    <p className="mt-1 text-[10px] text-red-300">{expenseSourcesError}</p>
                  )}
                </div>
              )}

              {type === 'VON_GOP' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Phân loại danh mục nguồn vốn:</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={subType} onChange={e => setSubType(e.target.value as 'TIEN_MAT' | 'HIEN_VAT')}>
                    {contributionTypes.length > 0 ? (
                      contributionTypes.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)
                    ) : (
                      <>
                        <option value="TIEN_MAT">🏢 Góp vốn chung (Vào két quỹ)</option>
                        <option value="HIEN_VAT">👤 Cá nhân tự chi trả</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div><label className="text-slate-400">Khoản mục:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={category} onChange={e => setCategory(e.target.value)} /></div>
              <div><label className="text-slate-400">Số tiền:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold focus:outline-none" value={amount} onChange={e => setAmount(formatCurrency(e.target.value))} /></div>
              <div><label className="text-slate-400">Ngày giao dịch:</label><input disabled={!extendedSchemaEnabled} type="date" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200 disabled:opacity-60" value={transactionDate} onChange={e => setTransactionDate(e.target.value)} /></div>
              <div><label className="text-slate-400">Mô tả:</label><textarea disabled={!extendedSchemaEnabled} className="min-h-[76px] w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200 disabled:opacity-60" value={description} onChange={e => setDescription(e.target.value)} /></div>
              <div><label className="text-slate-400">Dự án liên quan:</label><select disabled={!extendedSchemaEnabled} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={projectId} onChange={e => setProjectId(e.target.value)}><option value="">Không liên kết</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></div>
              <div>
                <label className="text-slate-400">Người thực hiện giao dịch:</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={reporter} onChange={e => setReporter(e.target.value)}>
                  <option value="">Chưa xác định</option>
                  {employees.map(e => <option key={e.id} value={String(e.id)}>{e.full_name}</option>)}
                </select>
              </div>
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-emerald-300">Người liên quan</h4>
                <p className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-3 text-[11px] text-amber-200">Người hưởng lợi, Người thực hiện chi và Người tạo phiếu là các vai trò riêng. Với lương/hoàn trả, QR phải dùng Thông tin nhận tiền của Người hưởng lợi.</p>
                <div><label className="text-slate-400">Người hưởng lợi:</label><select disabled={!extendedSchemaEnabled} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={beneficiaryEmployeeId} onChange={e => { setBeneficiaryEmployeeId(e.target.value); if (e.target.value) setBeneficiaryExternalName(''); }}><option value="">Chưa xác định / bên ngoài</option>{employees.map(employee => <option key={employee.id} value={String(employee.id)}>{employee.full_name}</option>)}</select></div>
                <div><label className="text-slate-400">Người hưởng lợi bên ngoài:</label><input disabled={!extendedSchemaEnabled || Boolean(beneficiaryEmployeeId)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={beneficiaryExternalName} onChange={e => setBeneficiaryExternalName(e.target.value)} placeholder="Nhà cung cấp hoặc người nhận khác" /></div>
                {!extendedSchemaEnabled && <p className="text-[10px] text-amber-300">Trường Người hưởng lợi sẽ khả dụng sau khi gói Ledger/Reimbursement được operator xác minh và kích hoạt.</p>}
                <div className="text-[11px] text-slate-400">Người tạo phiếu: hệ thống xác thực máy chủ (không nhận từ biểu mẫu).</div>
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-cyan-300">Thanh toán</h4>

              {(expenseSource !== 'TU_CHI_TRA' && type !== 'VON_GOP') && (
                <div className="pt-2 animate-fadeIn"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /><span className="text-slate-300 font-bold">{isPaid ? '✅ Đã thanh toán' : '⏳ Chờ duyệt'}</span></label></div>
              )}
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
                <h4 className="font-bold text-purple-300">Chứng từ</h4>
                <p className="text-[11px] text-slate-400">Hỗ trợ ảnh hóa đơn, PDF, bằng chứng chuyển khoản và chứng từ nhân sự gửi. Tệp được kiểm tra loại, dung lượng, tên tệp và quyền truy cập trước khi lưu.</p>
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!attachmentsEnabled || isSubmitting} onChange={e => setPendingFiles(Array.from(e.target.files || []))} className="w-full rounded-xl border border-dashed border-slate-700 p-3 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white disabled:opacity-60" />
                {!attachmentsEnabled && <p className="text-[11px] text-amber-300">Kho chứng từ riêng chưa được kiểm tra và kích hoạt.</p>}
                {pendingFiles.length > 0 && <ul className="space-y-1 text-[11px] text-slate-300">{pendingFiles.map(file => <li key={`${file.name}:${file.lastModified}`}>{file.name} · {(file.size / 1024 / 1024).toFixed(1)} MB</li>)}</ul>}
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
                <h4 className="font-bold text-amber-300">Phê duyệt và lịch sử</h4>
                <p className="text-[11px] text-slate-400">{activityEnabled ? 'Thay đổi thông tin giao dịch được ghi vào lịch sử. Điều chỉnh bản ghi đã trả cần có lý do.' : 'Lịch sử hoạt động chưa được bật.'}</p>
              </section>
            </div>
          </div>
        </AdminSidePanel>
      )}

      {testRecord && <TestLedgerDialog row={testRecord} onClose={()=>setTestRecord(null)} onSaved={refreshLedger}/> }
      {showEditModal && (
        <AdminSidePanel title="Sửa giao dịch" wide busy={isSubmitting || attachmentActionId != null} onClose={() => { setShowEditModal(false); setEditingId(null); }}
          actions={<>
            <button type="button" onClick={() => { setShowEditModal(false); setEditingId(null); }} disabled={isSubmitting || attachmentActionId != null} className="admin-button-secondary">Hủy</button>
            <button type="button" onClick={handleSaveEdit} disabled={isSubmitting || attachmentActionId != null} className="admin-button-primary">{isSubmitting ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
          </>}>
          <div className="space-y-4 text-xs">
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-blue-300">Thông tin giao dịch</h4>
              <div>
                <label className="text-slate-400">Kỳ hạch toán:</label>
                <div className="mt-1"><MonthPicker value={editMonthInput} onChange={setEditMonthInput} /></div>
              </div>
              <div>
                <label className="text-slate-400">Loại nghiệp vụ:</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200"
                  value={editType}
                  disabled={activityEnabled && editingPaid}
                  onChange={e => {
                    const val = e.target.value;
                    setEditType(val);
                    // LÀM SẠCH NGAY KHI ĐỔI LOẠI
                    if (val !== 'CHI_PHI') setEditExpenseSource(COMMON_FUND_SOURCE_ID);
                    if (val !== 'VON_GOP') setEditSubType('TIEN_MAT');
                  }}
                >
                  {transactionTypes.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>

              {editType === 'CHI_PHI' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Hình thức thanh toán chi phí:</label>
                  <select
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
                    value={editExpenseSource}
                    onChange={e => setEditExpenseSource(e.target.value)}
                    disabled={isSubmitting || expensePaymentSources.length === 0}
                  >
                    {expensePaymentSources.map((source) => (
                      <option key={source.id} value={source.id} disabled={!source.isActive && source.id !== editExpenseSource}>
                        {source.kind === 'COMMON_FUND' ? '🏢' : '👤'} {source.label}{!source.isActive ? ' (ngừng dùng)' : ''}
                      </option>
                    ))}
                  </select>
                  {expenseSourcesError && (
                    <p className="mt-1 text-[10px] text-red-300">{expenseSourcesError}</p>
                  )}
                </div>
              )}

              {editType === 'VON_GOP' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Phân loại danh mục nguồn vốn:</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={editSubType} onChange={e => setEditSubType(e.target.value as 'TIEN_MAT' | 'HIEN_VAT')}>
                    {contributionTypes.length > 0 ? (
                      contributionTypes.map((c) => <option key={c.code} value={c.code}>{c.label}</option>)
                    ) : (
                      <>
                        <option value="TIEN_MAT">🏢 Góp vốn chung (Vào két quỹ)</option>
                        <option value="HIEN_VAT">👤 Cá nhân tự chi trả</option>
                      </>
                    )}
                  </select>
                </div>
              )}

              <div><label className="text-slate-400">Khoản mục:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={editCategory} onChange={e => setEditCategory(e.target.value)} /></div>
              <div><label className="text-slate-400">Số tiền:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold focus:outline-none" value={editAmount} onChange={e => setEditAmount(formatCurrency(e.target.value))} /></div>
              <div><label className="text-slate-400">Ngày giao dịch:</label><input disabled={!extendedSchemaEnabled} type="date" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editTransactionDate} onChange={e => setEditTransactionDate(e.target.value)} /></div>
              <div><label className="text-slate-400">Mô tả:</label><textarea disabled={!extendedSchemaEnabled} className="min-h-[76px] w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editDescription} onChange={e => setEditDescription(e.target.value)} /></div>
              <div><label className="text-slate-400">Dự án liên quan:</label><select disabled={!extendedSchemaEnabled} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editProjectId} onChange={e => setEditProjectId(e.target.value)}><option value="">Không liên kết</option>{projects.map(project => <option key={project.id} value={String(project.id)}>{project.name}</option>)}</select></div>
              <div className="animate-fadeIn">
                <label className="text-slate-400">Người thực hiện giao dịch:</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200"
                  value={editReporter}
                  disabled={activityEnabled && editingReimbursement}
                  onChange={e => setEditReporter(e.target.value)}
                >
                  <option value="">Chưa xác định</option>
                  {employees.map(e => (
                    <option key={e.id} value={String(e.id)}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-emerald-300">Người liên quan</h4>
                <div><label className="text-slate-400">Người hưởng lợi:</label><select disabled={!extendedSchemaEnabled || (activityEnabled && editingReimbursement)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editBeneficiaryEmployeeId} onChange={e => { setEditBeneficiaryEmployeeId(e.target.value); if (e.target.value) setEditBeneficiaryExternalName(''); }}><option value="">Chưa xác định / bên ngoài</option>{employees.map(employee => <option key={employee.id} value={String(employee.id)}>{employee.full_name}</option>)}</select></div>
                <div><label className="text-slate-400">Người hưởng lợi bên ngoài:</label><input disabled={!extendedSchemaEnabled || Boolean(editBeneficiaryEmployeeId) || (activityEnabled && editingReimbursement)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editBeneficiaryExternalName} onChange={e => setEditBeneficiaryExternalName(e.target.value)} /></div>
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-cyan-300">Thanh toán</h4>
              <div className="pt-2"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={editIsPaid} disabled={activityEnabled && editingPaid} onChange={e => setEditIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /><span className="text-slate-300 font-bold">Đã thanh toán</span></label></div>
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
                <h4 className="font-bold text-purple-300">Chứng từ</h4>
                <p className="text-[11px] text-slate-400">Hỗ trợ ảnh hóa đơn, PDF, bằng chứng chuyển khoản và chứng từ nhân sự gửi. Tệp được kiểm tra loại, dung lượng, tên tệp và quyền truy cập trước khi lưu.</p>
                {editAttachments.length > 0 && (
                  <ul className="space-y-2">
                    {editAttachments.map((attachment) => {
                      const attachmentUrl = attachment.signedUrl || attachment.legacyUrl;
                      const isLegacyAttachment = String(attachment.id).startsWith('legacy:');
                      const isAttachmentBusy = attachmentActionId === attachment.id;
                      return (
                        <li key={attachment.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 p-3">
                          {attachmentUrl ? (
                            <a href={attachmentUrl} target="_blank" rel="noreferrer" className="max-w-full break-all font-bold text-blue-300 hover:underline">{attachment.originalFilename}</a>
                          ) : (
                            <span className="max-w-full break-all font-bold text-slate-400">{attachment.originalFilename} · Chưa tạo được liên kết xem</span>
                          )}
                          {!isLegacyAttachment && (
                            <div className="flex gap-2">
                              <label className={`rounded-lg border border-slate-700 px-2 py-1 ${isAttachmentBusy ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-slate-800'}`}>
                                {isAttachmentBusy ? 'Đang xử lý...' : 'Thay'}
                                <input disabled={isAttachmentBusy || !attachmentsEnabled} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => { const file = e.target.files?.[0]; e.currentTarget.value = ''; if (file) void handleReplaceAttachment(attachment, file); }} />
                              </label>
                              <button disabled={isAttachmentBusy || !attachmentsEnabled} type="button" onClick={() => void handleRemoveAttachment(attachment)} className="rounded-lg border border-red-500/30 px-2 py-1 text-red-300 hover:bg-red-950/30 disabled:cursor-not-allowed disabled:opacity-60">Gỡ</button>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" disabled={!attachmentsEnabled || isSubmitting || attachmentActionId != null} onChange={e => setEditPendingFiles(Array.from(e.target.files || []))} className="w-full rounded-xl border border-dashed border-slate-700 p-3 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-3 file:py-2 file:text-xs file:font-bold file:text-white disabled:opacity-60" />
                {!attachmentsEnabled && <p className="text-[11px] text-amber-300">Kho chứng từ riêng chưa được kiểm tra và kích hoạt.</p>}
                {editPendingFiles.length > 0 && <p className="text-[11px] text-slate-300">Sẽ thêm {editPendingFiles.length} chứng từ khi lưu.</p>}
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 lg:col-span-2">
                <h4 className="font-bold text-amber-300">Phê duyệt và lịch sử</h4>
                <p className="text-[11px] text-slate-400">{activityEnabled ? 'Thay đổi thông tin giao dịch được ghi vào lịch sử. Điều chỉnh bản ghi đã trả cần có lý do.' : 'Lịch sử hoạt động chưa được bật.'}</p>
              </section>
            </div>
            {activityEnabled && editingPaid && <label className="block space-y-2"><span className="text-slate-300">Lý do điều chỉnh bản ghi đã trả <span className="text-red-300">*</span></span><textarea value={editCorrectionReason} onChange={event=>setEditCorrectionReason(event.target.value)} minLength={5} maxLength={500} className="admin-field" /><span className="block text-slate-500">Lịch sử ghi phần thay đổi và lý do. Trạng thái thanh toán giữ nguyên.</span></label>}
            {editError && (
              <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-red-200">
                <p className="font-bold">{editError.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">Mã hỗ trợ: {editError.correlationId}</p>
              </div>
            )}
          </div>
        </AdminSidePanel>
      )}

      {historyId && <ActivityHistoryDialog entityId={historyId} onClose={()=>setHistoryId(null)} />}
      {(sourceTarget || refundTarget) && (
        <AdminSidePanel
          title={refundTarget ? `Hoàn tiền cho ${refundTarget.row.person}` : sourceTarget?.is_paid ? 'Đổi nguồn chi' : 'Xác nhận đã trả lương'}
          description={sourceTarget ? [sourceTarget.beneficiary_name, `${Number(sourceTarget.amount).toLocaleString('vi-VN')} đ`].filter(Boolean).join(' · ') : undefined}
          onClose={closeAdvance} busy={advanceBusy}
          actions={<>
            <button type="button" className="admin-button-secondary" disabled={advanceBusy} onClick={closeAdvance}>Đóng</button>
            <button type="submit" form="ledger-advance-form" className="admin-button-primary" disabled={advanceBusy || Boolean(sourceTarget && !canSaveSource)}>
              {advanceBusy ? 'Đang lưu…' : refundTarget ? 'Xác nhận đã hoàn' : sourceTarget?.is_paid ? 'Lưu nguồn chi' : CONFIRM_PAID_LABEL}
            </button>
          </>}>
          <form id="ledger-advance-form" className="space-y-4" onSubmit={event => { event.preventDefault(); void saveAdvance(); }}>
            {refundTarget ? (
              <label className="block text-sm font-semibold">
                Số tiền đã chuyển (đồng)
                <input type="number" required min={1} step={1} max={Number(refundTarget.row.advanced) - Number(refundTarget.row.refunded)}
                  className="admin-field mt-1" disabled={advanceBusy} value={refundAmount} onChange={event => { setRefundAmount(event.target.value); setPaymentError(''); }} />
                <span className="mt-2 block font-normal text-slate-400">Chuyển khoản trước rồi xác nhận để ghi giảm quỹ chung.</span>
              </label>
            ) : (
              <>
                {sourceTarget?.is_paid && <p className="text-sm text-slate-400">Nguồn hiện tại <strong className="text-slate-100">{currentAdvance ? `Cá nhân · ${currentAdvance.person}` : 'Quỹ chung'}</strong></p>}
                {sourceSelector}
              </>
            )}
            {paymentError && <p role="alert" className="text-sm text-red-300">{paymentError}</p>}
          </form>
        </AdminSidePanel>
      )}
      {showQrModal && activeQrTarget && (
        <AdminSidePanel title={activeQrTarget.title} description={activeQrTarget.category} onClose={closeQr} busy={advanceBusy}
          actions={<>
            <button type="button" className="admin-button-secondary" disabled={advanceBusy} onClick={closeQr}>Đóng</button>
            <button type="button" className="admin-button-primary" disabled={advanceBusy || (qrNeedsSource && !isAvailableAdvanceSource)} onClick={handleInstantPaymentSuccess}>
              {advanceBusy ? 'Đang lưu…' : activeQrTarget.type === 'VON_GOP' || activeQrTarget.type === 'DOANH_THU' ? 'Xác nhận đã nhận' : CONFIRM_PAID_LABEL}
            </button>
          </>}>
          <div className="space-y-4">
            {qrNeedsSource && sourceSelector}
            <div className="mx-auto w-fit max-w-full rounded-xl bg-white p-3">
              <Image src={activeQrUrl} alt="Mã VietQR" width={240} height={240} unoptimized className="h-auto max-w-full object-contain" />
            </div>
            <dl className="space-y-2 rounded-xl border border-slate-800 bg-slate-950 p-3 text-sm">
              <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-400">Ngân hàng</dt><dd>{activeQrTarget.bankName}</dd></div>
              <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-400">Số tài khoản</dt><dd className="font-mono">{activeQrTarget.accountNo}</dd></div>
              <div className="flex flex-wrap justify-between gap-x-3"><dt className="text-slate-400">Số tiền</dt><dd className="font-semibold">{activeQrTarget.amount.toLocaleString('vi-VN')} đ</dd></div>
            </dl>
            {paymentError && <p role="alert" className="text-sm text-red-300">{paymentError}</p>}
          </div>
        </AdminSidePanel>
      )}
    </div>
  );
}
