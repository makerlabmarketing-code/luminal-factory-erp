// app/staff/attendance/AttendanceView.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation'; 
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Power, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function StaffAttendanceContent({ token: propsToken, workerData }: any) {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = propsToken || searchParams.get('token'); 

  const [worker, setWorker] = useState<any>(null);
  const [localBranchName, setLocalBranchName] = useState('Đang nạp định vị...');
  const [isInShift, setIsInShift] = useState(false);
  const [todayRecord, setTodayRecord] = useState<any>(null); // State mới: Lưu trữ bản ghi hôm nay
  const [liveTime, setLiveTime] = useState(new Date());
  const [fetching, setFetching] = useState(true);

  // Hàm quét trạng thái ca kíp ngày hôm nay
  const loadInitialShiftStatus = async (currentWorker: any) => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data: check } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', currentWorker.id)
        .eq('work_date', todayStr)
        .maybeSingle();
      
      setTodayRecord(check);
      setIsInShift(!!(check && check.check_in && !check.check_out));
    } catch (e) { 
      console.error(e); 
    } finally {
      setFetching(false); 
    }
  };

  const findMatchedBranch = (workerObj: any, branchList: any[]) => {
    return branchList.find((b: any) => {
      if (String(workerObj.branch_code) === String(b.id)) return true;
      const branchNameLower = b.facility_name?.toLowerCase();
      if (workerObj.branch_code?.toLowerCase() === branchNameLower) return true;
      return false;
    });
  };

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    
    const initialize = async () => {
      setFetching(true);
      let finalWorker: any = null;

      try {
        if (workerData?.id) {
          const { data: freshEmp } = await supabase.from('employees').select('*').eq('id', workerData.id).maybeSingle();
          finalWorker = freshEmp || workerData; 
        } else if (token) {
          const { data: emp } = await supabase.from('employees').select('*').eq('qr_token', token).maybeSingle();
          finalWorker = emp;
        }

        if (finalWorker) {
          setWorker(finalWorker);
          
          try {
            const { data: facs } = await supabase.from('facilities').select('*');
            const branchData = facs || [];
            
            const matchedBranch = findMatchedBranch(finalWorker, branchData);
            setLocalBranchName(matchedBranch ? matchedBranch.facility_name : 'Chưa gán cơ sở');
          } catch (err) {
            setLocalBranchName('Lỗi đồng bộ chi nhánh');
          }

          await loadInitialShiftStatus(finalWorker);
        } else {
          setFetching(false);
        }
      } catch (err) {
        console.error(err);
        setFetching(false);
      }
    };

    initialize();
    return () => clearInterval(timer);
  }, [token, workerData]);

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

  const handleToggleShift = async () => {
    if (!worker) return showToast('Lỗi', 'Không tìm thấy hồ sơ nhân sự!', 'error');
    if (!navigator.geolocation) return showToast('Lỗi thiết bị', 'Thiết bị không hỗ trợ định vị GPS!', 'error');

    try {
      const { data: facs } = await supabase.from('facilities').select('*');
      const branchData = facs || [];
      
      const { data: freshEmp } = await supabase.from('employees').select('*').eq('id', worker.id).maybeSingle();
      const activeWorker = freshEmp || worker;

      const matchedBranch = findMatchedBranch(activeWorker, branchData);
      setLocalBranchName(matchedBranch ? matchedBranch.facility_name : 'Chưa gán cơ sở');

      if (!matchedBranch) return showToast('Lỗi địa điểm', 'Cơ sở được giao của bạn chưa được cấu hình tọa độ rào ranh giới GPS!', 'error');

      navigator.geolocation.getCurrentPosition(async (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        
        const distance = calculateDistance(uLat, uLng, matchedBranch.lat, matchedBranch.lng);

        if (distance > matchedBranch.radius) {
          return showToast('Từ Chối Chấm Công', `Vị trí sai! Bạn đang cách cơ sở khoảng ${Math.round(distance)} mét (Yêu cầu < ${matchedBranch.radius}m).`, 'error');
        }

        const todayStr = new Date().toLocaleDateString('en-CA');
        const timeStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
        const currentShift = autoDetectShift(liveTime);

        if (!isInShift) {
          // INSERT GIỜ VÀO
          const { error } = await supabase.from('attendance').insert([{ 
            employee_id: activeWorker.id, 
            employee_name: activeWorker.full_name, 
            work_date: todayStr, 
            check_in: timeStr, 
            shift_name: currentShift, 
            status: 'PRESENT' 
          }]);
          
          if (!error) {
            showToast('Vào ca thành công', `✓ Đã ghi nhận [${currentShift}] lúc ${timeStr}.`, 'success');
            await loadInitialShiftStatus(activeWorker); // Load lại để cập nhật state
          }
        } else {
          // UPDATE GIỜ RA
          const { error } = await supabase.from('attendance').update({ 
            check_out: timeStr 
          }).eq('employee_id', activeWorker.id).eq('work_date', todayStr);
          
          if (!error) {
            showToast('Tắt máy về', `✓ Đã tan ca [${currentShift}] thành công!`, 'success');
            // Cần có Webhook dưới DB (Supabase Trigger) tự động tính total_hours và total_salary khi check_out được update.
            // Sau khi update, tải lại dữ liệu để lấy được số giờ và số tiền đã tính
            await loadInitialShiftStatus(activeWorker); 
          }
        }
      }, () => { 
        showToast('Quyền định vị', 'Vui lòng mở quyền truy cập vị trí GPS mức chính xác cao!', 'error'); 
      }, { enableHighAccuracy: true, timeout: 5000 });

    } catch (err: any) { 
      showToast('Lỗi kết nối', err.message, 'error'); 
    }
  };

  if (fetching) {
    return (
      <div className="text-center p-12 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-2"/> 
        Đang đồng bộ trạm định vị Realtime...
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl max-w-md mx-auto mt-6 text-center text-xs text-slate-300 w-full animate-fadeIn">
        <AlertTriangle className="w-8 h-8 text-amber-500 animate-pulse" />
        <p className="font-bold">Không tìm thấy hồ sơ nhân sự</p>
        <p className="text-[11px] text-slate-400">Đường dẫn Token không hợp lệ hoặc tài khoản của bạn chưa được đồng bộ trên ERP.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-xl max-w-md mx-auto mt-6 animate-fadeIn w-full">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black font-mono text-slate-100">{liveTime.toLocaleTimeString('vi-VN')}</h2>
        <p className="text-[10px] text-slate-400 font-mono uppercase">{liveTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
      </div>

      <div className="w-full text-left space-y-1">
        <label className="text-[10px] text-slate-400 font-bold block pl-0.5">Cơ sở trực ban gán máy:</label>
        <div className="w-full bg-slate-950 border border-slate-850 p-3 rounded-xl font-sans text-xs text-slate-200 font-black tracking-wide border-l-4 border-l-purple-500 shadow-inner">
          🏛️ {localBranchName}
        </div>
      </div>

      {/* Hiển thị bảng tổng kết tiền lương nếu ĐÃ CÓ check_out và hệ thống đã tính tiền */}
      {!isInShift && todayRecord && todayRecord.check_out && (
        <div className="w-full bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <p className="text-xs font-bold text-emerald-400">Ca làm việc đã hoàn thành!</p>
          <div className="flex justify-between w-full text-[11px] font-mono border-t border-emerald-900/30 pt-2 mt-2">
            <span className="text-slate-400">Thời gian: {todayRecord.total_hours || 0} giờ</span>
            <span className="text-emerald-300 font-bold">Lương: {Number(todayRecord.total_salary || 0).toLocaleString('vi-VN')} đ</span>
          </div>
        </div>
      )}

      <button onClick={handleToggleShift} className={`w-36 h-36 rounded-full border-4 font-black text-xs tracking-wider uppercase transition-all duration-300 transform hover:scale-105 shadow-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${isInShift ? 'bg-red-950/40 border-red-500 text-red-400' : 'bg-emerald-950/40 border-emerald-500 text-emerald-400'}`}>
        <Power className="w-7 h-7" />
        <span>{isInShift ? 'TẮT MÁY VỀ' : 'VÀO CA MÁY'}</span>
      </button>
      
      <span className="text-[9px] text-purple-400 font-mono text-center bg-slate-950 p-2 rounded-lg border border-slate-800 w-full">Hệ thống nhận diện ca: {autoDetectShift(liveTime)}</span>
    </div>
  );
}