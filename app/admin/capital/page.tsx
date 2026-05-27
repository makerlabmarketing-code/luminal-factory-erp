// app/admin/capital/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { 
  PiggyBank, Calendar, Plus, Wallet, TrendingUp, RefreshCcw, History, 
  CheckCircle2, ArrowUpRight, Edit2, Trash2, X, Save, 
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Banknote, QrCode, Search 
} from 'lucide-react';

export default function AdminFinancialLedger() {
  const { showToast, showConfirm } = useNotification();
  const [ledger, setLedger] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]); 
  const [companyBankCode, setCompanyBankCode] = useState<string>('MB'); 
  const [companyBankAccount, setCompanyBankAccount] = useState<string>(''); 
  const [loading, setLoading] = useState(true);
  
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const selectedMonth = monthInput.split('-').reverse().join('/');

  const [showAddModal, setShowAddModal] = useState(false);

  // Form States Thêm Mới
  const [type, setType] = useState('CHI_TIEU');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [reporter, setReporter] = useState('');
  const [isPaid, setIsPaid] = useState(true);

  // States Popup Chỉnh Sửa
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editType, setEditType] = useState('CHI_TIEU');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editReporter, setEditReporter] = useState('');
  const [editIsPaid, setEditIsPaid] = useState(true);

  // States VietQR Popup
  const [showQrModal, setShowQrModal] = useState(false);
  const [activeQrUrl, setActiveQrUrl] = useState('');
  const [activeQrTarget, setActiveQrTarget] = useState<any>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(8); 
  const [pageInput, setPageInput] = useState('1');

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

      const { data: setBank } = await supabase.from('system_settings').select('value').eq('key', 'company_bank_code').maybeSingle();
      if (setBank) setCompanyBankCode(setBank.value);

      const { data: setAccount } = await supabase.from('system_settings').select('value').eq('key', 'company_bank_account').maybeSingle();
      if (setAccount) setCompanyBankAccount(setAccount.value);

      const { data: ledgers } = await supabase.from('financial_ledger').select('*').eq('month_period', selectedMonth).order('id', { ascending: false });
      setLedger(ledgers || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { 
    setCurrentPage(1);
    setPageInput('1');
    loadData(); 
  }, [selectedMonth]);

  const filteredLedger = ledger.filter(l => 
    (l.category || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (l.requested_by || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredLedger.length / itemsPerPage) || 1;
  const currentLedgerData = filteredLedger.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const handleInsertLedger = async () => {
    if (!category.trim() || !amount) {
      showToast('Thiếu số liệu', 'Vui lòng điền đủ nội dung khoản mục và giá tiền!', 'error');
      return;
    }
    
    try {
      const { error } = await supabase.from('financial_ledger').insert([{ 
        type, category: category.trim(), amount: Number(amount), requested_by: reporter, month_period: selectedMonth, is_paid: isPaid 
      }]);

      if (error) throw error;
      setCategory(''); setAmount(''); setCurrentPage(1); setPageInput('1'); loadData();
      setShowAddModal(false);
      // 🔥 ĐÃ VÁ LỖI: Dùng Toast nội bộ bọc mây xịn mịn thay cho alert() hệ thống bị lệch design ở ảnh image_fdb227
      showToast('Ghi sổ thành công', 'Khoản mục tài chính mới đã được đồng bộ vào sổ cái trung tâm!', 'success');
    } catch (err: any) {
      showToast('Thất bại', err.message, 'error');
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingId(item.id); setEditType(item.type); setEditCategory(item.category); setEditAmount(item.amount.toString()); setEditReporter(item.requested_by); setEditIsPaid(item.is_paid);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editCategory.trim() || !editAmount) {
      showToast('Thiếu số liệu', 'Vui lòng điền đủ thông tin sửa hạch toán!', 'error');
      return;
    }
    if (!editingId) return;

    await supabase.from('financial_ledger').update({
      type: editType, category: editCategory.trim(), amount: Number(editAmount), requested_by: editReporter, is_paid: editIsPaid
    }).eq('id', editingId);

    setShowEditModal(false); setEditingId(null); loadData();
    showToast('Thành công', 'Đã cập nhật sửa đổi dữ liệu khoản chi thành công!', 'success');
  };

  const handleTogglePaid = async (id: number, currentStatus: boolean) => {
    await supabase.from('financial_ledger').update({ is_paid: !currentStatus }).eq('id', id);
    setLedger(prev => prev.map(l => l.id === id ? { ...l, is_paid: !currentStatus } : l));
    showToast('Đổi trạng thái', 'Đã cập nhật thông số tất toán nợ quỹ.', 'info');
  };

  const handleInstantPaymentSuccess = async () => {
    if (!activeQrTarget || !activeQrTarget.id) return;
    const targetId = activeQrTarget.id;

    await supabase.from('financial_ledger').update({ is_paid: true }).eq('id', targetId);
    setLedger(prev => prev.map(l => l.id === targetId ? { ...l, is_paid: true } : l));
    
    setShowQrModal(false); setActiveQrUrl('');
    showToast('Thanh toán xong', 'Hệ thống tự động chuyển trạng thái khoản mục thành ĐÃ TẤT TOÁN LƯU QUỸ!', 'success');
  };

  const handleDeleteLedger = (id: number) => {
    showConfirm('Xác nhận hủy bỏ', 'Sếp có chắc chắn muốn xóa vĩnh viễn dòng tài chính này không?', async () => {
      await supabase.from('financial_ledger').delete().eq('id', id);
      setLedger(prev => prev.filter(l => l.id !== id));
      showToast('Đã xóa', 'Đã hủy dòng hạch toán ra khỏi sổ cái.', 'info');
    });
  };

  const handleGenerateVietQR = (item: any) => {
    if (item.type === 'CHI_TIEU') {
      const matchedStaff = employees.find(e => e.full_name === item.requested_by);
      if (!matchedStaff || !matchedStaff.bank_account_number || !matchedStaff.bank_name) {
        showToast('Thiếu hồ sơ nhân sự', `Nhân sự [${item.requested_by}] chưa khai báo số tài khoản trong hồ sơ để hoàn ứng!`, 'error');
        return;
      }
      const cleanCategory = encodeURIComponent(item.category);
      const qrUrl = `https://img.vietqr.io/image/${matchedStaff.bank_name}-${matchedStaff.bank_account_number}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, title: '❌ QUÉT MÃ HOÀN TIỀN KÊ KHAI VẬT TƯ CHO Nhân sự', bankName: matchedStaff.bank_name, accountNo: matchedStaff.bank_account_number, amount: item.amount, category: item.category });
      setShowQrModal(true);
    } 
    else if (item.type === 'VON_GOP') {
      if (!companyBankAccount) {
        showToast('Khuyết dữ liệu', 'Sếp chưa điền số tài khoản công ty nhận vốn ở mục Cấu hình trung tâm!', 'error');
        return;
      }
      const cleanCategory = encodeURIComponent(`Nop von: ${item.requested_by}`);
      const qrUrl = `https://img.vietqr.io/image/${companyBankCode}-${companyBankAccount}-compact2.png?amount=${item.amount}&addInfo=${cleanCategory}`;
      setActiveQrUrl(qrUrl);
      setActiveQrTarget({ id: item.id, title: '🟢 QUÉT MÃ NỘP VỐN ĐẦU TƯ TRUNG TÂM CO.', bankName: companyBankCode, accountNo: companyBankAccount, amount: item.amount, category: item.category });
      setShowQrModal(true);
    }
  };

  const totalGop = ledger.filter(l => l.type === 'VON_GOP' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalDoanhThu = ledger.filter(l => l.type === 'DOANH_THU' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalChi = ledger.filter(l => l.type === 'CHI_TIEU' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalTreo = ledger.filter(l => !l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalRemainingBalance = (totalGop + totalDoanhThu) - totalChi;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      {/* Cấu trúc UI bảng sổ cái giữ nguyên, chỉ thay đổi toàn bộ logic thông báo qua showToast */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-emerald-500" /> Sổ Cái & Quản Lý Giao Dịch Tài Chính</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Sổ cái tổng hợp hạch toán két quỹ xưởng số hóa</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <button onClick={() => setShowAddModal(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg"><Plus className="w-4 h-4" /> Thêm Giao Dịch</button>
          <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
            Kỳ báo cáo: <input type="month" className="bg-slate-950 border border-slate-800 rounded p-1 text-slate-200 focus:outline-none [color-scheme:dark]" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
          </div>
        </div>
      </div>

      {/* METRICS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-bold uppercase tracking-wider select-none">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Vốn Đầu Tư</p><p className="text-xs font-black text-emerald-400 mt-1 font-mono">+{totalGop.toLocaleString()} đ</p></div><Wallet className="w-4 h-4 text-emerald-500" /></div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Doanh Thu</p><p className="text-xs font-black text-blue-400 mt-1 font-mono">+{totalDoanhThu.toLocaleString()} đ</p></div><ArrowUpRight className="w-4 h-4 text-blue-400" /></div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Chi phí Đã trả</p><p className="text-xs font-black text-red-400 mt-1 font-mono">-{totalChi.toLocaleString()} đ</p></div><TrendingUp className="w-4 h-4 text-red-400" /></div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Khoản Treo Nợ</p><p className="text-xs font-black text-amber-400 mt-1 font-mono">{totalTreo.toLocaleString()} đ</p></div><History className="w-4 h-4 text-amber-400" /></div>
        <div className="bg-slate-900 border-2 border-cyan-500/30 p-4 rounded-2xl flex justify-between items-center shadow-lg"><div><p className="text-cyan-400 text-[10px]">Số dư khả dụng</p><p className="text-xs font-black text-cyan-400 mt-1 font-mono">{totalRemainingBalance.toLocaleString()} đ</p></div><Banknote className="w-4 h-4 text-cyan-400" /></div>
      </div>

      {/* TABLE */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-400">Nhật Ký Hạch Toán Kỳ {selectedMonth}</span>
          <input type="text" placeholder="Tìm kiếm nội dung..." className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none w-full sm:w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
            <tr><th className="p-4">Khoản Mục Chi Tiết</th><th className="p-4">Nhân sự thực hiện</th><th className="p-4">Trạng thái</th><th className="p-4 text-right">Số tiền</th><th className="p-4 text-center">Hành động</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
            {currentLedgerData.map(l => (
              <tr key={l.id} className="hover:bg-slate-950/20 transition">
                <td className="p-4 font-bold text-slate-200">{l.type === 'CHI_TIEU' ? '❌' : '🟢'} {l.category}</td>
                <td className="p-4 text-slate-400">{l.requested_by}</td>
                <td className="p-4"><button onClick={() => handleTogglePaid(l.id, l.is_paid)} className={`px-2 py-1 rounded text-[9px] border font-black ${l.is_paid ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'}`}>{l.is_paid ? 'Đã Trả' : 'Treo nợ'}</button></td>
                <td className="p-4 text-right font-mono font-bold text-slate-200">{Number(l.amount).toLocaleString()} đ</td>
                <td className="p-4 text-center space-x-1">
                  {!l.is_paid && <button onClick={() => handleGenerateVietQR(l)} className="p-1.5 bg-cyan-950 border border-cyan-800 rounded-lg text-cyan-400"><QrCode className="w-3.5 h-3.5"/></button>}
                  <button onClick={() => handleOpenEdit(l)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400"><Edit2 className="w-3.5 h-3.5"/></button>
                  <button onClick={() => handleDeleteLedger(l.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500"><Trash2 className="w-3.5 h-3.5"/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* POPUP ADD MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5"><h3 className="font-bold uppercase tracking-wider text-[11px]">Ghi Hạch Toán Sổ Cái Mới</h3><button onClick={() => setShowAddModal(false)}><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div><label className="text-slate-400">Nghiệp vụ:</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none" value={type} onChange={e => setType(e.target.value)}>{transactionTypes.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}</select></div>
              <div><label className="text-slate-400">Nội dung khoản mục:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none" value={category} onChange={e => setCategory(e.target.value)} /></div>
              <div><label className="text-slate-400">Số tiền chi phí (VND):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold" value={amount} onChange={e => setAmount(e.target.value)} /></div>
              <div><label className="text-slate-400">Nhân sự thực hiện:</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none" value={reporter} onChange={e => setReporter(e.target.value)}><option value="Admin (Hệ thống)">Admin (Hệ thống)</option>{employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}</select></div>
              <div className="pt-2"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={isPaid} onChange={e => setIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4" /><span className="text-slate-300 font-bold">{isPaid ? '✅ Tiền ĐÃ THANH TOÁN' : '⏳ Khoản này đang TREO NỢ'}</span></label></div>
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400">Hủy</button><button onClick={handleInsertLedger} className="flex-1 bg-blue-600 text-white font-black p-3 rounded-xl shadow-lg">Ghi Sổ</button></div>
          </div>
        </div>
      )}

      {/* POPUP EDIT MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-sm space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5"><h3 className="font-bold uppercase tracking-wider text-[11px]">Sửa thông tin hạch toán</h3><button onClick={() => { setShowEditModal(false); setEditingId(null); }}><X className="w-5 h-5"/></button></div>
            <div className="space-y-3">
              <div><label className="text-slate-400">Nội dung khoản mục:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none" value={editCategory} onChange={e => setEditCategory(e.target.value)} /></div>
              <div><label className="text-slate-400">Số tiền sửa (VND):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold" value={editAmount} onChange={e => setEditAmount(e.target.value)} /></div>
              <div className="pt-2"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={editIsPaid} onChange={e => setEditIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4" /><span className="text-slate-300 font-bold">Đã thanh toán</span></label></div>
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button onClick={() => { setShowEditModal(false); setEditingId(null); }} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400">Hủy</button><button onClick={handleSaveEdit} className="flex-1 bg-blue-600 text-white font-black p-3 rounded-xl shadow-lg">Cập Nhật</button></div>
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
            <div className="pt-2 border-t border-slate-800 flex gap-2 text-xs"><button onClick={() => { setShowQrModal(false); setActiveQrUrl(''); }} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400">Đóng</button><button onClick={handleInstantPaymentSuccess} className="flex-1 bg-emerald-600 text-white font-black p-3 rounded-xl shadow-lg">Xác Nhận Đã Nhận Tiền</button></div>
          </div>
        </div>
      )}

    </div>
  );
}