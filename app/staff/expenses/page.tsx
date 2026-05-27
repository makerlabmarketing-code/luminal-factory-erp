// app/staff/expenses/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Banknote, Save, Image as ImageIcon, RefreshCcw } from 'lucide-react';

export default function StaffExpensesPage() {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [expenses, setExpenses] = useState<any[]>([]);
  const [worker, setWorker] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expBillUrl, setExpBillUrl] = useState('');

  const loadExpensesData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Khớp chính xác danh tính ông Nhân sự sở hữu token này
      const { data: emp } = await supabase.from('employees').select('*').eq('qr_token', token).maybeSingle();
      if (emp) {
        setWorker(emp);
        const { data: exps } = await supabase.from('financial_ledger').select('*').eq('requested_by', emp.full_name).order('id', { ascending: false });
        setExpenses(exps || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadExpensesData(); }, [token]);

  const handleSubmitExpense = async () => {
    if (!worker) return;
    if (!expCategory.trim() || !expAmount) return showToast('Thiếu thông tin', 'Sếp vui lòng điền đủ tên vật tư và số tiền chi!', 'error');
    const period = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`.split('-').reverse().join('/');

    try {
      const { error } = await supabase.from('financial_ledger').insert([{
        type: 'CHI_TIEU',
        category: expCategory.trim(),
        amount: Number(expAmount),
        bill_url: expBillUrl.trim(),
        requested_by: worker.full_name, // Khóa cố định đúng tên người sở hữu Token, chặn đứng lỗi nhảy tài khoản
        is_paid: false,
        month_period: period
      }]);

      if (error) throw error;
      setExpCategory(''); setExpAmount(''); setExpBillUrl('');
      showToast('Nộp phiếu thành công', 'Yêu cầu thanh toán hoàn ứng vật tư đã treo lên sổ cái chờ Admin duyệt!', 'success');
      loadExpensesData();
    } catch (err: any) {
      showToast('Lỗi lưu trữ', err.message, 'error');
    }
  };

  if (loading) return <div className="p-12 text-center text-xs font-mono text-slate-500 bg-slate-950 min-h-screen flex items-center justify-center gap-2"><RefreshCcw className="w-4 h-4 animate-spin" />Đang tải dữ liệu quỹ đối soát...</div>;

  return (
    <div className="p-4 max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs shadow-xl">
        <h3 className="text-[10px] font-black uppercase text-slate-400 block border-b border-slate-800 pb-2 flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-emerald-400" /> Kê khai vật tư phát sinh</h3>
        <div><label className="text-slate-400 font-bold">Tên vật tư đồ chi mua:</label><input type="text" placeholder="Ví dụ: Khớp nối đồng 12mm" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-slate-200" value={expCategory} onChange={(e) => setExpCategory(e.target.value)} /></div>
        <div><label className="text-slate-400 font-bold">Số tiền mặt thực chi (VND):</label><input type="number" placeholder="Nhập số tiền..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-amber-400 font-bold" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} /></div>
        <div><label className="text-slate-400 font-bold">Đường dẫn link chứng từ hóa đơn Bill:</label><input type="text" placeholder="Dán link ảnh Zalo / Drive đối soát..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-blue-400 font-mono" value={expBillUrl} onChange={(e) => setExpBillUrl(e.target.value)} /></div>
        <button onClick={handleSubmitExpense} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black p-3.5 rounded-xl flex justify-center gap-1.5 transition text-xs shadow-md uppercase tracking-wider mt-2"><Save className="w-4 h-4" /> Nộp phiếu hoàn ứng</button>
      </div>

      <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 text-[10px] font-bold uppercase text-slate-400">Sổ đối soát quỹ chi cá nhân của tôi</div>
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] font-bold">
            <tr><th className="p-3">Nội dung mua sắm vật tư</th><th className="p-3">Giá trị tiền chi</th><th className="p-3 text-center">Trạng thái</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
            {expenses.length === 0 ? (
              <tr><td colSpan={3} className="p-6 text-center text-slate-500 font-mono italic">Sếp chưa có dòng kê khai chi phí phát sinh hoàn ứng nào.</td></tr>
            ) : expenses.map(e => (
              <tr key={e.id} className="hover:bg-slate-950/10 transition">
                <td className="p-3">
                  <p className="font-bold text-slate-200">{e.category}</p>
                  {e.bill_url && <a href={e.bill_url} target="_blank" rel="noreferrer" className="text-blue-400 flex items-center gap-0.5 mt-1 text-[10px] hover:underline font-mono"><ImageIcon className="w-3 h-3"/> Mở chứng từ ảnh hóa đơn</a>}
                </td>
                <td className="p-3 font-mono text-red-400 font-bold">{Number(e.amount).toLocaleString()} đ</td>
                <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded font-black text-[9px] border ${e.is_paid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>{e.is_paid ? 'ĐÃ TRẢ' : 'TREO CHỜ'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}