// app/admin/capital/page.tsx
'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import Image from 'next/image';
import { supabase } from '@/utils/supabase/client';
import { useNotification } from '@/component/NotificationContext';
import { useGlobalLoading } from '@/component/GlobalLoading';
import MonthPicker from '@/component/MonthPicker';
import LedgerMetrics from './components/LedgerMetrics';
import LedgerTable from './components/LedgerTable';
import CapitalShareCard from './components/CapitalShareCard';
import type { AdminLedgerMutationInput, ExpensePaymentSourceOption, FinanceAttachment, FinancialLedgerEntry } from '@/lib/types/finance';
import {
  FINANCE_ATTACHMENT_POLICY,
  MISSING_EMPLOYEE_PAYMENT_INFO_MESSAGE,
  buildBeneficiaryVietQrUrl,
  validateFinanceAttachment,
} from '@/lib/financeExpenseWorkflow';
import {
  CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME,
  DEFAULT_CAPITAL_CONTRIBUTION_TYPES,
  DEFAULT_FINANCIAL_TRANSACTION_TYPES,
  FINANCIAL_TRANSACTION_TYPE_METADATA_NAME,
  normalizeSystemMetadataOptions,
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
  removeAdminLedgerAttachment,
  replaceAdminLedgerAttachment,
  setAdminFinancialLedgerPaid,
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

interface ShareholderPaymentSourceRow {
  id: number | string;
  name: string | null;
  status: string | null;
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
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <LedgerSkeletonBlock className="h-28" />
        <LedgerSkeletonBlock className="h-28" />
        <LedgerSkeletonBlock className="h-28" />
        <LedgerSkeletonBlock className="h-28" />
      </div>
      <LedgerSkeletonBlock className="h-40" />
      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-5 py-3">
          <div className="h-3 w-48 animate-pulse rounded bg-slate-800" />
          <div className="h-8 w-64 animate-pulse rounded-xl bg-slate-800" />
        </div>
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="grid grid-cols-5 gap-3">
              <div className="h-4 animate-pulse rounded bg-slate-800" />
              <div className="h-4 animate-pulse rounded bg-slate-800" />
              <div className="h-4 animate-pulse rounded bg-slate-800" />
              <div className="h-4 animate-pulse rounded bg-slate-800" />
              <div className="h-4 animate-pulse rounded bg-slate-800" />
            </div>
          ))}
        </div>
      </div>
      <p className="text-center text-xs font-bold text-slate-500">Đang tải dữ liệu...</p>
    </div>
  );
}

export default function AdminFinancialLedger() {
  const { showToast } = useNotification();
  const { hideGlobalLoading, showGlobalLoading } = useGlobalLoading();
  const [ledger, setLedger] = useState<FinancialLedgerEntry[]>([]);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<SystemMetadataOption[]>(() => [...DEFAULT_FINANCIAL_TRANSACTION_TYPES]);
  const [contributionTypes, setContributionTypes] = useState<SystemMetadataOption[]>(() => [...DEFAULT_CAPITAL_CONTRIBUTION_TYPES]);
  const [expensePaymentSources, setExpensePaymentSources] = useState<ExpensePaymentSourceOption[]>([]);
  const [expenseSourcesLoading, setExpenseSourcesLoading] = useState(true);
  const [expenseSourcesError, setExpenseSourcesError] = useState('');
  const [companyBankCode, setCompanyBankCode] = useState<string>('MB');
  const [companyBankAccount, setCompanyBankAccount] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLock = useRef(false);
  const pendingCreatedLedgerId = useRef<number | string | null>(null);
  const createIdempotencyKey = useRef(crypto.randomUUID());
  const [extendedSchemaEnabled, setExtendedSchemaEnabled] = useState(false);
  const [attachmentsEnabled, setAttachmentsEnabled] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: number | string; name: string }>>([]);

  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const selectedMonth = reportingPeriodFromMonthInput(monthInput);

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
  } | null>(null);

  // Pagination & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8);

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setExpenseSourcesLoading(true);
    setExpenseSourcesError('');
    try {
      const { data: emps, error: employeesError } = await supabase
        .from('employees')
        .select('id, full_name, bank_name, bank_account_number');
      if (employeesError) throw employeesError;
      setEmployees(emps || []);
      if (emps && emps.length > 0) {
        const defaultPayer = emps.find((employee) => employee.full_name?.trim() === DEFAULT_COMPANY_PAYER_NAME) || emps[0];
        setReporter((current) => current || String(defaultPayer.id));
      }

      const { data: paymentSourceRows, error: paymentSourceError } = await supabase
        .from('shareholders')
        .select('id, name, status')
        .order('id', { ascending: true });
      if (paymentSourceError) throw paymentSourceError;
      setExpensePaymentSources(
        getExpensePaymentSourceOptions((paymentSourceRows || []) as ShareholderPaymentSourceRow[])
      );
      setExpenseSourcesLoading(false);

      const { data: meta, error: metadataError } = await supabase.from('system_metadata').select('data').eq('name', FINANCIAL_TRANSACTION_TYPE_METADATA_NAME).maybeSingle();
      if (metadataError) throw metadataError;
      const normalizedTransactionTypes = normalizeSystemMetadataOptions(meta?.data, DEFAULT_FINANCIAL_TRANSACTION_TYPES);
      setTransactionTypes(normalizedTransactionTypes);
      setType((current) => normalizedTransactionTypes.some((option) => option.code === current)
        ? current
        : normalizedTransactionTypes[0]?.code || 'CHI_PHI');

      const { data: contribMeta, error: contributionMetadataError } = await supabase.from('system_metadata').select('data').eq('name', CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME).maybeSingle();
      if (contributionMetadataError) throw contributionMetadataError;
      const normalizedContributionTypes = normalizeSystemMetadataOptions(contribMeta?.data, DEFAULT_CAPITAL_CONTRIBUTION_TYPES);
      setContributionTypes(normalizedContributionTypes);
      setSubType((current) => normalizedContributionTypes.some((option) => option.code === current)
        ? current
        : (normalizedContributionTypes[0]?.code as 'TIEN_MAT' | 'HIEN_VAT' | undefined) || 'TIEN_MAT');

      const financeConfigResponse = await fetch('/api/admin/finance/config', {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
        credentials: 'include',
        cache: 'no-store',
      });

      if (financeConfigResponse.ok) {
        const financeConfig = (await financeConfigResponse.json()) as {
          companyBankCode?: string;
          companyBankAccount?: string;
        };

        setCompanyBankCode(financeConfig.companyBankCode || 'MB');
        setCompanyBankAccount(financeConfig.companyBankAccount || '');
      } else {
        setCompanyBankCode('MB');
        setCompanyBankAccount('');
      }

      const ledgerResult = await loadAdminFinancialLedger(selectedMonth);
      setLedger(ledgerResult.ledger);
      setExtendedSchemaEnabled(ledgerResult.extendedSchemaEnabled);
      setAttachmentsEnabled(ledgerResult.attachmentsEnabled);
      setProjects(ledgerResult.projects);
    } catch (e) {
      console.error(e);
      setLoadError('Không tải được dữ liệu.');
      setExpenseSourcesLoading(false);
      setExpenseSourcesError('Không tải được danh sách nguồn chi trả.');
      showToast('Không tải được nguồn chi trả', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, showToast]);

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [loadData]);

  useEffect(() => {
    setFormMonthInput(monthInput);
  }, [monthInput]);

  // Tìm kiếm dữ liệu
  const filteredLedger = ledger.filter(l =>
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
      if (input.monthPeriod === selectedMonth) await loadData();
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

    // Khởi tạo nguồn chi trả cũ
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
      if (input.monthPeriod === selectedMonth) await loadData();
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

  const handleTogglePaid = async (id: number | string, currentStatus: boolean) => {
    if (paymentActionLock.current) return;
    paymentActionLock.current = true;
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      await setAdminFinancialLedgerPaid(id, !currentStatus);
      setLedger(prev => prev.map(l => l.id === id ? { ...l, is_paid: !currentStatus } : l));
      showToast('Đổi trạng thái', 'Đã cập nhật trạng thái tất toán.', 'info');
    } catch (error) {
      showToast('Không thể đổi trạng thái', 'Dữ liệu chưa được cập nhật. Vui lòng thử lại.', 'error');
    } finally {
      paymentActionLock.current = false;
      hideGlobalLoading();
    }
  };

  const handleInstantPaymentSuccess = async () => {
    if (!activeQrTarget?.id || paymentActionLock.current) return;
    const targetId = activeQrTarget.id;
    paymentActionLock.current = true;
    showGlobalLoading('Đang lưu thay đổi...');
    try {
      await setAdminFinancialLedgerPaid(targetId, true);
      setLedger(prev => prev.map(l => l.id === targetId ? { ...l, is_paid: true } : l));
      setShowQrModal(false); setActiveQrUrl('');
      showToast('Thanh toán xong', 'Đã chuyển khoản thành công!', 'success');
    } catch (error) {
      showToast('Không thể xác nhận thanh toán', 'Dữ liệu chưa được cập nhật. Vui lòng thử lại.', 'error');
    } finally {
      paymentActionLock.current = false;
      hideGlobalLoading();
    }
  };

  const handleGenerateVietQR = (item: FinancialLedgerEntry) => {
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
      setActiveQrTarget({ id: item.id, title: item.type === 'HOAN_UNG' ? 'QR thanh toán hoàn ứng' : 'QR thanh toán cho Người hưởng lợi', bankName: matchedBeneficiary?.bank_name || '', accountNo: matchedBeneficiary?.bank_account_number || '', amount: Number(item.amount || 0), category: item.category || '' });
      setShowQrModal(true);
    } else {
      if (!companyBankAccount) return showToast('Thiếu cấu hình', 'Chưa cấu hình tài khoản công ty nhận tiền!', 'error');
      const prefix = item.type === 'DOANH_THU' ? 'Thu' : 'Gop von';
      const cleanCategory = encodeURIComponent(`${prefix}: ${item.requested_by}`);
      const qrUrl = `https://img.vietqr.io/image/${companyBankCode}-${companyBankAccount}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, title: item.type === 'DOANH_THU' ? '💰 QUÉT MÃ THU TIỀN KHÁCH HÀNG' : '🟢 QUÉT MÃ NỘP VỐN CÔNG TY', bankName: companyBankCode, accountNo: companyBankAccount, amount: Number(item.amount || 0), category: item.category || '' });
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

  // --- CÔNG THỨC HẠCH TOÁN DOANH NGHIỆP ---
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

      {loading ? (
        <LedgerLoadingSkeleton />
      ) : loadError ? (
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

          <CapitalShareCard ledgerData={ledger} />

          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-400">Nhật Ký Hạch Toán Kỳ {selectedMonth}</span>
          <input type="text" placeholder="Tìm kiếm nội dung..." className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none w-full sm:w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {filteredLedger.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Không có giao dịch trong kỳ đã chọn.
          </div>
        ) : (
          <LedgerTable
            data={currentLedgerData}
            onTogglePaid={handleTogglePaid}
            onOpenEdit={handleOpenEdit}
            onGenerateQr={handleGenerateVietQR}
          />
        )}

        {filteredLedger.length > 0 && (
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

      {/* ================= MODAL THÊM MỚI ================= */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="create-ledger-title" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5"><h3 id="create-ledger-title" className="font-bold uppercase tracking-wider text-[11px]">Ghi hạch toán sổ cái mới</h3><button type="button" aria-label="Đóng biểu mẫu" disabled={isSubmitting} onClick={() => setShowAddModal(false)}><X className="w-5 h-5"/></button></div>
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
                    disabled={expenseSourcesLoading || Boolean(expenseSourcesError) || expensePaymentSources.length === 0}
                  >
                    {expensePaymentSources.map((source) => (
                      <option key={source.id} value={source.id} disabled={!source.isActive}>
                        {source.kind === 'COMMON_FUND' ? '🏢' : '👤'} {source.label}{!source.isActive ? ' (ngừng dùng)' : ''}
                      </option>
                    ))}
                  </select>
                  {expenseSourcesLoading && (
                    <p className="mt-1 text-[10px] text-slate-500">Đang tải nguồn chi trả...</p>
                  )}
                  {!expenseSourcesLoading && expenseSourcesError && (
                    <p className="mt-1 text-[10px] text-red-300">{expenseSourcesError}</p>
                  )}
                  {!expenseSourcesLoading && !expenseSourcesError && expensePaymentSources.length === 0 && (
                    <p className="mt-1 text-[10px] text-amber-300">Chưa có nguồn chi trả hợp lệ.</p>
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
                <p className="text-[11px] text-slate-400">Chờ duyệt, Từ chối, Đã thanh toán và lịch sử kiểm toán sẽ được ghi qua biên máy chủ sau khi gói schema/RLS được duyệt.</p>
              </section>
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button type="button" onClick={() => setShowAddModal(false)} disabled={isSubmitting} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition disabled:opacity-60">Hủy</button><button type="button" onClick={handleInsertLedger} disabled={isSubmitting} className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white font-black p-3 rounded-xl shadow-lg disabled:opacity-60">{isSubmitting ? 'Đang ghi...' : 'Ghi sổ'}</button></div>
          </div>
        </div>
      )}

      {/* ================= MODAL CHỈNH SỬA ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div role="dialog" aria-modal="true" aria-labelledby="edit-ledger-title" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5"><h3 id="edit-ledger-title" className="font-bold uppercase tracking-wider text-[11px]">Sửa thông tin hạch toán</h3><button type="button" aria-label="Đóng biểu mẫu" disabled={isSubmitting || attachmentActionId != null} onClick={() => { setShowEditModal(false); setEditingId(null); }}><X className="w-5 h-5"/></button></div>
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
                    disabled={expenseSourcesLoading || Boolean(expenseSourcesError) || expensePaymentSources.length === 0}
                  >
                    {expensePaymentSources.map((source) => (
                      <option key={source.id} value={source.id} disabled={!source.isActive && source.id !== editExpenseSource}>
                        {source.kind === 'COMMON_FUND' ? '🏢' : '👤'} {source.label}{!source.isActive ? ' (ngừng dùng)' : ''}
                      </option>
                    ))}
                  </select>
                  {expenseSourcesLoading && (
                    <p className="mt-1 text-[10px] text-slate-500">Đang tải nguồn chi trả...</p>
                  )}
                  {!expenseSourcesLoading && expenseSourcesError && (
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
                <div><label className="text-slate-400">Người hưởng lợi:</label><select disabled={!extendedSchemaEnabled} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editBeneficiaryEmployeeId} onChange={e => { setEditBeneficiaryEmployeeId(e.target.value); if (e.target.value) setEditBeneficiaryExternalName(''); }}><option value="">Chưa xác định / bên ngoài</option>{employees.map(employee => <option key={employee.id} value={String(employee.id)}>{employee.full_name}</option>)}</select></div>
                <div><label className="text-slate-400">Người hưởng lợi bên ngoài:</label><input disabled={!extendedSchemaEnabled || Boolean(editBeneficiaryEmployeeId)} className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 disabled:opacity-60" value={editBeneficiaryExternalName} onChange={e => setEditBeneficiaryExternalName(e.target.value)} /></div>
              </section>
              <section className="space-y-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <h4 className="font-bold text-cyan-300">Thanh toán</h4>
              <div className="pt-2"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={editIsPaid} onChange={e => setEditIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /><span className="text-slate-300 font-bold">Đã thanh toán</span></label></div>
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
                <p className="text-[11px] text-slate-400">Chờ duyệt, Từ chối, Đã thanh toán và lịch sử kiểm toán sẽ được ghi qua biên máy chủ sau khi gói schema/RLS được duyệt.</p>
              </section>
            </div>
            {editError && (
              <div role="alert" className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-red-200">
                <p className="font-bold">{editError.message}</p>
                <p className="mt-1 text-[10px] text-slate-400">Mã hỗ trợ: {editError.correlationId}</p>
              </div>
            )}
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button type="button" onClick={() => { setShowEditModal(false); setEditingId(null); }} disabled={isSubmitting || attachmentActionId != null} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition disabled:opacity-60">Hủy</button><button type="button" onClick={handleSaveEdit} disabled={isSubmitting || attachmentActionId != null} className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white font-black p-3 rounded-xl shadow-lg disabled:opacity-60">{isSubmitting ? 'Đang lưu...' : 'Cập nhật'}</button></div>
          </div>
        </div>
      )}

      {/* POPUP VIETQR DETAILED */}
      {showQrModal && activeQrTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm text-center space-y-4 relative text-slate-200 shadow-2xl">
            <button onClick={() => { setShowQrModal(false); setActiveQrUrl(''); }} className="absolute top-4 right-4 text-slate-500"><X className="w-5 h-5" /></button>
            <h3 className="font-black text-xs uppercase tracking-wider text-cyan-400">{activeQrTarget.title}</h3>
            <div className="inline-block rounded-2xl border-4 border-cyan-500/30 bg-white p-3"><Image src={activeQrUrl} alt="VietQR" width={240} height={240} unoptimized className="h-60 w-60 object-contain" /></div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-left space-y-1 text-[11px] font-mono leading-relaxed">
              <p><span className="text-slate-500">Ngân hàng:</span> <span className="text-cyan-400 font-bold">{activeQrTarget.bankName}</span></p>
              <p><span className="text-slate-500">Số tài khoản:</span> <span className="text-slate-200 font-bold">{activeQrTarget.accountNo}</span></p>
              <p><span className="text-slate-500">Số tiền VND:</span> <span className="text-red-400 font-bold text-xs">{activeQrTarget.amount.toLocaleString()} đ</span></p>
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2 text-xs"><button onClick={() => { setShowQrModal(false); setActiveQrUrl(''); }} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition">Đóng</button><button onClick={handleInstantPaymentSuccess} className="flex-1 bg-emerald-600 hover:bg-emerald-700 transition text-white font-black p-3 rounded-xl shadow-lg">Xác Nhận Đã Chuyển Tiền</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
