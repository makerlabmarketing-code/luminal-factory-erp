'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
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

const HISTORY_ITEMS_PER_PAGE = 5;

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
  const [localBranchName, setLocalBranchName] = useState('Äang náº¡p Ä‘á»‹nh vá»‹...');
  const [isInShift, setIsInShift] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [liveTime, setLiveTime] = useState(new Date());
  const [historyMonthInput, setHistoryMonthInput] = useState(() => {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [fetching, setFetching] = useState(true);

  const autoDetectShift = (date: Date) => {
    const hour = date.getHours();

    if (hour >= 6 && hour < 12) return 'Ca SÃ¡ng';
    if (hour >= 12 && hour < 18) return 'Ca Chiá»u';

    return 'Ca Tá»‘i';
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
    return branch?.facility_name || branch?.name || 'ChÆ°a gÃ¡n cÆ¡ sá»Ÿ';
  };

  const loadAttendanceHistory = async (currentWorker: Employee, monthValue = historyMonthInput) => {
    const [yearValue, monthValueText] = monthValue.split('-').map(Number);
    const monthIndex = monthValueText - 1;
    const startDate = new Date(yearValue, monthIndex, 1).toLocaleDateString('en-CA');
    const endDate = new Date(yearValue, monthIndex + 1, 0).toLocaleDateString('en-CA');

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
    setHistoryPage(1);
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
          setLocalBranchName('Lá»—i Ä‘á»“ng bá»™ chi nhÃ¡nh');
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
      showToast('Lá»—i', 'KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ nhÃ¢n sá»±!', 'error');
      return;
    }

    if (!navigator.geolocation) {
      showToast('Lá»—i thiáº¿t bá»‹', 'Thiáº¿t bá»‹ khÃ´ng há»— trá»£ Ä‘á»‹nh vá»‹ GPS!', 'error');
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
          'Lá»—i Ä‘á»‹a Ä‘iá»ƒm',
          'CÆ¡ sá»Ÿ Ä‘Æ°á»£c giao cá»§a báº¡n chÆ°a Ä‘Æ°á»£c cáº¥u hÃ¬nh tá»a Ä‘á»™ rÃ o ranh giá»›i GPS!',
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
                'Tá»« Chá»‘i Cháº¥m CÃ´ng',
                `Vá»‹ trÃ­ sai! Báº¡n Ä‘ang cÃ¡ch cÆ¡ sá»Ÿ khoáº£ng ${Math.round(distance)} mÃ©t.`,
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

              showToast('Táº¯t mÃ¡y vá»', `ÄÃ£ tan ca [${record.shift_name}] thÃ nh cÃ´ng.`, 'success');
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
              showToast('ÄÃ£ ghi nháº­n', `Ca [${currentShift}] Ä‘Ã£ cÃ³ dá»¯ liá»‡u cháº¥m cÃ´ng.`, 'info');
              return;
            }

            await checkInAttendance({
              employee: activeWorker,
              workDate: todayStr,
              shiftName: currentShift,
              checkIn: timeStr,
            });

            showToast('VÃ o ca thÃ nh cÃ´ng', `ÄÃ£ ghi nháº­n [${currentShift}] lÃºc ${timeStr}.`, 'success');
            await loadInitialShiftStatus(activeWorker);
            await loadAttendanceHistory(activeWorker);
          } catch (error) {
            const message = error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ cháº¥m cÃ´ng.';
            showToast('Lá»—i káº¿t ná»‘i', message, 'error');
          }
        },
        () => {
          showToast('Quyá»n Ä‘á»‹nh vá»‹', 'Vui lÃ²ng má»Ÿ quyá»n truy cáº­p vá»‹ trÃ­ GPS má»©c chÃ­nh xÃ¡c cao!', 'error');
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ cháº¥m cÃ´ng.';
      showToast('Lá»—i káº¿t ná»‘i', message, 'error');
    }
  };

  if (fetching) {
    return (
      <div className="text-center p-12 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-2" />
        Äang Ä‘á»“ng bá»™ tráº¡m Ä‘á»‹nh vá»‹ Realtime...
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl max-w-md mx-auto mt-6 text-center text-xs text-slate-300 w-full animate-fadeIn">
        <AlertTriangle className="w-8 h-8 text-amber-500 animate-pulse" />
        <p className="font-bold">KhÃ´ng tÃ¬m tháº¥y há»“ sÆ¡ nhÃ¢n sá»±</p>
        <p className="text-[11px] text-slate-400">
          ÄÆ°á»ng dáº«n Token khÃ´ng há»£p lá»‡ hoáº·c tÃ i khoáº£n cá»§a báº¡n chÆ°a Ä‘Æ°á»£c Ä‘á»“ng bá»™ trÃªn ERP.
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
  const historyTotalPages = Math.max(1, Math.ceil(attendanceHistory.length / HISTORY_ITEMS_PER_PAGE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedAttendanceHistory = attendanceHistory.slice(
    (safeHistoryPage - 1) * HISTORY_ITEMS_PER_PAGE,
    safeHistoryPage * HISTORY_ITEMS_PER_PAGE
  );

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
          CÆ¡ sá»Ÿ trá»±c ban gÃ¡n mÃ¡y:
        </label>
        <div className="w-full bg-slate-950 border border-slate-850 p-3 rounded-xl font-sans text-xs text-slate-200 font-black tracking-wide border-l-4 border-l-purple-500 shadow-inner">
          ðŸ›ï¸ {localBranchName}
        </div>
      </div>

      {!isInShift && todayRecord?.check_out && (
        <div className="w-full bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <p className="text-xs font-bold text-emerald-400">Ca lÃ m viá»‡c Ä‘Ã£ hoÃ n thÃ nh!</p>
          <div className="flex justify-between w-full text-[11px] font-mono border-t border-emerald-900/30 pt-2 mt-2">
            <span className="text-slate-400">Thá»i gian: {todayRecord.total_hours || 0} giá»</span>
            <span className="text-emerald-300 font-bold">
              LÆ°Æ¡ng: {Number(todayRecord.total_salary || 0).toLocaleString('vi-VN')} Ä‘
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
        <span>{isInShift ? 'Táº®T MÃY Vá»€' : 'VÃ€O CA MÃY'}</span>
      </button>

      <span className="text-[9px] text-purple-400 font-mono text-center bg-slate-950 p-2 rounded-lg border border-slate-800 w-full">
        Há»‡ thá»‘ng nháº­n diá»‡n ca: {autoDetectShift(liveTime)}
      </span>

      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Công tháng đã chọn</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {completedAttendanceRecords.length} ca đủ, {missingCheckoutRecords.length} ca thiếu giờ ra
            </p>
          </div>
          <div className="flex items-center gap-3">
            <MonthPicker
              value={historyMonthInput}
              onChange={(value) => {
                setHistoryMonthInput(value);
                setHistoryPage(1);
                if (worker) void loadAttendanceHistory(worker, value);
              }}
              accent="purple"
            />
            <div className="text-right font-mono">
              <p className="text-lg font-black text-emerald-400">{Number(totalMonthlyHours.toFixed(2))}h</p>
              <p className="text-[9px] text-slate-500">tổng giờ</p>
            </div>
          </div>
        </div>

        {missingCheckoutRecords.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200">
            Bạn đang có {missingCheckoutRecords.length} ca thiếu giờ ra. Vui lòng báo quản lý để bổ sung nếu đã tan ca.
          </div>
        )}

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[560px] text-left text-[11px]">
            <thead className="bg-slate-900/80 text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 font-black">Ngày</th>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black text-center">Vào</th>
                <th className="px-3 py-2 font-black text-center">Ra</th>
                <th className="px-3 py-2 font-black text-right">Giờ</th>
                <th className="px-3 py-2 font-black text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
              {attendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-slate-500 italic">
                    Chưa có dữ liệu chấm công trong tháng này.
                  </td>
                </tr>
              ) : (
                paginatedAttendanceHistory.map((record) => {
                  const isComplete = isAttendanceRecordComplete(record);
                  const displayHours = record.total_hours
                    ? Number(record.total_hours)
                    : calculateHoursFromStrings(record.check_in || null, record.check_out || null);
                  const displayDate = new Date(record.work_date).toLocaleDateString('vi-VN', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  });

                  return (
                    <tr key={record.id} className="hover:bg-slate-900/70 transition">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-200 whitespace-nowrap">{displayDate}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-purple-300 whitespace-nowrap">{record.shift_name}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-emerald-400">{record.check_in ? record.check_in.slice(0, 5) : '--:--'}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-red-400">{record.check_out ? record.check_out.slice(0, 5) : '--:--'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-400 font-bold">{isComplete ? displayHours : '-'}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={isComplete ? 'inline-flex rounded-md border border-emerald-500/20 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold text-emerald-400' : 'inline-flex rounded-md border border-amber-500/20 bg-amber-950/30 px-2 py-1 text-[10px] font-bold text-amber-400'}>
                          {isComplete ? 'Đã ghi nhận' : 'Cần bổ sung'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between gap-3 text-[11px] text-slate-500 font-mono">
          <span>Trang {safeHistoryPage}/{historyTotalPages} · {attendanceHistory.length} bản ghi</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
              disabled={safeHistoryPage <= 1}
              className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-30"
            >
              Trước
            </button>
            <button
              type="button"
              onClick={() => setHistoryPage((page) => Math.min(historyTotalPages, page + 1))}
              disabled={safeHistoryPage >= historyTotalPages}
              className="px-2 py-1 rounded-lg border border-slate-800 bg-slate-900 text-slate-300 disabled:opacity-30"
            >
              Sau
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

