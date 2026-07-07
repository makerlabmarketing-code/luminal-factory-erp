'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Power, RefreshCcw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { calculateHoursFromStrings } from '@/services/payrollService';
import {
  checkInAttendance,
  checkOutAttendance,
  getAttendanceRecordByShift,
  getEmployeeHourlyRate,
  getOpenAttendanceRecord,
  isAttendanceRecordComplete,
  isMissingCheckoutRecord,
  mergeAttendanceRecords,
} from '@/services/attendanceService';
import type { AttendanceRecord } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';
import type { Facility as FacilityType } from '@/lib/types/facility';

interface AttendanceViewProps {
  token?: string | null;
  workerData?: Employee | null;
  assignedBranchData?: FacilityType | null;
}

export function StaffAttendanceContent({
  token: propsToken,
  workerData,
  assignedBranchData,
}: AttendanceViewProps) {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = propsToken || searchParams.get('token');
  void assignedBranchData;
  const [worker, setWorker] = useState<Employee | null>(null);
  const [localBranchName, setLocalBranchName] = useState('Đang nạp định vị...');
  const [isInShift, setIsInShift] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [liveTime, setLiveTime] = useState(new Date());
  const [fetching, setFetching] = useState(true);

  const autoDetectShift = (date: Date) => {
    const hour = date.getHours();

    if (hour >= 6 && hour < 12) return 'Ca Sáng';
    if (hour >= 12 && hour < 18) return 'Ca Chiều';

    return 'Ca Tối';
  };

  const findMatchedBranch = (
    workerObj: Employee,
    branchList: FacilityType[]
  ): FacilityType | undefined => {
    return branchList.find((branch) => {
      if (String(workerObj.branch_code) === String(branch.id)) return true;

      const branchNameLower = branch.facility_name?.toLowerCase();
      if (workerObj.branch_code?.toLowerCase() === branchNameLower) return true;

      return false;
    });
  };

  const resolveBranchName = (branch?: FacilityType) => {
    return branch?.facility_name || branch?.name || 'Chưa gán cơ sở';
  };

  const loadAttendanceHistory = async (currentWorker: Employee) => {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString('en-CA');
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0).toLocaleDateString('en-CA');

    const { data, error } = await supabase
      .from('attendance')
      .select('*')
      .eq('employee_id', currentWorker.id)
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: false })
      .order('id', { ascending: false });

    if (error) throw error;

    setAttendanceHistory(mergeAttendanceRecords((data || []) as AttendanceRecord[]));
  };

  const loadInitialShiftStatus = async (currentWorker: Employee) => {
    try {
      const todayStr = new Date().toLocaleDateString('en-CA');

      const openRecord = await getOpenAttendanceRecord({
        employeeId: currentWorker.id,
        workDate: todayStr,
      });

      if (openRecord) {
        setTodayRecord(openRecord);
        setIsInShift(true);
        return;
      }

      const currentShift = autoDetectShift(new Date());

      const currentShiftRecord = await getAttendanceRecordByShift({
        employeeId: currentWorker.id,
        workDate: todayStr,
        shiftName: currentShift,
      });

      setTodayRecord(currentShiftRecord || null);
      setIsInShift(false);
    } catch (error) {
      console.error(error);
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);

    const initialize = async () => {
      setFetching(true);

      try {
        let finalWorker: Employee | null = null;

        if (workerData?.id) {
          const { data: freshEmp } = await supabase
            .from('employees')
            .select('*')
            .eq('id', workerData.id)
            .maybeSingle();

          finalWorker = (freshEmp as Employee) || workerData;
        } else if (token) {
          const { data: emp } = await supabase
            .from('employees')
            .select('*')
            .eq('qr_token', token)
            .maybeSingle();

          finalWorker = emp as Employee | null;
        }

        if (!finalWorker) {
          setFetching(false);
          return;
        }

        setWorker(finalWorker);

        try {
          const { data: facs } = await supabase.from('facilities').select('*');
          const matchedBranch = findMatchedBranch(finalWorker, (facs || []) as FacilityType[]);

          setLocalBranchName(resolveBranchName(matchedBranch));
        } catch {
          setLocalBranchName('Lỗi đồng bộ chi nhánh');
        }

        await loadInitialShiftStatus(finalWorker);
        await loadAttendanceHistory(finalWorker);
      } catch (error) {
        console.error(error);
        setFetching(false);
      }
    };

    initialize();

    return () => clearInterval(timer);
  }, [token, workerData]);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ) => {
    const radius = 6371e3;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    return radius * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleToggleShift = async () => {
    if (!worker) {
      showToast('Lỗi', 'Không tìm thấy hồ sơ nhân sự!', 'error');
      return;
    }

    if (!navigator.geolocation) {
      showToast('Lỗi thiết bị', 'Thiết bị không hỗ trợ định vị GPS!', 'error');
      return;
    }

    try {
      const { data: facs } = await supabase.from('facilities').select('*');

      const { data: freshEmp } = await supabase
        .from('employees')
        .select('*')
        .eq('id', worker.id)
        .maybeSingle();

      const activeWorker = ((freshEmp as Employee) || worker) as Employee;
      const matchedBranch = findMatchedBranch(activeWorker, (facs || []) as FacilityType[]);

      setLocalBranchName(resolveBranchName(matchedBranch));

      if (!matchedBranch) {
        showToast(
          'Lỗi địa điểm',
          'Cơ sở được giao của bạn chưa được cấu hình tọa độ rào ranh giới GPS!',
          'error'
        );
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const userLat = position.coords.latitude;
            const userLng = position.coords.longitude;

            const distance = calculateDistance(
              userLat,
              userLng,
              Number(matchedBranch.lat),
              Number(matchedBranch.lng)
            );

            if (distance > Number(matchedBranch.radius)) {
              showToast(
                'Từ Chối Chấm Công',
                `Vị trí sai! Bạn đang cách cơ sở khoảng ${Math.round(distance)} mét.`,
                'error'
              );
              return;
            }

            const now = new Date();
            const todayStr = now.toLocaleDateString('en-CA');
            const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
            const currentShift = autoDetectShift(now);

            const openRecord = await getOpenAttendanceRecord({
              employeeId: activeWorker.id,
              workDate: todayStr,
            });

            if (openRecord) {
              const record = openRecord;
              await checkOutAttendance({
                record,
                checkOut: timeStr,
                hourlyRate: getEmployeeHourlyRate(activeWorker),
              });

              showToast('Tắt máy về', `Đã tan ca [${record.shift_name}] thành công.`, 'success');
              await loadInitialShiftStatus(activeWorker);
              await loadAttendanceHistory(activeWorker);
              return;
            }

            const existingShift = await getAttendanceRecordByShift({
              employeeId: activeWorker.id,
              workDate: todayStr,
              shiftName: currentShift,
            });

            if (existingShift) {
              setTodayRecord(existingShift);
              setIsInShift(false);
              showToast('Đã ghi nhận', `Ca [${currentShift}] đã có dữ liệu chấm công.`, 'info');
              return;
            }

            await checkInAttendance({
              employee: activeWorker,
              workDate: todayStr,
              shiftName: currentShift,
              checkIn: timeStr,
            });

            showToast('Vào ca thành công', `Đã ghi nhận [${currentShift}] lúc ${timeStr}.`, 'success');
            await loadInitialShiftStatus(activeWorker);
            await loadAttendanceHistory(activeWorker);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Không thể chấm công.';
            showToast('Lỗi kết nối', message, 'error');
          }
        },
        () => {
          showToast('Quyền định vị', 'Vui lòng mở quyền truy cập vị trí GPS mức chính xác cao!', 'error');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể chấm công.';
      showToast('Lỗi kết nối', message, 'error');
    }
  };

  if (fetching) {
    return (
      <div className="text-center p-12 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-2" />
        Đang đồng bộ trạm định vị Realtime...
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl max-w-md mx-auto mt-6 text-center text-xs text-slate-300 w-full animate-fadeIn">
        <AlertTriangle className="w-8 h-8 text-amber-500 animate-pulse" />
        <p className="font-bold">Không tìm thấy hồ sơ nhân sự</p>
        <p className="text-[11px] text-slate-400">
          Đường dẫn Token không hợp lệ hoặc tài khoản của bạn chưa được đồng bộ trên ERP.
        </p>
      </div>
    );
  }

  const completedAttendanceRecords = attendanceHistory.filter(isAttendanceRecordComplete);
  const missingCheckoutRecords = attendanceHistory.filter(isMissingCheckoutRecord);
  const totalMonthlyHours = completedAttendanceRecords.reduce((total, record) => {
    const hours = record.total_hours
      ? Number(record.total_hours)
      : calculateHoursFromStrings(record.check_in || null, record.check_out || null);

    return total + hours;
  }, 0);

  return (
    <div className="flex flex-col items-center justify-center p-8 sm:p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-xl max-w-md mx-auto mt-6 animate-fadeIn w-full">
      <div className="text-center space-y-1">
        <h2 className="text-2xl font-black font-mono text-slate-100">
          {liveTime.toLocaleTimeString('vi-VN')}
        </h2>
        <p className="text-[10px] text-slate-400 font-mono uppercase">
          {liveTime.toLocaleDateString('vi-VN', {
            weekday: 'long',
            day: 'numeric',
            month: 'short',
          })}
        </p>
      </div>

      <div className="w-full text-left space-y-1">
        <label className="text-[10px] text-slate-400 font-bold block pl-0.5">
          Cơ sở trực ban gán máy:
        </label>
        <div className="w-full bg-slate-950 border border-slate-850 p-3 rounded-xl font-sans text-xs text-slate-200 font-black tracking-wide border-l-4 border-l-purple-500 shadow-inner">
          🏛️ {localBranchName}
        </div>
      </div>

      {!isInShift && todayRecord?.check_out && (
        <div className="w-full bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <p className="text-xs font-bold text-emerald-400">Ca làm việc đã hoàn thành!</p>
          <div className="flex justify-between w-full text-[11px] font-mono border-t border-emerald-900/30 pt-2 mt-2">
            <span className="text-slate-400">Thời gian: {todayRecord.total_hours || 0} giờ</span>
            <span className="text-emerald-300 font-bold">
              Lương: {Number(todayRecord.total_salary || 0).toLocaleString('vi-VN')} đ
            </span>
          </div>
        </div>
      )}

      <button
        onClick={handleToggleShift}
        className={`w-36 h-36 rounded-full border-4 font-black text-xs tracking-wider uppercase transition-all duration-300 transform hover:scale-105 shadow-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${
          isInShift
            ? 'bg-red-950/40 border-red-500 text-red-400'
            : 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
        }`}
      >
        <Power className="w-7 h-7" />
        <span>{isInShift ? 'TẮT MÁY VỀ' : 'VÀO CA MÁY'}</span>
      </button>

      <span className="text-[9px] text-purple-400 font-mono text-center bg-slate-950 p-2 rounded-lg border border-slate-800 w-full">
        Hệ thống nhận diện ca: {autoDetectShift(liveTime)}
      </span>

      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Công tháng này</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {completedAttendanceRecords.length} ca đủ, {missingCheckoutRecords.length} ca thiếu giờ ra
            </p>
          </div>
          <div className="text-right font-mono">
            <p className="text-lg font-black text-emerald-400">{Number(totalMonthlyHours.toFixed(2))}h</p>
            <p className="text-[9px] text-slate-500">tổng giờ</p>
          </div>
        </div>

        {missingCheckoutRecords.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200">
            Bạn đang có {missingCheckoutRecords.length} ca thiếu giờ ra. Vui lòng báo quản lý để bổ sung nếu đã tan ca.
          </div>
        )}

        <div className="space-y-2 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
          {attendanceHistory.length === 0 ? (
            <div className="text-center p-4 border border-dashed border-slate-800 rounded-xl text-slate-500 text-[11px] italic">
              Chưa có dữ liệu chấm công trong tháng này.
            </div>
          ) : (
            attendanceHistory.map((record) => {
              const isComplete = isAttendanceRecordComplete(record);
              const displayHours = record.total_hours
                ? Number(record.total_hours)
                : calculateHoursFromStrings(record.check_in || null, record.check_out || null);
              const displayDate = new Date(record.work_date).toLocaleDateString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
              });

              return (
                <div key={record.id} className="flex items-center justify-between gap-3 border border-slate-850 bg-slate-900/60 rounded-xl px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-200 truncate">{displayDate} - {record.shift_name}</p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      {record.check_in ? record.check_in.slice(0, 5) : '--:--'} → {record.check_out ? record.check_out.slice(0, 5) : '--:--'}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-[10px] font-bold ${isComplete ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {isComplete ? `${displayHours}h` : 'Thiếu giờ ra'}
                    </p>
                    <p className="text-[9px] text-slate-500">{isComplete ? 'Đã ghi nhận' : 'Cần bổ sung'}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
