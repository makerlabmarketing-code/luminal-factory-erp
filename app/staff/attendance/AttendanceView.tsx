'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useGlobalLoading } from '@/component/GlobalLoading';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import { Power, RefreshCcw, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
import {
  businessDateFromDateInput,
  businessMonthFromInstant,
  formatBusinessDate,
  formatBusinessMonthInput,
} from '@/lib/business-date';
import type { AttendanceRecord } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';
import type { Facility as FacilityType } from '@/lib/types/facility';
import {
  calculateShiftUnitsFromMinutes,
  formatWorkedDuration,
  getWorkedMinutesForRecord,
  isOpenAttendanceRecordStale,
} from '@/services/attendanceService';

interface AttendanceViewProps {
  workerData?: Employee | null;
  assignedBranchData?: FacilityType | null;
}

const HISTORY_ITEMS_PER_PAGE = 5;

interface StaffAttendancePayload {
  employee: Employee;
  localBranchName: string;
  todayRecord: AttendanceRecord | null;
  isInShift: boolean;
  attendanceHistory: AttendanceRecord[];
}

interface StaffAttendanceErrorPayload {
  error?: string;
  code?: string;
}

function isAttendanceRecordComplete(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && record.check_out);
}

function isMissingCheckoutRecord(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && !record.check_out);
}

function autoDetectShift(date: Date) {
  const hour = date.getHours();

  if (hour >= 6 && hour < 12) return 'Ca Sáng';
  if (hour >= 12 && hour < 18) return 'Ca Chiều';

  return 'Ca Tối';
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 5000,
    });
  });
}

function isGeolocationError(error: unknown): error is GeolocationPositionError {
  return Boolean(error && typeof error === 'object' && 'code' in error);
}

function messageForAttendanceError(payload: StaffAttendanceErrorPayload | null): string {
  if (payload?.code === 'attendance_workspace_required') {
    return 'Tài khoản chưa được cấp quyền vào khu vực nhân viên.';
  }
  if (payload?.code === 'attendance_employee_inactive') {
    return 'Tài khoản nhân sự đã bị khóa.';
  }
  if (payload?.code === 'attendance_employee_not_found') {
    return 'Tài khoản chưa được liên kết với hồ sơ nhân sự.';
  }
  if (payload?.code === 'attendance_invalid_payload') {
    return payload.error || 'Dữ liệu chấm công không hợp lệ.';
  }
  if (payload?.code === 'attendance_location_out_of_range') {
    return payload.error || 'Vị trí hiện tại nằm ngoài phạm vi chấm công.';
  }
  if (payload?.code === 'attendance_already_checked_out') {
    return payload.error || 'Ca này đã có dữ liệu chấm công.';
  }

  return payload?.error || 'Không thể chấm công.';
}

export function StaffAttendanceContent({
  workerData,
  assignedBranchData,
}: AttendanceViewProps) {
  const { showToast } = useNotification();
  const { showGlobalLoading, hideGlobalLoading } = useGlobalLoading();
  const [worker, setWorker] = useState<Employee | null>(workerData || null);
  const [localBranchName, setLocalBranchName] = useState(
    assignedBranchData?.facility_name || assignedBranchData?.name || 'Đang nạp định vị...'
  );
  const [isInShift, setIsInShift] = useState(false);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [liveTime, setLiveTime] = useState(new Date());
  const [historyMonthInput, setHistoryMonthInput] = useState(() => {
    return formatBusinessMonthInput(businessMonthFromInstant(new Date()));
  });
  const [historyPage, setHistoryPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const applyAttendancePayload = (payload: StaffAttendancePayload) => {
    setWorker(payload.employee);
    setLocalBranchName(payload.localBranchName);
    setTodayRecord(payload.todayRecord);
    setIsInShift(payload.isInShift);
    setAttendanceHistory(payload.attendanceHistory);
    setHistoryPage(1);
  };

  const loadAttendanceData = useCallback(async (monthValue = historyMonthInput) => {
    try {
      setFetching(true);
      setFetchError(null);
      const response = await fetch(`/api/staff/attendance?month=${encodeURIComponent(monthValue)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || 'Không thể tải dữ liệu chấm công.');
      }

      applyAttendancePayload((await response.json()) as StaffAttendancePayload);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu chấm công.';
      setFetchError(message);
      showToast('Lỗi kết nối', message, 'error');
    } finally {
      setFetching(false);
    }
  }, [historyMonthInput, showToast]);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);

    void loadAttendanceData();

    return () => clearInterval(timer);
  }, [loadAttendanceData]);

  const handleToggleShift = async () => {
    if (submitLockRef.current) return;

    if (!worker) {
      showToast('Lỗi', 'Không tìm thấy hồ sơ nhân sự!', 'error');
      return;
    }

    if (!navigator.geolocation) {
      showToast('Lỗi thiết bị', 'Thiết bị không hỗ trợ định vị GPS!', 'error');
      return;
    }

    submitLockRef.current = true;
    setSubmitting(true);
    showGlobalLoading(isInShift ? 'Đang kết thúc ca...' : 'Đang ghi nhận vào ca...');

    try {
      const position = await getCurrentPosition();
      const userLat = position.coords.latitude;
      const userLng = position.coords.longitude;

      const response = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userLat, userLng }),
      });

      const result = (await response.json().catch(() => null)) as
        | (StaffAttendanceErrorPayload & { message?: string })
        | null;

      if (!response.ok) {
        throw new Error(messageForAttendanceError(result));
      }

      showToast('Cập nhật ca làm', result?.message || 'Đã ghi nhận chấm công.', 'success');
      await loadAttendanceData();
    } catch (error) {
      const message = isGeolocationError(error)
        ? 'Vui lòng mở quyền truy cập vị trí GPS mức chính xác cao!'
        : error instanceof Error ? error.message : 'Không thể chấm công.';
      showToast('Lỗi kết nối', message, 'error');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
      hideGlobalLoading();
    }
  };

  if (fetching) {
    return (
      <div className="text-center p-12 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-2" />
        Đang tải dữ liệu chấm công...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-slate-900 border border-red-500/30 rounded-3xl space-y-3 shadow-xl max-w-md mx-auto mt-6 text-center text-xs text-red-100 w-full animate-fadeIn" role="alert">
        <AlertTriangle className="w-8 h-8 text-red-400" />
        <p className="font-bold text-red-300">Không thể tải dữ liệu chấm công</p>
        <p className="text-[11px] text-red-100/80">{fetchError}</p>
        <button
          type="button"
          onClick={() => void loadAttendanceData()}
          className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-red-950/30 px-3 py-2 font-bold text-red-100 transition hover:bg-red-900/40 focus:outline-none focus:ring-2 focus:ring-red-400"
        >
          <RefreshCcw className="h-3.5 w-3.5" />
          Thử lại
        </button>
      </div>
    );
  }

  if (!worker) {
    return (
      <div className="flex flex-col items-center justify-center p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-3 shadow-xl max-w-md mx-auto mt-6 text-center text-xs text-slate-300 w-full animate-fadeIn">
        <AlertTriangle className="w-8 h-8 text-amber-500 animate-pulse" />
        <p className="font-bold">Không tìm thấy hồ sơ nhân sự</p>
        <p className="text-[11px] text-slate-400">
          Tài khoản của bạn chưa được liên kết với hồ sơ nhân sự.
        </p>
      </div>
    );
  }

  const completedAttendanceRecords = attendanceHistory.filter(isAttendanceRecordComplete);
  const missingCheckoutRecords = attendanceHistory.filter(isMissingCheckoutRecord);
  const totalMonthlyHours = completedAttendanceRecords.reduce((total, record) => {
    const hours = getWorkedMinutesForRecord(record) / 60;

    return total + hours;
  }, 0);
  const totalMonthlyShifts = completedAttendanceRecords.reduce((total, record) => {
    return total + calculateShiftUnitsFromMinutes(getWorkedMinutesForRecord(record));
  }, 0);
  const todayWorkedMinutes = todayRecord ? getWorkedMinutesForRecord(todayRecord, liveTime) : 0;
  const todayShiftUnits = calculateShiftUnitsFromMinutes(todayWorkedMinutes);
  const hasStaleOpenShift = todayRecord
    ? isOpenAttendanceRecordStale(todayRecord, liveTime)
    : false;
  const historyTotalPages = Math.max(1, Math.ceil(attendanceHistory.length / HISTORY_ITEMS_PER_PAGE));
  const safeHistoryPage = Math.min(historyPage, historyTotalPages);
  const paginatedAttendanceHistory = attendanceHistory.slice(
    (safeHistoryPage - 1) * HISTORY_ITEMS_PER_PAGE,
    safeHistoryPage * HISTORY_ITEMS_PER_PAGE
  );

  return (
    <div className="flex flex-col items-center justify-center p-5 sm:p-8 bg-slate-900 border border-slate-800 rounded-3xl space-y-6 shadow-xl max-w-2xl mx-auto mt-4 sm:mt-6 animate-fadeIn w-full">
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
        <div className="w-full bg-slate-950 border border-slate-850 p-3 rounded-xl font-sans text-xs text-slate-200 font-black tracking-wide border-l-4 border-l-purple-500 shadow-inner flex items-center gap-2">
          <Building2 className="w-4 h-4 text-purple-300 shrink-0" />
          <span className="min-w-0 break-words">{localBranchName}</span>
        </div>
      </div>

      {isInShift && todayRecord && (
        <div className={`w-full rounded-2xl border p-4 ${hasStaleOpenShift ? 'border-amber-500/40 bg-amber-950/30' : 'border-blue-500/30 bg-blue-950/20'}`} role={hasStaleOpenShift ? 'alert' : 'status'}>
          <div className="flex items-start gap-3">
            {hasStaleOpenShift ? (
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            ) : (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
            )}
            <div className="min-w-0">
              <p className={`text-xs font-bold ${hasStaleOpenShift ? 'text-amber-300' : 'text-blue-300'}`}>
                {hasStaleOpenShift ? 'Ca đang mở từ ngày trước' : 'Bạn đang trong ca làm việc'}
              </p>
              <p className="mt-1 text-[11px] text-slate-300">
                Vào lúc {todayRecord.check_in?.slice(0, 5)} · {formatWorkedDuration(todayWorkedMinutes)}
              </p>
              {hasStaleOpenShift && (
                <p className="mt-1 text-[11px] text-amber-200/90">
                  Hãy kết thúc ca nếu bạn vẫn đang làm việc, hoặc báo quản lý để kiểm tra dữ liệu.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {!isInShift && todayRecord?.check_out && (
        <div className="w-full bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <p className="text-xs font-bold text-emerald-400">Ca làm việc đã hoàn thành!</p>
          <div className="flex flex-col sm:flex-row justify-between gap-1 w-full text-[11px] font-mono border-t border-emerald-900/30 pt-2 mt-2">
            <span className="text-slate-400">Thời gian: {formatWorkedDuration(todayWorkedMinutes)}</span>
            <span className="text-emerald-300 font-bold">Ca quy đổi: {todayShiftUnits} ca</span>
          </div>
        </div>
      )}

      <button
        onClick={handleToggleShift}
        disabled={submitting}
        aria-busy={submitting}
        className={`w-36 h-36 rounded-full border-4 font-black text-xs tracking-wider uppercase transition-all duration-300 transform hover:scale-105 shadow-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 disabled:pointer-events-none disabled:opacity-60 cursor-pointer ${
          isInShift
            ? 'bg-red-950/40 border-red-500 text-red-400'
            : 'bg-emerald-950/40 border-emerald-500 text-emerald-400'
        }`}
      >
        <Power className="w-7 h-7" />
        <span>{submitting ? 'ĐANG GHI' : isInShift ? 'TẮT MÁY VỀ' : 'VÀO CA MÁY'}</span>
      </button>

      <span className="text-[9px] text-purple-400 font-mono text-center bg-slate-950 p-2 rounded-lg border border-slate-800 w-full">
        Hệ thống nhận diện ca: {autoDetectShift(liveTime)}
      </span>

      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Hôm nay</p>
          <p className="mt-1 text-sm font-black text-amber-400 font-mono">{formatWorkedDuration(todayWorkedMinutes)}</p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Ca tạm tính</p>
          <p className="mt-1 text-sm font-black text-purple-400 font-mono">{todayShiftUnits} ca</p>
        </div>
      </div>

      <div className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="min-w-0">
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Công tháng đã chọn</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {completedAttendanceRecords.length} ca đủ, {missingCheckoutRecords.length} ca thiếu giờ ra
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:flex sm:items-center">
            <MonthPicker
              value={historyMonthInput}
              onChange={(value) => {
                setHistoryMonthInput(value);
                setHistoryPage(1);
                if (worker) void loadAttendanceData(value);
              }}
              accent="purple"
            />
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-left sm:text-right font-mono">
              <p className="text-lg font-black text-emerald-400">{Number(totalMonthlyHours.toFixed(2))}h</p>
              <p className="text-[9px] text-slate-500">tổng giờ · {totalMonthlyShifts} ca</p>
            </div>
          </div>
        </div>

        {missingCheckoutRecords.length > 0 && (
          <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3 text-[11px] text-amber-200">
            Bạn đang có {missingCheckoutRecords.length} ca thiếu giờ ra. Vui lòng báo quản lý để bổ sung nếu đã tan ca.
          </div>
        )}

        <div className="space-y-2 md:hidden">
          {attendanceHistory.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-6 text-center text-[11px] text-slate-500 italic">
              Chưa có dữ liệu chấm công trong tháng này.
            </div>
          ) : (
            paginatedAttendanceHistory.map((record) => {
              const isComplete = isAttendanceRecordComplete(record);
              const workedMinutes = getWorkedMinutesForRecord(record);
              const displayHours = Number((workedMinutes / 60).toFixed(2));
              const shiftUnits = calculateShiftUnitsFromMinutes(workedMinutes);
              const displayDate = formatBusinessDate(businessDateFromDateInput(record.work_date));

              return (
                <div key={record.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-xs font-black text-slate-100">{displayDate}</p>
                      <p className="mt-0.5 text-[11px] font-bold text-purple-300">{record.shift_name}</p>
                    </div>
                    <span className={isComplete ? 'shrink-0 rounded-md border border-emerald-500/20 bg-emerald-950/30 px-2 py-1 text-[10px] font-bold text-emerald-400' : 'shrink-0 rounded-md border border-amber-500/20 bg-amber-950/30 px-2 py-1 text-[10px] font-bold text-amber-400'}>
                      {isComplete ? 'Đủ công' : 'Thiếu ra'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] font-mono">
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-500 uppercase font-bold">Vào</p>
                      <p className="mt-1 text-emerald-400 font-black">{record.check_in ? record.check_in.slice(0, 5) : '--:--'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-500 uppercase font-bold">Ra</p>
                      <p className="mt-1 text-red-400 font-black">{record.check_out ? record.check_out.slice(0, 5) : '--:--'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-500 uppercase font-bold">Giờ</p>
                      <p className="mt-1 text-amber-400 font-black">{isComplete ? displayHours : '-'}</p>
                    </div>
                    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2">
                      <p className="text-slate-500 uppercase font-bold">Ca</p>
                      <p className="mt-1 text-purple-400 font-black">{shiftUnits}</p>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full min-w-[640px] text-left text-[11px]">
            <thead className="bg-slate-900/80 text-slate-500 uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2 font-black">Ngày</th>
                <th className="px-3 py-2 font-black">Ca</th>
                <th className="px-3 py-2 font-black text-center">Vào</th>
                <th className="px-3 py-2 font-black text-center">Ra</th>
                <th className="px-3 py-2 font-black text-right">Giờ</th>
                <th className="px-3 py-2 font-black text-right">Ca</th>
                <th className="px-3 py-2 font-black text-center">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 bg-slate-950/40">
              {attendanceHistory.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-6 text-center text-slate-500 italic">
                    Chưa có dữ liệu chấm công trong tháng này.
                  </td>
                </tr>
              ) : (
                paginatedAttendanceHistory.map((record) => {
                  const isComplete = isAttendanceRecordComplete(record);
                  const workedMinutes = getWorkedMinutesForRecord(record);
                  const displayHours = Number((workedMinutes / 60).toFixed(2));
                  const shiftUnits = calculateShiftUnitsFromMinutes(workedMinutes);
                  const displayDate = formatBusinessDate(businessDateFromDateInput(record.work_date));

                  return (
                    <tr key={record.id} className="hover:bg-slate-900/70 transition">
                      <td className="px-3 py-2.5 font-mono font-bold text-slate-200 whitespace-nowrap">{displayDate}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-purple-300 whitespace-nowrap">{record.shift_name}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-emerald-400">{record.check_in ? record.check_in.slice(0, 5) : '--:--'}</td>
                      <td className="px-3 py-2.5 text-center font-mono text-red-400">{record.check_out ? record.check_out.slice(0, 5) : '--:--'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-amber-400 font-bold">{isComplete ? displayHours : '-'}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-purple-400 font-bold">{shiftUnits}</td>
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
