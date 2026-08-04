'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import { DataTableError, DataTablePagination, DataTableShell, DataTableSkeleton } from '@/component/data-table/DataTable';
import { LogIn, LogOut, RefreshCcw, AlertTriangle, CheckCircle2, Building2 } from 'lucide-react';
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
  type AttendanceShiftState,
  formatWorkedDuration,
  getAttendanceShiftName,
  canContinueAttendanceShift,
  canStartAttendanceShift,
  getFinalizedShiftUnitsForRecord,
  getWorkedMinutesForRecord,
} from '@/services/attendanceService';

interface AttendanceViewProps {
  workerData?: Employee | null;
  assignedBranchData?: FacilityType | null;
}

const HISTORY_ITEMS_PER_PAGE = 5;

interface StaffAttendancePayload {
  employee: Employee;
  localBranchName: string;
  shiftState: AttendanceShiftState;
  currentShift: AttendanceRecord | null;
  staleOpenShift: AttendanceRecord | null;
  todayRecord: AttendanceRecord | null;
  isInShift: boolean;
  attendanceHistory: AttendanceRecord[];
  capabilities?: {
    multiCheckEnabled: boolean;
  };
}

interface StaffAttendanceErrorPayload {
  error?: string;
  code?: string;
  correlationId?: string;
}

interface StaffAttendanceMutationPayload extends StaffAttendanceErrorPayload {
  message?: string;
  record?: AttendanceRecord;
  attendance?: StaffAttendancePayload;
}

interface AttendanceMutationError {
  message: string;
  correlationId?: string;
}

function isAttendanceRecordComplete(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && record.check_out);
}

function isMissingCheckoutRecord(record: AttendanceRecord): boolean {
  return Boolean(record.check_in && !record.check_out);
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
  if (payload?.code === 'attendance_already_checked_in') {
    return payload.error || 'Bạn đang có một ca làm việc chưa kết thúc.';
  }
  if (payload?.code === 'attendance_no_open_shift') {
    return payload.error || 'Không có ca đang mở để kết thúc.';
  }
  if (payload?.code === 'attendance_shift_changed') {
    return payload.error || 'Ca làm đã thay đổi. Vui lòng tải lại dữ liệu.';
  }
  if (payload?.code === 'attendance_stale_shift_operator_required') {
    return payload.error || 'Có ca làm trước đó chưa được kết thúc. Vui lòng báo quản lý để kiểm tra.';
  }

  return payload?.error || 'Không thể chấm công.';
}

export function StaffAttendanceContent({
  workerData,
  assignedBranchData,
}: AttendanceViewProps) {
  const { showToast } = useNotification();
  const [worker, setWorker] = useState<Employee | null>(workerData || null);
  const [localBranchName, setLocalBranchName] = useState(
    assignedBranchData?.facility_name || assignedBranchData?.name || 'Đang nạp định vị...'
  );
  const [shiftState, setShiftState] = useState<AttendanceShiftState>('NO_OPEN_SHIFT');
  const [currentShift, setCurrentShift] = useState<AttendanceRecord | null>(null);
  const [staleOpenShift, setStaleOpenShift] = useState<AttendanceRecord | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [multiCheckEnabled, setMultiCheckEnabled] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const initialHistoryMonth = useRef(
    formatBusinessMonthInput(businessMonthFromInstant(new Date()))
  );
  const [historyMonthInput, setHistoryMonthInput] = useState(initialHistoryMonth.current);
  const [historyPage, setHistoryPage] = useState(1);
  const [fetching, setFetching] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [mutationError, setMutationError] = useState<AttendanceMutationError | null>(null);
  const submitLockRef = useRef(false);

  const applyAttendancePayload = useCallback((
    payload: StaffAttendancePayload,
    options: { resetHistoryPage?: boolean } = {}
  ) => {
    setWorker(payload.employee);
    setLocalBranchName(payload.localBranchName);
    setShiftState(payload.shiftState);
    setCurrentShift(payload.currentShift);
    setStaleOpenShift(payload.staleOpenShift);
    setTodayRecord(payload.todayRecord);
    setAttendanceHistory(payload.attendanceHistory);
    setMultiCheckEnabled(Boolean(payload.capabilities?.multiCheckEnabled));
    if (options.resetHistoryPage) setHistoryPage(1);
  }, []);

  const applyMutationRecord = useCallback((record: AttendanceRecord) => {
    const isOpen = Boolean(record.check_in && !record.check_out);
    setCurrentShift(isOpen ? record : null);
    setShiftState(isOpen ? 'ACTIVE_SHIFT_TODAY' : 'NO_OPEN_SHIFT');
    setTodayRecord(record);
    setAttendanceHistory((previous) => {
      const withoutRecord = previous.filter((item) => String(item.id) !== String(record.id));
      return [record, ...withoutRecord];
    });
  }, []);

  const loadAttendanceData = useCallback(async (
    monthValue: string,
    options: {
      showLoading?: boolean;
      resetHistoryPage?: boolean;
      preserveVisibleDataOnError?: boolean;
    } = {}
  ) => {
    const showLoading = options.showLoading !== false;

    try {
      if (showLoading) setFetching(true);
      if (!options.preserveVisibleDataOnError) setFetchError(null);
      const response = await fetch(`/api/staff/attendance?month=${encodeURIComponent(monthValue)}`, {
        cache: 'no-store',
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error || 'Không thể tải dữ liệu chấm công.');
      }

      applyAttendancePayload((await response.json()) as StaffAttendancePayload, {
        resetHistoryPage: options.resetHistoryPage,
      });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu chấm công.';
      if (!options.preserveVisibleDataOnError) {
        setFetchError(message);
        showToast('Lỗi kết nối', message, 'error');
      }
      return false;
    } finally {
      if (showLoading) setFetching(false);
    }
  }, [applyAttendancePayload, showToast]);

  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);

    void loadAttendanceData(initialHistoryMonth.current, { resetHistoryPage: true });

    return () => clearInterval(timer);
  }, [loadAttendanceData]);

  const handleToggleShift = async () => {
    if (submitLockRef.current) return;
    if (shiftState === 'STALE_OPEN_SHIFT') return;
    const canStartCurrentShift = canStartAttendanceShift({
      record: todayRecord,
      currentShiftName: getAttendanceShiftName(liveTime),
      multiCheckEnabled,
    });
    if (shiftState === 'NO_OPEN_SHIFT' && todayRecord?.check_out && !canStartCurrentShift) return;

    if (!worker) {
      showToast('Lỗi', 'Không tìm thấy hồ sơ nhân sự!', 'error');
      return;
    }

    const action = shiftState === 'ACTIVE_SHIFT_TODAY' ? 'check_out' : 'check_in';
    submitLockRef.current = true;
    setSubmitting(true);
    setMutationError(null);

    try {
      let coordinates: { userLat: number; userLng: number } | undefined;
      if (action === 'check_in') {
        if (!navigator.geolocation) {
          throw new Error('Thiết bị không hỗ trợ định vị GPS.');
        }

        const position = await getCurrentPosition();
        coordinates = {
          userLat: position.coords.latitude,
          userLng: position.coords.longitude,
        };
      }

      const response = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          month: historyMonthInput,
          ...coordinates,
        }),
      });

      const result = (await response.json().catch(() => null)) as StaffAttendanceMutationPayload | null;

      if (!response.ok) {
        const errorState = {
          message: messageForAttendanceError(result),
          correlationId: result?.correlationId,
        };
        setMutationError(errorState);
        showToast('Không thể cập nhật ca làm', errorState.message, 'error');
        if (result?.code === 'attendance_already_checked_out') {
          void loadAttendanceData(historyMonthInput, {
            showLoading: false,
            preserveVisibleDataOnError: true,
          });
        }
        return;
      }

      if (!result?.record) {
        throw new Error('Phản hồi chấm công không đầy đủ. Vui lòng thử lại.');
      }

      if (action === 'check_out') {
        const refreshed = await loadAttendanceData(historyMonthInput, {
          showLoading: false,
          preserveVisibleDataOnError: true,
        });
        if (!refreshed) applyMutationRecord(result.record);
      } else {
        applyMutationRecord(result.record);
      }
      showToast('Cập nhật ca làm', result?.message || 'Đã ghi nhận chấm công.', 'success');
    } catch (error) {
      const message = isGeolocationError(error)
        ? 'Vui lòng mở quyền truy cập vị trí GPS mức chính xác cao!'
        : error instanceof Error ? error.message : 'Không thể chấm công.';
      setMutationError({ message });
      showToast('Không thể cập nhật ca làm', message, 'error');
    } finally {
      submitLockRef.current = false;
      setSubmitting(false);
    }
  };

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
    return total + getFinalizedShiftUnitsForRecord(record);
  }, 0);
  const activeShiftElapsedMinutes =
    shiftState === 'ACTIVE_SHIFT_TODAY' && currentShift
      ? getWorkedMinutesForRecord(currentShift, liveTime)
      : 0;
  const finalizedTodayMinutes =
    todayRecord && isAttendanceRecordComplete(todayRecord)
      ? getWorkedMinutesForRecord(todayRecord)
      : 0;
  const finalizedTodayShiftUnits =
    todayRecord ? getFinalizedShiftUnitsForRecord(todayRecord) : 0;
  const canContinueCurrentShift = canContinueAttendanceShift({
    record: todayRecord,
    currentShiftName: getAttendanceShiftName(liveTime),
    multiCheckEnabled,
  });
  const canStartCurrentShift = canStartAttendanceShift({
    record: todayRecord,
    currentShiftName: getAttendanceShiftName(liveTime),
    multiCheckEnabled,
  });
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

      {shiftState === 'ACTIVE_SHIFT_TODAY' && currentShift && (
        <div className="w-full rounded-lg border border-blue-500/30 bg-blue-950/20 p-4" role="status">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-400" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-blue-300">Bạn đang trong ca làm việc</p>
              <p className="mt-1 text-[11px] text-slate-300">
                Vào lúc {currentShift.check_in?.slice(0, 5)} · Đã làm{' '}
                {formatWorkedDuration(activeShiftElapsedMinutes)}
              </p>
            </div>
          </div>
        </div>
      )}

      {shiftState === 'STALE_OPEN_SHIFT' && staleOpenShift && (
        <div className="w-full rounded-lg border border-amber-500/40 bg-amber-950/30 p-4" role="alert">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-xs font-bold text-amber-300">
                Có ca làm trước đó chưa được kết thúc.
              </p>
              <p className="mt-1 text-[11px] text-amber-100/90">
                Ngày {formatBusinessDate(businessDateFromDateInput(staleOpenShift.work_date))},
                vào lúc {staleOpenShift.check_in?.slice(0, 5)}.
              </p>
              <p className="mt-1 text-[11px] text-amber-200/90">
                Vui lòng báo quản lý xử lý. Chức năng khôi phục ca hiện chưa được kích hoạt.
              </p>
            </div>
          </div>
        </div>
      )}

      {shiftState === 'NO_OPEN_SHIFT' && todayRecord?.check_out && (
        <div className="w-full bg-emerald-950/20 border border-emerald-900/40 p-4 rounded-2xl flex flex-col items-center justify-center space-y-2 animate-fadeIn">
          <CheckCircle2 className="w-6 h-6 text-emerald-400" />
          <p className="text-xs font-bold text-emerald-400">Ca làm việc đã hoàn thành!</p>
          <p className="text-center text-[11px] text-emerald-100/80">
            {canContinueCurrentShift
              ? 'Bạn có thể tiếp tục làm việc trong cùng ca này.'
              : canStartCurrentShift
                ? 'Ca hiện tại đã chuyển. Bạn có thể bắt đầu ca mới.'
                : 'Ca hiện tại đã được ghi nhận. Bạn không cần chấm công lại.'}
          </p>
          <div className="grid w-full grid-cols-2 gap-2 border-t border-emerald-900/30 pt-2 text-[11px] font-mono">
            <span className="text-slate-400">Ca: {todayRecord.shift_name}</span>
            <span className="text-right text-slate-400">Trạng thái: Đã ghi nhận</span>
            <span className="text-slate-400">Vào: {todayRecord.check_in?.slice(0, 5)}</span>
            <span className="text-right text-slate-400">Ra: {todayRecord.check_out?.slice(0, 5)}</span>
          </div>
          <div className="flex flex-col sm:flex-row justify-between gap-1 w-full text-[11px] font-mono border-t border-emerald-900/30 pt-2 mt-2">
            <span className="text-slate-400">Thời gian: {formatWorkedDuration(finalizedTodayMinutes)}</span>
            <span className="text-emerald-300 font-bold">Ca quy đổi: {finalizedTodayShiftUnits} ca</span>
          </div>
        </div>
      )}

      {!fetching && !fetchError && shiftState !== 'STALE_OPEN_SHIFT' &&
        (!(shiftState === 'NO_OPEN_SHIFT' && todayRecord?.check_out) || canStartCurrentShift) && (
        <button
          type="button"
          onClick={handleToggleShift}
          disabled={submitting}
          aria-busy={submitting}
          className={`inline-flex min-h-12 w-full max-w-xs items-center justify-center gap-2 rounded-lg border px-5 py-3 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:pointer-events-none disabled:opacity-60 ${
            shiftState === 'ACTIVE_SHIFT_TODAY'
              ? 'border-red-500/50 bg-red-950/40 text-red-200 hover:bg-red-900/50 focus:ring-red-400'
              : 'border-emerald-500/50 bg-emerald-950/40 text-emerald-200 hover:bg-emerald-900/50 focus:ring-emerald-400'
          }`}
        >
          {shiftState === 'ACTIVE_SHIFT_TODAY' ? (
            <LogOut className="h-4 w-4" />
          ) : (
            <LogIn className="h-4 w-4" />
          )}
          <span>
            {submitting
              ? shiftState === 'ACTIVE_SHIFT_TODAY'
                ? 'Đang kết thúc ca...'
                : 'Đang bắt đầu ca...'
              : shiftState === 'ACTIVE_SHIFT_TODAY'
                ? 'Kết thúc ca'
              : canContinueCurrentShift
                ? 'Tiếp tục làm việc'
                : 'Bắt đầu ca'}
          </span>
        </button>
      )}

      {mutationError && (
        <div className="w-full rounded-lg border border-red-500/30 bg-red-950/30 p-3 text-sm text-red-100" role="alert">
          <p>{mutationError.message}</p>
          {mutationError.correlationId && (
            <p className="mt-1 font-mono text-[10px] text-red-200/70">
              Mã hỗ trợ: {mutationError.correlationId}
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleToggleShift()}
            disabled={submitting || shiftState === 'STALE_OPEN_SHIFT'}
            className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-md border border-red-400/30 px-3 py-2 text-xs font-bold hover:bg-red-900/40 disabled:opacity-60"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            Thử lại
          </button>
        </div>
      )}

      <span className="text-[9px] text-purple-400 font-mono text-center bg-slate-950 p-2 rounded-lg border border-slate-800 w-full">
        Hệ thống nhận diện ca: {getAttendanceShiftName(liveTime)}
      </span>

      <div className="grid grid-cols-2 gap-3 w-full">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Hôm nay</p>
          <p className="mt-1 text-sm font-black text-amber-400 font-mono">
            {shiftState === 'ACTIVE_SHIFT_TODAY'
              ? formatWorkedDuration(activeShiftElapsedMinutes)
              : formatWorkedDuration(finalizedTodayMinutes)}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
          <p className="text-[10px] text-slate-500 font-bold uppercase">Ca đã chốt</p>
          <p className="mt-1 text-sm font-black text-purple-400 font-mono">
            {finalizedTodayShiftUnits} ca
          </p>
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
                if (worker) {
                  void loadAttendanceData(value, { resetHistoryPage: true });
                }
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

        <DataTableShell label="Lịch sử chấm công" height="compact" isRefreshing={fetching && attendanceHistory.length > 0}>
          {fetching && attendanceHistory.length === 0 ? (
            <DataTableSkeleton rows={HISTORY_ITEMS_PER_PAGE} columns={5} />
          ) : fetchError ? (
            <DataTableError message={fetchError} onRetry={() => void loadAttendanceData(historyMonthInput)} />
          ) : (
          <>
        <div className="space-y-2 p-2 md:hidden">
          {attendanceHistory.length === 0 ? (
            <div className="rounded-xl border border-slate-800 bg-slate-900/50 px-3 py-6 text-center text-[11px] text-slate-500 italic">
              Chưa có dữ liệu chấm công trong tháng này.
            </div>
          ) : (
            paginatedAttendanceHistory.map((record) => {
              const isComplete = isAttendanceRecordComplete(record);
              const workedMinutes = getWorkedMinutesForRecord(record);
              const displayHours = Number((workedMinutes / 60).toFixed(2));
              const shiftUnits = getFinalizedShiftUnitsForRecord(record);
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
                  const shiftUnits = getFinalizedShiftUnitsForRecord(record);
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

        <DataTablePagination page={safeHistoryPage} pageSize={HISTORY_ITEMS_PER_PAGE} total={attendanceHistory.length} onPageChange={setHistoryPage} />
          </>
          )}
        </DataTableShell>
      </div>
    </div>
  );
}
