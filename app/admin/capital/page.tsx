// app/admin/capital/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PiggyBank, Calendar, Plus, Wallet, TrendingUp, RefreshCcw, History, CheckCircle2, CircleDashed, ArrowUpRight, Edit2, Trash2, X, Save, ChevronLeft, ChevronRight, Banknote } from 'lucide-react';

export default function AdminFinancialLedger() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [transactionTypes, setTransactionTypes] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const selectedMonth = monthInput.split('-').reverse().join('/');

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

  // PHÂN TRANG CHO SỔ CÁI
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; 

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('id, full_name').eq('is_active', true);
      setEmployees(emps || []);
      if (emps && emps.length > 0 && !reporter) setReporter(emps[0].full_name);

      const { data: meta } = await supabase.from('system_metadata').select('data').eq('name', 'Danh mục Nghiệp vụ').maybeSingle();
      if (meta && meta.data) {
        setTransactionTypes(meta.data);
        if (meta.data.length > 0 && !type) setType(meta.data[0].code);
      }

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

  const totalPages = Math.ceil(ledger.length / itemsPerPage);
  const currentLedgerData = ledger.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // HÀM: THÊM MỚI GIAO DỊCH
  const handleInsertLedger = async () => {
    if (!category.trim() || !amount) { alert('Vui lòng điền đủ nội dung và số tiền!'); return; }
    
    const { error } = await supabase.from('financial_ledger').insert([{ 
      type, category: category.trim(), amount: Number(amount), requested_by: reporter, month_period: selectedMonth, is_paid: isPaid 
    }]);

    if (error) {
      alert('❌ Lỗi ghi sổ cái: ' + error.message);
    } else {
      setCategory(''); setAmount(''); setCurrentPage(1); loadData();
      alert('✨ Đã ghi sổ thành công!');
    }
  };

  // HÀM: BẬT POPUP SỬA DỮ LIỆU
  const handleOpenEdit = (item: any) => {
    setEditingId(item.id);
    setEditType(item.type);
    setEditCategory(item.category);
    setEditAmount(item.amount.toString());
    setEditReporter(item.requested_by);
    setEditIsPaid(item.is_paid);
    setShowEditModal(true);
  };

  // HÀM: LƯU CẬP NHẬT TỪ POPUP XUỐNG DB
  const handleSaveEdit = async () => {
    if (!editCategory.trim() || !editAmount) { alert('Vui lòng điền đủ nội dung và số tiền cần sửa!'); return; }
    if (!editingId) return;

    const { error } = await supabase.from('financial_ledger').update({
      type: editType,
      category: editCategory.trim(),
      amount: Number(editAmount),
      requested_by: editReporter,
      is_paid: editIsPaid
    }).eq('id', editingId);

    if (error) {
      alert('❌ Lỗi DB: ' + error.message);
      return;
    }

    setLedger(prev => prev.map(item => item.id === editingId ? {
      ...item,
      type: editType,
      category: editCategory.trim(),
      amount: Number(editAmount),
      requested_by: editReporter,
      is_paid: editIsPaid
    } : item));

    setShowEditModal(false);
    setEditingId(null);
    alert('✨ Đã cập nhật thay đổi giá cả thành công!');
  };

  // HÀM: ĐỔI TRẠNG THÁI THANH TOÁN NHANH TRÊN BẢNG
  const handleTogglePaid = async (id: number, currentStatus: boolean) => {
    setLedger(prev => prev.map(l => l.id === id ? { ...l, is_paid: !currentStatus } : l));
    const { error } = await supabase.from('financial_ledger').update({ is_paid: !currentStatus }).eq('id', id);
    if (error) { alert('❌ Lỗi: ' + error.message); loadData(); }
  };

  // HÀM: XÓA BẢN GHI
  const handleDeleteLedger = async (id: number) => {
    if (window.confirm('⚠️ Sếp có chắc chắn muốn xóa vĩnh viễn dòng ghi sổ tài chính này không?')) {
      setLedger(prev => prev.filter(l => l.id !== id));
      const { error } = await supabase.from('financial_ledger').delete().eq('id', id);
      if (error) { alert('❌ Lỗi: ' + error.message); loadData(); } 
      else { alert('🗑️ Đã xóa dòng dữ liệu thành công!'); }
    }
  };

  // THUẬT TOÁN ĐỐI SOÁT TÀI CHÍNH HỢP NHẤT
  const totalGop = ledger.filter(l => l.type === 'VON_GOP' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalDoanhThu = ledger.filter(l => l.type === 'DOANH_THU' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalChi = ledger.filter(l => l.type === 'CHI_TIEU' && l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  const totalTreo = ledger.filter(l => !l.is_paid).reduce((sum, l) => sum + Number(l.amount), 0);
  
  // Thuật toán nảy số: Số tiền còn lại thực tế trong két = (Vốn + Doanh thu) - Chi phí
  const totalRemainingBalance = (totalGop + totalDoanhThu) - totalChi;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><PiggyBank className="w-5 h-5 text-emerald-500" /> Sổ Cái & Quản Lý Giao Dịch Tài Chính</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Hệ thống đối soát quỹ tiền mặt, doanh thu thực tế và các khoản treo nợ</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-blue-400" /> Kỳ báo cáo: 
          <input type="month" className="bg-slate-950 border border-slate-800 rounded p-1 text-slate-200 focus:outline-none [color-scheme:dark] font-bold" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
        </div>
      </div>

      {/* METRICS CARD MA TRẬN 5 CỘT HIỂN THỊ RÕ RÀNG */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs font-bold uppercase tracking-wider">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Vốn Đầu Tư</p><p className="text-xs font-black text-emerald-400 mt-1 font-mono">+{totalGop.toLocaleString()} đ</p></div><Wallet className="w-4 h-4 text-emerald-500" /></div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Doanh Thu</p><p className="text-xs font-black text-blue-400 mt-1 font-mono">+{totalDoanhThu.toLocaleString()} đ</p></div><ArrowUpRight className="w-4 h-4 text-blue-400" /></div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Chi phí Đã trả</p><p className="text-xs font-black text-red-400 mt-1 font-mono">-{totalChi.toLocaleString()} đ</p></div><TrendingUp className="w-4 h-4 text-red-400" /></div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center"><div><p className="text-slate-500 text-[10px]">Khoản Treo Nợ</p><p className="text-xs font-black text-amber-400 mt-1 font-mono">{totalTreo.toLocaleString()} đ</p></div><History className="w-4 h-4 text-amber-400" /></div>
        
        {/* THẺ CHỈ SỐ MỚI THÊM: SỐ TIỀN CÒN LẠI TRONG KÉT */}
        <div className="bg-slate-900 border-2 border-cyan-500/30 p-4 rounded-2xl flex justify-between items-center shadow-lg shadow-cyan-950/20">
          <div>
            <p className="text-cyan-400 text-[10px]">Số tiền còn lại</p>
            <p className="text-xs font-black text-cyan-400 mt-1 font-mono">{totalRemainingBalance.toLocaleString()} đ</p>
          </div>
          <Banknote className="w-4 h-4 text-cyan-400 animate-pulse" />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* FORM GHI SỔ */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3 h-fit text-xs">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-2 mb-2"><Plus className="w-4 h-4 text-blue-500" /><h3 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Ghi Sổ Mới</h3></div>
          <div><label className="text-slate-400 font-medium">Nghiệp vụ:</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none font-semibold text-slate-200" value={type} onChange={(e) => setType(e.target.value)}>
              {transactionTypes.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}
            </select>
          </div>
          <div><label className="text-slate-400 font-medium">Nội dung khoản mục:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" placeholder="Nội dung phát sinh..." value={category} onChange={(e) => setCategory(e.target.value)} /></div>
          <div><label className="text-slate-400 font-medium">Số tiền giá cả (VND):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono focus:outline-none text-amber-400 font-bold text-sm" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
          <div><label className="text-slate-400 font-medium">Người liên quan:</label>
            <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none font-semibold text-slate-200" value={reporter} onChange={(e) => setReporter(e.target.value)}>
              <option value="Admin (Hệ thống)">Admin (Hệ thống)</option>
              {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
            </select>
          </div>
          <div className="pt-2">
            <label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition">
              <input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4" />
              <span className="text-slate-300 font-bold">{isPaid ? '✅ Tiền ĐÃ THANH TOÁN (Vào két)' : '⏳ Khoản này đang TREO NỢ'}</span>
            </label>
          </div>
          <button onClick={handleInsertLedger} className="w-full bg-blue-600 hover:bg-blue-700 font-bold p-3 rounded-xl uppercase tracking-wider text-white mt-2 shadow-lg">Lưu vào kỳ {selectedMonth}</button>
        </div>

        {/* BẢNG DỮ LIỆU CÓ PHÂN TRANG */}
        <div className="md:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
              <tr>
                <th className="p-4">Nội dung chi tiết</th>
                <th className="p-4">Nhân sự</th>
                <th className="p-4">Trạng thái</th>
                <th className="p-4 text-right">Biên độ / Số tiền</th>
                <th className="p-4 text-center">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {currentLedgerData.length === 0 ? (
                <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-mono">Chưa phát sinh dữ liệu nào trong kỳ này.</td></tr>
              ) : currentLedgerData.map(l => (
                <tr key={l.id} className="hover:bg-slate-950/20 transition text-[11px]">
                  <td className="p-4 font-bold text-slate-200">{l.type === 'CHI_TIEU' ? '❌' : l.type === 'VON_GOP' ? '🟢' : '💰'} {l.category}</td>
                  <td className="p-4 text-slate-400 font-medium">{l.requested_by}</td>
                  <td className="p-4">
                    <button onClick={() => handleTogglePaid(l.id, l.is_paid)} className={`px-2 py-1.5 flex items-center gap-1.5 rounded-lg font-bold border text-[10px] transition ${l.is_paid ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-500'}`}>
                      {l.is_paid ? <><CheckCircle2 className="w-3.5 h-3.5" /> Đã Trả</> : <><CircleDashed className="w-3.5 h-3.5" /> Nợ/Treo</>}
                    </button>
                  </td>
                  <td className={`p-4 text-right font-mono font-bold text-sm ${l.type === 'CHI_TIEU' ? 'text-red-400' : 'text-emerald-400'}`}>{l.type === 'CHI_TIEU' ? '-' : '+'}{Number(l.amount).toLocaleString()} đ</td>
                  <td className="p-4 text-center space-x-1.5">
                    <button onClick={() => handleOpenEdit(l)} className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg text-blue-400 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDeleteLedger(l.id)} className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-red-950/30 rounded-lg text-red-500 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* FOOTER THANH PHÂN TRANG */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center p-4 bg-slate-950/50 border-t border-slate-800 text-xs shrink-0">
              <span className="text-[10px] text-slate-500 font-mono">Trang {currentPage} / {totalPages} (Tổng {ledger.length} giao dịch)</span>
              <div className="flex gap-2">
                <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg disabled:opacity-30 transition"><ChevronLeft className="w-4 h-4 text-slate-300" /></button>
                <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="p-1.5 bg-slate-900 border border-slate-700 rounded-lg disabled:opacity-30 transition"><ChevronRight className="w-4 h-4 text-slate-300" /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* POPUP SỬA ĐỔI DỮ LIỆU */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-xs shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-200 uppercase flex items-center gap-1.5">📝 Điều chỉnh dòng tiền ghi sổ</h3>
              <button onClick={() => { setShowEditModal(false); setEditingId(null); }} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold">Nghiệp vụ tài chính:</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-slate-200 focus:outline-none font-semibold" value={editType} onChange={(e) => setEditType(e.target.value)}>
                  {transactionTypes.map((t: any) => <option key={t.code} value={t.code}>{t.label}</option>)}
                </select>
              </div>
              <div><label className="text-slate-400 font-bold">Nội dung khoản mục:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-slate-200 focus:outline-none" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold">Số tiền giá cả (VND):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-amber-400 font-black focus:outline-none text-base" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold">Người thực hiện:</label>
                <select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-slate-200 focus:outline-none font-semibold" value={editReporter} onChange={(e) => setEditReporter(e.target.value)}>
                  <option value="Admin (Hệ thống)">Admin (Hệ thống)</option>
                  {employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}
                </select>
              </div>
              <div className="pt-2"><label className="flex items-center gap-2 cursor-pointer p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-blue-500 transition"><input type="checkbox" checked={editIsPaid} onChange={(e) => setEditIsPaid(e.target.checked)} className="accent-blue-500 w-4 h-4" /><span className="text-slate-200 font-bold">{editIsPaid ? '✅ Tiền ĐÃ THANH TOÁN hoàn toàn' : '⏳ Chuyển về trạng thái TREO NỢ'}</span></label></div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button onClick={() => { setShowEditModal(false); setEditingId(null); }} className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 p-3 rounded-xl font-bold text-slate-400 text-center transition">Hủy bỏ</button>
              <button onClick={handleSaveEdit} className="flex-1 bg-blue-600 hover:bg-blue-700 p-3 rounded-xl font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg"><Save className="w-4 h-4" /> Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}