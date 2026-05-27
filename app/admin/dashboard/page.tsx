// app/admin/dashboard/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { LayoutDashboard, Wallet, ArrowUpRight, ArrowDownRight, Users, Box, ShieldAlert, RefreshCcw } from 'lucide-react';

export default function AdminDashboardOverview() {
  const [stats, setStats] = useState({
    totalVongopAllTime: 0,
    totalChitieuAllTime: 0,
    totalStaffCount: 0,
    activeTasksCount: 0
  });
  const [loading, setLoading] = useState(true);

  const fetchGlobalMetrics = async () => {
    setLoading(true);
    try {
      // 1. Quét toàn bộ dòng tiền lũy kế mọi thời đại (Gồm cả các tháng trước)
      const { data: ledgerData } = await supabase.from('financial_ledger').select('type, amount');
      
      let allTimeVon = 0;
      let allTimeChi = 0;
      
      ledgerData?.forEach(item => {
        if (item.type === 'VON_GOP') allTimeVon += Number(item.amount);
        if (item.type === 'CHI_TIEU') allTimeChi += Number(item.amount);
      });

      // 2. Đếm tổng số nhân sự thực tế trong DB
      const { count: staffCount } = await supabase.from('employees').select('*', { count: 'exact', head: true });

      // 3. Đếm số lượng Concept đang triển khai
      const { count: taskCount } = await supabase.from('production_tasks').select('*', { count: 'exact', head: true });

      setStats({
        totalVongopAllTime: allTimeVon,
        totalChitieuAllTime: allTimeChi,
        totalStaffCount: staffCount || 0,
        activeTasksCount: taskCount || 0
      });
    } catch (e) {
      console.error('Lỗi tính toán chỉ số dashboard:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGlobalMetrics();
  }, []);

  // Tính số quỹ tiền mặt hiện tại còn lại trong két
  const currentCashInHand = stats.totalVongopAllTime - stats.totalChitieuAllTime;

  if (loading) return <div className="p-6 text-xs text-center font-mono text-slate-500"><RefreshCcw className="w-4 h-4 animate-spin inline mr-2" /> Đang đồng bộ ma trận dữ liệu tổng đài...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-base font-bold">Trung Tâm Điều Hành & Giám Sát Dòng Vốn Lũy Kế</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Dữ liệu tài chính hợp nhất từ toàn bộ lịch sử ghi sổ kế toán</p>
          </div>
        </div>
        <button onClick={fetchGlobalMetrics} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition" title="Làm mới dữ liệu">
          <RefreshCcw className="w-4 h-4" />
        </button>
      </div>

      {/* THẺ CHỈ SỐ LŨY KẾ KHÉP KÍN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* KÉT TIỀN MẶT CÒN LẠI */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 shadow-xl">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Dòng Tiền Mặt Còn Lại</span>
            <Wallet className="w-4 h-4 text-blue-500" />
          </div>
          <p className={`text-base font-black font-mono ${currentCashInHand >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
            {currentCashInHand.toLocaleString()} đ
          </p>
          <p className="text-[9px] text-slate-500">Tiền khả dụng thực tế trong két</p>
        </div>

        {/* TỔNG VỐN ĐÃ GÓP */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 shadow-xl">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Tổng Vốn Nạp Lũy Kế</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-base font-black font-mono text-emerald-400">
            {stats.totalVongopAllTime.toLocaleString()} đ
          </p>
          <p className="text-[9px] text-slate-500">Tổng tiền cổ đông đã nạp</p>
        </div>

        {/* TỔNG CHI TIÊU QUÁ KHỨ (NỢ CẦN HOÀN ỨNG) */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 shadow-xl border-l-2 border-l-amber-600">
          <div className="flex justify-between items-center text-amber-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Nợ Chi Tiêu Cần Hoàn Trả</span>
            <ArrowDownRight className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-base font-black font-mono text-amber-400">
            {stats.totalChitieuAllTime.toLocaleString()} đ
          </p>
          <p className="text-[9px] text-slate-500">Sẽ chi trả từ lợi nhuận thương mại</p>
        </div>

        {/* SỐ LƯỢNG Nhân sự SẢN XUẤT */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2 shadow-xl">
          <div className="flex justify-between items-center text-slate-500 text-[10px] font-bold uppercase tracking-wider">
            <span>Đội Ngũ Nhân sự Đang Chạy Ca</span>
            <Users className="w-4 h-4 text-purple-400" />
          </div>
          <p className="text-base font-black font-mono text-purple-400">
            {stats.totalStaffCount} nhân sự
          </p>
          <p className="text-[9px] text-slate-500">Đồng bộ thời gian thực từ DB</p>
        </div>

      </div>

      {/* KHỐI CẢNH BÁO CHIẾN LƯỢC DÒNG VỐN PHÙ HỢP VỚI QUY MÔ XƯỞNG */}
      <div className="bg-amber-950/20 border border-amber-900/40 p-4 rounded-2xl flex gap-3 items-start">
        <ShieldAlert className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs space-y-1">
          <h4 className="font-bold text-amber-400 uppercase text-[10px] tracking-wider">Chỉ thị điều phối vốn khởi nghiệp:</h4>
          <p className="text-slate-400 leading-relaxed text-[11px]">
            Hệ thống ghi nhận tổng chi phí out-of-pocket qua các thời kỳ là <strong className="text-slate-200">{stats.totalChitieuAllTime.toLocaleString()} đ</strong>. 
            Theo kế hoạch vận hành tối giản, quỹ tiền mặt còn lại sẽ ưu tiên khóa chặt để thanh toán **vật tư sản xuất cốt lõi (Resin, phôi mẫu)** và **lương cứng của Nhân sự**. Toàn bộ các khoản chi ngoài danh mục này được treo tạm tính và sẽ tự động tất toán sau khi chuỗi đại lý kích hoạt doanh thu bán hàng.
          </p>
        </div>
      </div>

    </div>
  );
}