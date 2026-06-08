// app/staff/portal/page.tsx
'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { User, ClipboardList, Clock, Banknote, RefreshCcw } from 'lucide-react';

import { StaffAttendanceContent } from '../attendance/AttendanceView';
import { StaffTasksContent } from '../tasks/TasksView';
import { StaffExpensesContent } from '../expenses/ExpensesView';
import { StaffProfileContent } from '../profile/ProfileView';

function StaffPortalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [worker, setWorker] = useState<any>(null);
  const [assignedBranch, setAssignedBranch] = useState<any>(null); 
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance'); 

  const loadPortalData = async () => {
    if (!token) { setLoading(false); return; }
    try {
      // 1. Định danh nhân sự hỏa tốc qua Token URL
      const { data: emp } = await supabase.from('employees').select('*').eq('qr_token', token).maybeSingle();
      if (!emp) { setLoading(false); return; }
      setWorker(emp);

      // 2. KHÓA CỨNG ĐỊA ĐIỂM: Khớp nối duy nhất chi nhánh gán cho thợ ban quản trị
      const { data: metaBranch } = await supabase.from('system_metadata').select('data').eq('name', 'Danh sách Chi nhánh').maybeSingle();
      const branchData = metaBranch?.data || [];
      const myBranch = branchData.find((b: any) => b.code === emp.branch_code || b.name === emp.branch);
      setAssignedBranch(myBranch || branchData[0] || null);

    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadPortalData(); }, [token, activeTab]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400 text-xs font-mono"><RefreshCcw className="w-4 h-4 animate-spin mr-2 text-purple-500"/> Đang dựng cấu trúc trạm đồng bộ...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-5 text-slate-100 bg-slate-950 min-h-screen pb-24 font-sans select-none">
      
      {/* THẺ ĐỊNH DANH DÙNG CHUNG */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-xl"><User className="w-4 h-4" /></div>
          <div>
            <h2 className="text-xs font-black text-slate-100">{worker?.full_name}</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{worker?.title || 'Kỹ thuật viên'}</p>
          </div>
        </div>
      </div>

      {/* 🔥 LIÊN THÔNG MA TRẬN PHÂN HỆ SẠCH SẼ - GỌI COMPONENT KHÔNG CHỨA CODE COPIED TRÙNG LẶP */}
      {activeTab === 'attendance' && (
        <StaffAttendanceContent token={token} workerData={worker} assignedBranchData={assignedBranch} />
      )}

      {activeTab === 'tasks' && (
        <StaffTasksContent token={token} workerData={worker} />
      )}

      {activeTab === 'expenses' && (
        <StaffExpensesContent token={token} workerData={worker} />
      )}

      {activeTab === 'profile' && (
        <StaffProfileContent token={token} workerData={worker} />
      )}

      {/* FOOTER BOTTOM TABS MENU CỦA PORTAL NGUYÊN KHỐI */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-3.5 z-50 flex justify-around items-center shadow-2xl text-[10px] font-bold">
        <button onClick={() => setActiveTab('attendance')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none cursor-pointer ${activeTab === 'attendance' ? 'text-blue-400 font-black' : 'text-slate-500'}`}>
          <Clock className="w-4 h-4" /><span>Ca Làm Việc</span>
        </button>
        <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none cursor-pointer ${activeTab === 'tasks' ? 'text-blue-400 font-black' : 'text-slate-500'}`}>
          <ClipboardList className="w-4 h-4" /><span>Nhận Việc</span>
        </button>
        <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none cursor-pointer ${activeTab === 'expenses' ? 'text-blue-400 font-black' : 'text-slate-500'}`}>
          <Banknote className="w-4 h-4" /><span>Báo Chi Tiêu</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none cursor-pointer ${activeTab === 'profile' ? 'text-blue-400 font-black' : 'text-slate-500'}`}>
          <User className="w-4 h-4" /><span>Cá Nhân</span>
        </button>
      </div>

    </div>
  );
}

export default function WorkerPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-500 text-xs font-mono">Đang đồng bộ cổng Portal nguyên khối...</div>}>
      <StaffPortalContent />
    </Suspense>
  );
}