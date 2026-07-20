// app/admin/capital/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/client';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import LedgerMetrics from './components/LedgerMetrics';
import LedgerTable from './components/LedgerTable';
import CapitalShareCard from './components/CapitalShareCard';
import type { ExpensePaymentSourceOption, FinancialLedgerEntry } from '@/lib/types/finance';
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
  const { showToast, showConfirm } = useNotification();
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
  const [editIsPaid, setEditIsPaid] = useState(false);
  const [editMonthInput, setEditMonthInput] = useState(monthInput);
  const [editExpenseSource, setEditExpenseSource] = useState<string>('QUY_CHUNG');

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

  const loadData = async () => {
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
      if (emps && emps.length > 0 && !reporter) setReporter(emps[0].full_name);

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
      if (!normalizedTransactionTypes.some((option) => option.code === type)) {
        setType(normalizedTransactionTypes[0]?.code || 'CHI_PHI');
      }

      const { data: contribMeta, error: contributionMetadataError } = await supabase.from('system_metadata').select('data').eq('name', CAPITAL_CONTRIBUTION_TYPE_METADATA_NAME).maybeSingle();
      if (contributionMetadataError) throw contributionMetadataError;
      const normalizedContributionTypes = normalizeSystemMetadataOptions(contribMeta?.data, DEFAULT_CAPITAL_CONTRIBUTION_TYPES);
      setContributionTypes(normalizedContributionTypes);
      if (!normalizedContributionTypes.some((option) => option.code === subType)) {
        setSubType((normalizedContributionTypes[0]?.code as 'TIEN_MAT' | 'HIEN_VAT' | undefined) || 'TIEN_MAT');
      }

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

      const { data: ledgers, error: ledgerError } = await supabase
        .from('financial_ledger')
        .select('id, type, sub_type, category, amount, bill_url, requested_by, is_paid, month_period, created_at')
        .eq('month_period', selectedMonth)
        .order('id', { ascending: false });
      if (ledgerError) throw ledgerError;

      setLedger((ledgers || []) as FinancialLedgerEntry[]);
    } catch (e) {
      console.error(e);
      setLoadError('Không tải được dữ liệu.');
      setExpenseSourcesLoading(false);
      setExpenseSourcesError('Không tải được danh sách nguồn chi trả.');
      showToast('Không tải được nguồn chi trả', 'Vui lòng thử lại sau.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setCurrentPage(1);
    loadData();
  }, [selectedMonth]);

  useEffect(() => {
    setFormMonthInput(monthInput);
  }, [monthInput]);

  // Tìm kiếm dữ liệu
  const filteredLedger = ledger.filter(l =>
    (l.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.requested_by || '').toLowerCase().includes(searchTerm.toLowerCase())
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

  const handleInsertLedger = async () => {
    const numericAmount = parseCurrency(amount);
    if (!category.trim() || !numericAmount) {
      showToast('Thiếu số liệu', 'Vui lòng điền đủ nội dung khoản mục và giá tiền!', 'error');
      return;
    }

    const targetPeriod = reportingPeriodFromMonthInput(formMonthInput);
    if (!isValidReportingPeriod(targetPeriod)) {
      showToast('Kỳ báo cáo không hợp lệ', 'Vui lòng chọn kỳ báo cáo hợp lệ.', 'error');
      return;
    }

    const selectedPaymentSource = findPaymentSourceOption(expensePaymentSources, expenseSource);
    const insertReporter = selectedPaymentSource?.reporterName || reporter;
    const isSelfPaidExpense = type === 'CHI_PHI' && isSelfPaidSource(selectedPaymentSource);

    try {
      if (isSelfPaidExpense) {
        const { error } = await supabase.from('financial_ledger').insert([
          { type: 'CHI_PHI', category: category.trim(), amount: numericAmount, requested_by: insertReporter, month_period: targetPeriod, is_paid: true },
          { type: 'VON_GOP', sub_type: 'HIEN_VAT', category: `[Đối ứng] Vốn hiện vật: ${category.trim()}`, amount: numericAmount, requested_by: insertReporter, month_period: targetPeriod, is_paid: true }
        ]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_ledger').insert([{
          type, sub_type: type === 'VON_GOP' ? subType : null, category: category.trim(), amount: numericAmount, requested_by: insertReporter, month_period: targetPeriod, is_paid: isPaid
        }]);
        if (error) throw error;
      }

      setCategory(''); setAmount(''); setExpenseSource(COMMON_FUND_SOURCE_ID); setSubType('TIEN_MAT');
      if (targetPeriod === selectedMonth) loadData();
      else setMonthInput(formMonthInput);
      setShowAddModal(false);
      showToast('Ghi sổ thành công', 'Dữ liệu tài chính đã được hạch toán đồng bộ.', 'success');
    } catch { showToast('Thất bại', 'Không thể ghi sổ giao dịch.', 'error'); }
  };

  const handleOpenEdit = (item: FinancialLedgerEntry & { linkedChild?: FinancialLedgerEntry | null }) => {
    const numericId = Number(item.id);
    if (!Number.isFinite(numericId)) return;

    setEditingId(numericId);
    setEditType(item.type || 'CHI_PHI');
    setEditCategory(item.category || '');
    setEditAmount(formatCurrency(String(item.amount || '')));
    setEditReporter(item.requested_by || '');
    setEditIsPaid(Boolean(item.is_paid));
    setEditMonthInput(monthInputFromReportingPeriod(item.month_period || selectedMonth));
    setEditSubType(item.sub_type === 'HIEN_VAT' ? 'HIEN_VAT' : 'TIEN_MAT');

    const hasLink = ledger.some(l =>
      l.type === 'VON_GOP' && l.category === `[Đối ứng] Vốn hiện vật: ${item.category}` && l.requested_by === item.requested_by
    );
    // Khởi tạo nguồn chi trả cũ
    const linkedSource = expensePaymentSources.find((source) => source.reporterName === item.requested_by);
    setEditExpenseSource(hasLink && linkedSource ? linkedSource.id : COMMON_FUND_SOURCE_ID);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const numericAmount = parseCurrency(editAmount);
    if (!editCategory.trim() || !numericAmount) return showToast('Thiếu số liệu', 'Vui lòng điền đủ thông tin sửa hạch toán!', 'error');
    if (!editingId) return;

    const targetPeriod = reportingPeriodFromMonthInput(editMonthInput);
    if (!isValidReportingPeriod(targetPeriod)) {
      showToast('Kỳ báo cáo không hợp lệ', 'Vui lòng chọn kỳ báo cáo hợp lệ.', 'error');
      return;
    }

    const originalItem = ledger.find(l => l.id === editingId);
    if (!originalItem) return;

    const originalLinkedCategory = `[Đối ứng] Vốn hiện vật: ${originalItem.category}`;
    const newLinkedCategory = `[Đối ứng] Vốn hiện vật: ${editCategory.trim()}`;
    const selectedPaymentSource = findPaymentSourceOption(expensePaymentSources, editExpenseSource);
    const editReporterName = selectedPaymentSource?.reporterName || editReporter;
    const isSelfPaidExpense = editType === 'CHI_PHI' && isSelfPaidSource(selectedPaymentSource);

    try {
      const { data: oldLink } = await supabase.from('financial_ledger').select('id').eq('type', 'VON_GOP').eq('category', originalLinkedCategory).eq('requested_by', originalItem.requested_by).maybeSingle();

      if (isSelfPaidExpense && !oldLink) {
        await supabase.from('financial_ledger').insert([{ type: 'VON_GOP', sub_type: 'HIEN_VAT', category: newLinkedCategory, amount: numericAmount, requested_by: editReporterName, month_period: targetPeriod, is_paid: true }]);
      }
      else if (!isSelfPaidExpense && oldLink) {
        await supabase.from('financial_ledger').delete().eq('id', oldLink.id);
      }
      else if (isSelfPaidExpense && oldLink) {
        await supabase.from('financial_ledger').update({ category: newLinkedCategory, amount: numericAmount, requested_by: editReporterName, month_period: targetPeriod }).eq('id', oldLink.id);
      }

      await supabase.from('financial_ledger').update({
        type: editType, sub_type: editType === 'VON_GOP' ? editSubType : null, category: editCategory.trim(), amount: numericAmount, requested_by: editReporterName, month_period: targetPeriod, is_paid: isSelfPaidExpense ? true : editIsPaid
      }).eq('id', editingId);

      setShowEditModal(false); setEditingId(null);
      if (targetPeriod === selectedMonth) loadData();
      else setMonthInput(editMonthInput);
      showToast('Thành công', 'Đã cập nhật sửa đổi dữ liệu hạch toán đồng bộ.', 'success');
    } catch { showToast('Thất bại', 'Không thể cập nhật giao dịch.', 'error'); }
  };

  const handleTogglePaid = async (id: number | string, currentStatus: boolean) => {
    await supabase.from('financial_ledger').update({ is_paid: !currentStatus }).eq('id', id);
    setLedger(prev => prev.map(l => l.id === id ? { ...l, is_paid: !currentStatus } : l));
    showToast('Đổi trạng thái', 'Đã cập nhật trạng thái tất toán.', 'info');
  };

  const handleInstantPaymentSuccess = async () => {
    if (!activeQrTarget?.id) return;
    const targetId = activeQrTarget.id;
    await supabase.from('financial_ledger').update({ is_paid: true }).eq('id', targetId);
    setLedger(prev => prev.map(l => l.id === targetId ? { ...l, is_paid: true } : l));
    setShowQrModal(false); setActiveQrUrl('');
    showToast('Thanh toán xong', 'Đã chuyển khoản thành công!', 'success');
  };

  const handleDeleteLedger = (id: number | string) => {
    const targetItem = ledger.find(l => l.id === id);
    if (!targetItem) return;

    showConfirm('Xác nhận hủy bỏ', 'Xóa vĩnh viễn dòng tài chính này và các bản ghi đối ứng liên quan?', async () => {
      try {
        if (targetItem.type === 'CHI_PHI') {
          const linkedCategory = `[Đối ứng] Vốn hiện vật: ${targetItem.category}`;
          await supabase.from('financial_ledger').delete().eq('type', 'VON_GOP').eq('category', linkedCategory).eq('requested_by', targetItem.requested_by);
        }
        await supabase.from('financial_ledger').delete().eq('id', id);
        setLedger(prev => prev.filter(l => l.id !== id));
        if (currentLedgerData.length === 1 && currentPage > 1) setCurrentPage(prev => prev - 1);
        showToast('Đã xóa', 'Đã hủy dòng hạch toán ra khỏi sổ cái.', 'info');
        loadData();
      } catch (err: any) { showToast('Thất bại', err.message, 'error'); }
    });
  };

  const handleGenerateVietQR = (item: FinancialLedgerEntry) => {
    if (item.type === 'CHI_PHI' || item.type === 'CHI_TIEU' || item.type === 'HOAN_UNG') {
      const matchedStaff = employees.find(e => e.full_name === item.requested_by);
      if (!matchedStaff || !matchedStaff.bank_account_number || !matchedStaff.bank_name) return showToast('Thiếu hồ sơ', `Nhân sự [${item.requested_by}] chưa khai báo số tài khoản!`, 'error');
      const cleanCategory = encodeURIComponent(item.category || '');
      const qrUrl = `https://img.vietqr.io/image/${matchedStaff.bank_name}-${matchedStaff.bank_account_number}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, title: item.type === 'HOAN_UNG' ? '🔄 QUÉT MÃ TẤT TOÁN HOÀN ỨNG' : '❌ QUÉT MÃ THANH TOÁN CHI PHÍ', bankName: matchedStaff.bank_name, accountNo: matchedStaff.bank_account_number, amount: Number(item.amount || 0), category: item.category || '' });
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
          <button onClick={() => { setShowAddModal(true); setType('CHI_PHI'); setExpenseSource(COMMON_FUND_SOURCE_ID); setSubType('TIEN_MAT'); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg">
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
          Không tải được dữ liệu.
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
            onDelete={handleDeleteLedger}
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
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5"><h3 className="font-bold uppercase tracking-wider text-[11px]">Ghi Hạch Toán Sổ Cái Mới</h3><button onClick={() => setShowAddModal(false)}><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400">Kỳ báo cáo hạch toán:</label>
                <div className="mt-1"><MonthPicker value={formMonthInput} onChange={setFormMonthInput} /></div>
              </div>
              <div>
                <label className="text-slate-400">Nghiệp vụ hạch toán chính:</label>
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

              <div><label className="text-slate-400">Nội dung khoản mục chi tiết:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={category} onChange={e => setCategory(e.target.value)} /></div>
              <div><label className="text-slate-400">Số tiền quy đổi (VND):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold focus:outline-none" value={amount} onChange={e => setAmount(formatCurrency(e.target.value))} /></div>
              <div>
                <label className="text-slate-400">Nhân sự thực hiện:</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={reporter} onChange={e => setReporter(e.target.value)}>
                  <option value="Admin (Hệ thống)">Admin (Hệ thống)</option>
                  {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
                </select>
              </div>

              {(expenseSource !== 'TU_CHI_TRA' && type !== 'VON_GOP') && (
                <div className="pt-2 animate-fadeIn"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /><span className="text-slate-300 font-bold">{isPaid ? '✅ Tiền đã tất toán / đã trả' : '⏳ Khoản này đang treo nợ chờ chi'}</span></label></div>
              )}
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition">Hủy</button><button onClick={handleInsertLedger} className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white font-black p-3 rounded-xl shadow-lg">Ghi Sổ</button></div>
          </div>
        </div>
      )}

      {/* ================= MODAL CHỈNH SỬA ================= */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5"><h3 className="font-bold uppercase tracking-wider text-[11px]">Sửa thông tin hạch toán</h3><button onClick={() => { setShowEditModal(false); setEditingId(null); }}><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div>
                <label className="text-slate-400">Kỳ báo cáo hạch toán:</label>
                <div className="mt-1"><MonthPicker value={editMonthInput} onChange={setEditMonthInput} /></div>
              </div>
              <div>
                <label className="text-slate-400">Nghiệp vụ hạch toán chính:</label>
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

              <div><label className="text-slate-400">Nội dung khoản mục chi tiết:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={editCategory} onChange={e => setEditCategory(e.target.value)} /></div>
              <div><label className="text-slate-400">Số tiền sửa (VND):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold focus:outline-none" value={editAmount} onChange={e => setEditAmount(formatCurrency(e.target.value))} /></div>
              <div className="animate-fadeIn">
                <label className="text-slate-400">Nhân sự thực hiện:</label>
                <select
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200"
                  value={editReporter}
                  onChange={e => setEditReporter(e.target.value)}
                >
                  <option value="Admin (Hệ thống)">Admin (Hệ thống)</option>
                  {employees.map(e => (
                    <option key={e.id} value={e.full_name}>{e.full_name}</option>
                  ))}
                </select>
              </div>
              <div className="pt-2"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={editIsPaid} onChange={e => setEditIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4 cursor-pointer" /><span className="text-slate-300 font-bold">Đã chi trả tất toán</span></label></div>
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button onClick={() => { setShowEditModal(false); setEditingId(null); }} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:text-slate-200 transition">Hủy</button><button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white font-black p-3 rounded-xl shadow-lg">Cập Nhật</button></div>
          </div>
        </div>
      )}

      {/* POPUP VIETQR DETAILED */}
      {showQrModal && activeQrTarget && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm text-center space-y-4 relative text-slate-200 shadow-2xl">
            <button onClick={() => { setShowQrModal(false); setActiveQrUrl(''); }} className="absolute top-4 right-4 text-slate-500"><X className="w-5 h-5" /></button>
            <h3 className="font-black text-xs uppercase tracking-wider text-cyan-400">{activeQrTarget.title}</h3>
            <div className="bg-white p-3 rounded-2xl inline-block border-4 border-cyan-500/30"><img src={activeQrUrl} alt="VietQR" className="w-60 h-60 object-contain" /></div>
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
