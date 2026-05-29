// app/staff/attendance/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'; 
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Power, User, MapPin, RefreshCcw } from 'lucide-react';

export default function StaffAttendancePage() {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = searchParams.get('token'); 

  const [worker, setWorker] = useState<any>(null);
  const [assignedBranch, setAssignedBranch] = useState<any>(null); 
  const [isInShift, setIsInShift] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    
    const initializeAttendance = async () => {
      if (!token) { setFetching(false); return; }
      try {
        const { data: emp } = await supabase.from('employees').select('*').eq('qr_token', token).maybeSingle();
        if (emp) {
          setWorker(emp);
          const { data: metaBranch } = await supabase.from('system_metadata').select('data').eq('name', 'Danh sách Chi nhánh').maybeSingle();
          const branchData = metaBranch?.data || [];
          const myBranch = branchData.find((b: any) => b.code === emp.branch_code || b.name === emp.branch);
          setAssignedBranch(myBranch || branchData[0] || null);

          const todayStr = new Date().toLocaleDateString('en-CA');
          const { data: check } = await supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('work_date', todayStr).maybeSingle();
          setIsInShift(!!(check && check.check_in && !check.check_out));
        }
      } catch (e) { console.error(e); }
      setFetching(false);
    };

    initializeAttendance();
    return () => clearInterval(timer);
  }, [token]);

  const autoDetectShift = (date: Date) => {
    const hour = date.getHours();
    if (hour >= 6 && hour < 12) return 'Ca Sáng';
    if (hour >= 12 && hour < 18) return 'Ca Chiều';
    return 'Ca Tối';
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleToggleShift = () => {
    if (!worker) return showToast('Lỗi', 'Không tìm thấy hồ sơ nhân sự!', 'error');
    if (!assignedBranch) return showToast('Thiếu địa điểm', 'Tài khoản chưa được phân phối chi nhánh trực ca!', 'error');
    if (!navigator.geolocation) return showToast('Lỗi thiết bị', 'Thiết bị không hỗ trợ quét định vị GPS!', 'error');

    navigator.geolocation.getCurrentPosition(async (position) => {
      const uLat = position.coords.latitude;
      const uLng = position.coords.longitude;
      const distance = calculateDistance(uLat, uLng, assignedBranch.lat, assignedBranch.lng);

      if (distance > assignedBranch.radius) {
        return showToast('Từ Chối Chấm Công', `Bạn đang cách xa cơ sở được giao [${assignedBranch.name}] ${Math.round(distance)}m (Yêu cầu phải < ${assignedBranch.radius}m).`, 'error');
      }

      const todayStr = new Date().toLocaleDateString('en-CA');
      const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      const currentShift = autoDetectShift(liveTime);

      try {
        if (!isInShift) {
          await supabase.from('attendance').insert([{ employee_id: worker.id, employee_name: worker.full_name, work_date: todayStr, check_in: timeStr, shift_name: currentShift, status: 'PRESENT' }]);
          showToast('Vào ca thành công', `Ghi nhận [${currentShift}] tại ${assignedBranch.name} lúc ${timeStr}.`, 'success');
        } else {
          await supabase.from('attendance').update({ check_out: timeStr }).eq('employee_id', worker.id).eq('work_date', todayStr);
          showToast('Rời ca thành công', `Ghi nhận tan ca lúc ${timeStr}.`, 'success');
        }
        setIsInShift(!isInShift);
      } catch (err: any) { showToast('Lỗi Database', err.message, 'error'); }
    }, () => { showToast('Quyền định vị', 'Vui lòng mở quyền vị trí trên điện thoại!', 'error'); });
  };

  if (fetching || !worker) return <div className="text-center p-12 text-xs text-slate-500 font-mono"><RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-2"/> Đang đồng bộ định vị ca máy...</div>;

  return (
    <div className="p-4 max-w-md mx-auto space-y-6 pt-8 font-sans bg-slate-950 min-h-screen text-slate-100">
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20"><User className="w-4 h-4" /></div>
          <div>
            <h4 className="text-xs font-black text-slate-100">{worker.full_name}</h4>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{worker.title || 'Kỹ thuật viên'}</p>
          </div>
        </div>
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider ${isInShift ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20 shadow-lg' : 'border-slate-800 text-slate-500 bg-slate-950'}`}>{isInShift ? 'TRONG CA' : 'NGOÀI CA'}</span>
      </div>

      <div className="text-center space-y-1 py-4">
        <h2 className="text-4xl font-black font-mono text-slate-100">{liveTime.toLocaleTimeString('vi-VN')}</h2>
        <p className="text-[10px] text-slate-400 font-mono uppercase">{liveTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      </div>

      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3.5 h-3.5 text-purple-500" /> Cơ sở trực ban được giao (Khóa cứng):</label>
        <div className="w-full bg-slate-950 border border-slate-850 p-3.5 rounded-xl font-sans text-xs text-slate-200 font-black tracking-wide border-l-4 border-l-purple-500 shadow-inner">
          🏛️ {assignedBranch ? assignedBranch.name : 'Đang bóc tách định vị...'}
        </div>
        <div className="text-[9px] text-slate-500 font-mono mt-2 text-center bg-slate-950 p-2 rounded-lg border border-slate-850">
          Hệ thống nhận ca thông minh: <span className="text-purple-400 font-bold uppercase">{autoDetectShift(liveTime)}</span>
        </div>
      </div>

      <div className="flex justify-center pt-4">
        <button onClick={handleToggleShift} className={`w-44 h-44 rounded-full border-8 transition-all active:scale-95 shadow-2xl flex flex-col items-center justify-center gap-2 cursor-pointer ${isInShift ? 'bg-red-950/20 border-red-500 text-red-400' : 'bg-emerald-950/20 border-emerald-500 text-emerald-400'}`}>
          <Power className="w-10 h-10" />
          <span className="font-black text-[10px] tracking-widest uppercase">{isInShift ? 'TẮT MÁY VỀ' : 'BẤM VÀO CA'}</span>
        </button>
      </div>
    </div>
  );
}