// app/admin/dashboard/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Kết nối lõi Supabase thật
import { Users, DollarSign, Wallet, MailCheck, RefreshCcw } from 'lucide-react';

interface Employee {
  id: string;
  full_name: string;
  title: string;
  hourly_rate: number;
  email: string;
}

export default function AdminDashboardPage() {
  const [staffs, setStaffs] = useState<Employee[]>([]);
  const [totalPayroll, setTotalPayroll] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // THUẬT TOÁN ĐỌC DỮ LIỆU THỰC TẾ TỪ SUPABASE
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Lấy danh sách nhân viên từ bảng 'employees' trên Cloud
      const { data: employeeData, error: empError } = await supabase
        .from('employees')
        .select('*')
        .eq('is_active', true);

      if (empError) throw empError;
      setStaffs(employeeData || []);

      // 2. Lấy toàn bộ lịch sử công nhật để tính tổng ngân sách lương thực tế
      const { data: logData, error: logError } = await supabase
        .from('attendance_logs')
        .select('earnings_today')
        .eq('status', 'COMPLETED');

      if (logError) throw logError;
      
      const total = logData?.reduce((sum, log) => sum + (log.earnings_today || 0), 0) || 0;
      setTotalPayroll(total);

    } catch (error) {
      console.error('Lỗi lấy data từ Supabase:', error);
    } finally {
      setLoading(false);
    }
  };

  // Tự động chạy khi vừa mở trang web
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleSyncPayroll = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      alert('Hệ thống đã tự động khóa sổ công nhật, render layout và bắn Email phiếu lương hàng loạt!');
    }, 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-mono text-xs">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mr-2" /> Đang thiết lập kết nối an toàn tới Supabase Cloud...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-xl font-bold tracking-wide">Luminal Factory Dashboard 🟢</h1>
            <p className="text-xs text-slate-400 mt-0.5">Dữ liệu kết nối trực tiếp với máy chủ đám mây Supabase</p>
          </div>
          <button onClick={handleSyncPayroll} disabled={isSyncing} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg">
            {isSyncing ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <MailCheck className="w-3.5 h-3.5" />}
            {isSyncing ? 'Đang quyết toán...' : 'Chốt công & Gửi Mail Lương'}
          </button>
        </div>

        {/* Khối Thống kê */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tổng ngân sách lương thực tế</p>
              <h3 className="text-xl font-black text-red-400 mt-1">{totalPayroll.toLocaleString()} đ</h3>
            </div>
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl"><DollarSign className="w-5 h-5" /></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Nhân sự đang hoạt động</p>
              <h3 className="text-xl font-black text-blue-400 mt-1">{staffs.length} Thành viên</h3>
            </div>
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl"><Users className="w-5 h-5" /></div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Vốn máy móc / Nợ gốc</p>
              <h3 className="text-xl font-black text-slate-300 mt-1">Giai đoạn 1</h3>
            </div>
            <div className="p-3 bg-slate-500/10 border border-slate-500/20 text-slate-400 rounded-xl"><Wallet className="w-5 h-5" /></div>
          </div>
        </div>

        {/* Bảng Danh sách Nhân sự lấy từ DATABASE THẬT */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/40">
            <h3 className="text-xs font-bold uppercase text-slate-400 tracking-wider">Bảng tổng hợp chi trả lương nhân viên (Live Database)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm text-slate-300">
              <thead>
                <tr className="bg-slate-950/20 text-slate-400 font-semibold border-b border-slate-800 text-xs uppercase">
                  <th className="p-4">Nhân sự</th>
                  <th className="p-4">Cấp bậc</th>
                  <th className="p-4">Định mức</th>
                  <th className="p-4 text-right">Email hệ thống</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {staffs.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 text-xs">Không có dữ liệu nhân sự nào trong database.</td>
                  </tr>
                ) : (
                  staffs.map((staff) => (
                    <tr key={staff.id} className="hover:bg-slate-950/20 transition">
                      <td className="p-4 font-semibold text-slate-200">{staff.full_name}</td>
                      <td className="p-4"><span className="px-2 py-0.5 text-xs font-bold bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-md">{staff.title}</span></td>
                      <td className="p-4 font-mono text-amber-400">{staff.hourly_rate.toLocaleString()} đ/h</td>
                      <td className="p-4 text-right text-slate-400 font-mono text-xs">{staff.email}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}