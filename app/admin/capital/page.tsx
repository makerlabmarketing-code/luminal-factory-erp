// app/admin/capital/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker'; 
import LedgerMetrics from './components/LedgerMetrics';
import LedgerTable from './components/LedgerTable'; 
import CapitalShareCard from './components/CapitalShareCard';
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

const convertToPeriodFormat = (monthInputStr: string) => {
  if (!monthInputStr) return '';
  const [year, month] = monthInputStr.split('-');
  return `${month}/${year}`;
};

const convertToInputFormat = (periodStr: string) => {
  if (!periodStr) return '';
  const [month, year] = periodStr.split('/');
  return `${year}-${month}`;
};

export default function AdminFinancialLedger() {
  const { showToast, showConfirm } = useNotification();
  const [ledger, setLedger] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]); 
  const [contributionTypes, setContributionTypes] = useState<any[]>([]); 
  const [companyBankCode, setCompanyBankCode] = useState<string>('MB'); 
  const [companyBankAccount, setCompanyBankAccount] = useState<string>(''); 
  const [loading, setLoading] = useState(true);
  
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date(); 
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const selectedMonth = convertToPeriodFormat(monthInput); 

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
  const [activeQrTarget, setActiveQrTarget] = useState<any>(null);

  // Pagination & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(8); 

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('*');
      setEmployees(emps || []);
      if (emps && emps.length > 0 && !reporter) setReporter(emps[0].full_name);

      const { data: meta } = await supabase.from('system_metadata').select('data').eq('name', 'Danh mục Nghiệp vụ').maybeSingle();
      if (meta && meta.data) {
        setTransactionTypes(meta.data);
        if (meta.data.length > 0 && !type) setType(meta.data[0].code);
      }

      const { data: contribMeta } = await supabase.from('system_metadata').select('data').eq('name', 'Danh mục Hình thức Góp vốn').maybeSingle();
      if (contribMeta && contribMeta.data) {
        setContributionTypes(contribMeta.data);
        if (!subType && contribMeta.data.length > 0) setSubType(contribMeta.data[0].code);
      }

      const { data: setBank } = await supabase.from('system_settings').select('value').eq('key', 'company_bank_code').maybeSingle();
      if (setBank) setCompanyBankCode(setBank.value);

      const { data: setAccount } = await supabase.from('system_settings').select('value').eq('key', 'company_bank_account').maybeSingle();
      if (setAccount) setCompanyBankAccount(setAccount.value);

      const { data: ledgers } = await supabase.from('financial_ledger').select('*').eq('month_period', selectedMonth).order('id', { ascending: false });
      setLedger(ledgers || []);
    } catch (e) { 
      console.error(e); 
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

  const filteredLedger = ledger.filter(l => 
    (l.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.requested_by || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage) || 1;
  const currentLedgerData = filteredLedger.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleInsertLedger = async () => {
    const numericAmount = parseCurrency(amount);
    if (!category.trim() || !numericAmount) {
      showToast('Thiếu số liệu', 'Vui lòng điền đủ nội dung khoản mục và giá tiền!', 'error');
      return;
    }
    
    const targetPeriod = convertToPeriodFormat(formMonthInput);

    try {
      if (type === 'CHI_PHI' && expenseSource === 'TU_CHI_TRA') {
        const { error } = await supabase.from('financial_ledger').insert([
          { type: 'CHI_PHI', category: category.trim(), amount: numericAmount, requested_by: reporter, month_period: targetPeriod, is_paid: true },
          { type: 'VON_GOP', sub_type: 'HIEN_VAT', category: `[Đối ứng] Vốn hiện vật: ${category.trim()}`, amount: numericAmount, requested_by: reporter, month_period: targetPeriod, is_paid: true }
        ]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('financial_ledger').insert([{ 
          type, sub_type: type === 'VON_GOP' ? subType : null, category: category.trim(), amount: numericAmount, requested_by: reporter, month_period: targetPeriod, is_paid: isPaid 
        }]);
        if (error) throw error;
      }

      setCategory(''); setAmount(''); setExpenseSource('QUY_CHUNG'); setSubType('TIEN_MAT');
      if (targetPeriod === selectedMonth) loadData();
      else setMonthInput(formMonthInput);
      setShowAddModal(false);
      showToast('Ghi sổ thành công', 'Dữ liệu tài chính đã được hạch toán đồng bộ.', 'success');
    } catch (err: any) { showToast('Thất bại', err.message, 'error'); }
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id); setEditType(item.type); setEditCategory(item.category); setEditAmount(formatCurrency(item.amount.toString())); 
    setEditReporter(item.requested_by); setEditIsPaid(item.is_paid); setEditMonthInput(convertToInputFormat(item.month_period));
    setEditSubType(item.sub_type || 'TIEN_MAT');

    const hasLink = ledger.some(l => 
      l.type === 'VON_GOP' && l.category === `[Đối ứng] Vốn hiện vật: ${item.category}` && l.requested_by === item.requested_by
    );
    setEditExpenseSource(hasLink ? 'TU_CHI_TRA' : 'QUY_CHUNG');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    const numericAmount = parseCurrency(editAmount);
    if (!editCategory.trim() || !numericAmount) return showToast('Thiếu số liệu', 'Vui lòng điền đủ thông tin sửa hạch toán!', 'error');
    if (!editingId) return;

    const targetPeriod = convertToPeriodFormat(editMonthInput);
    const originalItem = ledger.find(l => l.id === editingId);
    if (!originalItem) return;
    
    const originalLinkedCategory = `[Đối ứng] Vốn hiện vật: ${originalItem.category}`;
    const newLinkedCategory = `[Đối ứng] Vốn hiện vật: ${editCategory.trim()}`;

    try {
      const { data: oldLink } = await supabase.from('financial_ledger').select('id').eq('type', 'VON_GOP').eq('category', originalLinkedCategory).eq('requested_by', originalItem.requested_by).maybeSingle();

      if (editType === 'CHI_PHI' && editExpenseSource === 'TU_CHI_TRA' && !oldLink) {
        await supabase.from('financial_ledger').insert([{ type: 'VON_GOP', sub_type: 'HIEN_VAT', category: newLinkedCategory, amount: numericAmount, requested_by: editReporter, month_period: targetPeriod, is_paid: true }]);
      }
      else if ((editType !== 'CHI_PHI' || editExpenseSource !== 'TU_CHI_TRA') && oldLink) {
        await supabase.from('financial_ledger').delete().eq('id', oldLink.id);
      }
      else if (editType === 'CHI_PHI' && editExpenseSource === 'TU_CHI_TRA' && oldLink) {
        await supabase.from('financial_ledger').update({ category: newLinkedCategory, amount: numericAmount, requested_by: editReporter, month_period: targetPeriod }).eq('id', oldLink.id);
      }

      await supabase.from('financial_ledger').update({
        type: editType, sub_type: editType === 'VON_GOP' ? editSubType : null, category: editCategory.trim(), amount: numericAmount, requested_by: editReporter, month_period: targetPeriod, is_paid: editType === 'CHI_PHI' && editExpenseSource === 'TU_CHI_TRA' ? true : editIsPaid
      }).eq('id', editingId);

      setShowEditModal(false); setEditingId(null); 
      if (targetPeriod === selectedMonth) loadData();
      else setMonthInput(editMonthInput);
      showToast('Thành công', 'Đã cập nhật sửa đổi dữ liệu hạch toán đồng bộ.', 'success');
    } catch (err: any) { showToast('Thất bại', err.message, 'error'); }
  };

  const handleTogglePaid = async (id: number, currentStatus: boolean) => {
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

  const handleDeleteLedger = (id: number) => {
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

  const handleGenerateVietQR = (item: any) => {
    if (item.type === 'CHI_PHI' || item.type === 'CHI_TIEU' || item.type === 'HOAN_UNG') {
      const matchedStaff = employees.find(e => e.full_name === item.requested_by);
      if (!matchedStaff || !matchedStaff.bank_account_number || !matchedStaff.bank_name) return showToast('Thiếu hồ sơ', `Nhân sự [${item.requested_by}] chưa khai báo số tài khoản!`, 'error');
      const cleanCategory = encodeURIComponent(item.category);
      const qrUrl = `https://img.vietqr.io/image/${matchedStaff.bank_name}-${matchedStaff.bank_account_number}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, title: item.type === 'HOAN_UNG' ? '🔄 QUÉT MÃ TẤT TOÁN HOÀN ỨNG' : '❌ QUÉT MÃ THANH TOÁN CHI PHÍ', bankName: matchedStaff.bank_name, accountNo: matchedStaff.bank_account_number, amount: item.amount, category: item.category });
      setShowQrModal(true);
    } else {
      if (!companyBankAccount) return showToast('Thiếu cấu hình', 'Chưa cấu hình tài khoản công ty nhận tiền!', 'error');
      const prefix = item.type === 'DOANH_THU' ? 'Thu' : 'Gop von';
      const cleanCategory = encodeURIComponent(`${prefix}: ${item.requested_by}`);
      const qrUrl = `https://img.vietqr.io/image/${companyBankCode}-${companyBankAccount}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, title: item.type === 'DOANH_THU' ? '💰 QUÉT MÃ THU TIỀN KHÁCH HÀNG' : '🟢 QUÉT MÃ NỘP VỐN CÔNG TY', bankName: companyBankCode, accountNo: companyBankAccount, amount: item.amount, category: item.category });
      setShowQrModal(true);
    }
  };

  // --- CÔNG THỨC HẠCH TOÁN DOANH NGHIỆP ---
  const totalGop = ledger.filter(l => l.type === 'VON_GOP' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalDoanhThu = ledger.filter(l => l.type === 'DOANH_THU' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalChiPhi = ledger.filter(l => ((l.type === 'CHI_PHI' || l.type === 'CHI_TIEU' || l.type === 'HOAN_UNG') && l.is_paid)).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalTreo = ledger.filter(l => !l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  
  const totalVonHienVat = ledger.filter(l => l.type === 'VON_GOP' && l.sub_type === 'HIEN_VAT' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  
  const totalRemainingBalance = (totalGop + totalDoanhThu) - totalChiPhi;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-emerald-500" /> Sổ Cái & Quản Lý Giao Dịch</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Quản lý tài chính đa kỳ tích hợp các component độc lập hiệu năng cao</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button onClick={() => { setShowAddModal(true); setType('CHI_PHI'); setExpenseSource('QUY_CHUNG'); setSubType('TIEN_MAT'); }} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg">
            <Plus className="w-4 h-4" /> Thêm Giao Dịch
          </button>
          <div className="flex items-center gap-2 z-10">
            <span className="text-xs font-mono font-bold text-slate-400">Kỳ báo cáo:</span>
            <MonthPicker value={monthInput} onChange={setMonthInput} />
          </div>
        </div>
      </div>

      {/* METRICS BOX (Đã nâng cấp truyền thêm biến totalVonHienVat) */}
      <LedgerMetrics 
        totalGop={totalGop}
        totalDoanhThu={totalDoanhThu}
        totalChiPhi={totalChiPhi}
        totalTreo={totalTreo}
        totalRemainingBalance={totalRemainingBalance}
        totalVonHienVat={totalVonHienVat}
      />

      {/* COMPONENT MỚI: Hiển thị chi tiết cơ cấu vốn và công nợ của từng thành viên */}
      <CapitalShareCard ledgerData={ledger} />

      {/* TABLE BOX */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-400">Nhật Ký Hạch Toán Kỳ {selectedMonth}</span>
          <input type="text" placeholder="Tìm kiếm nội dung..." className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none w-full sm:w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>

        {/* TÍCH HỢP COMPONENT TABLE MỚI */}
        <LedgerTable 
          data={currentLedgerData}
          onTogglePaid={handleTogglePaid}
          onOpenEdit={handleOpenEdit}
          onDelete={handleDeleteLedger}
          onGenerateQr={handleGenerateVietQR}
        />
        
        {/* Pagination */}
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

      {/* POPUP ADD MODAL */}
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
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={type} onChange={e => setType(e.target.value)}>
                  {transactionTypes.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>

              {type === 'CHI_PHI' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Hình thức thanh toán chi phí:</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={expenseSource} onChange={e => setExpenseSource(e.target.value)}>
                    <option value="QUY_CHUNG">🏢 Chi từ Quỹ tiền mặt chung của xưởng</option>
                    <option value="TU_CHI_TRA">👤 Cá nhân tự chi trả bằng tiền túi (Tính vào vốn)</option>
                  </select>
                </div>
              )}

              {type === 'VON_GOP' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Phân loại danh mục nguồn vốn:</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={subType} onChange={e => setSubType(e.target.value as 'TIEN_MAT' | 'HIEN_VAT')}>
                    {contributionTypes.length > 0 ? (
                      contributionTypes.map((c: any) => <option key={c.code} value={c.code}>{c.label}</option>)
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

      {/* POPUP EDIT MODAL */}
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
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={editType} onChange={e => setEditType(e.target.value)}>
                  {transactionTypes.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>

              {editType === 'CHI_PHI' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Hình thức thanh toán chi phí:</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={editExpenseSource} onChange={e => setEditExpenseSource(e.target.value)}>
                    <option value="QUY_CHUNG">🏢 Chi từ Quỹ tiền mặt chung của xưởng</option>
                    <option value="TU_CHI_TRA">👤 Cá nhân tự chi trả bằng tiền túi (Tính vào vốn)</option>
                  </select>
                </div>
              )}

              {editType === 'VON_GOP' && (
                <div className="animate-fadeIn">
                  <label className="text-slate-400">Phân loại danh mục nguồn vốn:</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none cursor-pointer text-slate-200" value={editSubType} onChange={e => setEditSubType(e.target.value as 'TIEN_MAT' | 'HIEN_VAT')}>
                    {contributionTypes.length > 0 ? (
                      contributionTypes.map((c: any) => <option key={c.code} value={c.code}>{c.label}</option>)
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