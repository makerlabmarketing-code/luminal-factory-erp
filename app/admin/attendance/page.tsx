// app/admin/attendance/page.tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import { DataTableError, DataTableShell, DataTableSkeleton } from '@/component/data-table/DataTable';
import DailyAttendanceModal from './components/DailyAttendanceModal';
import { Calendar as CalendarIcon, Clock, LayoutGrid, CreditCard, User } from 'lucide-react';
import {
  businessDateFromDateInput,
  businessMonthCalendar,
  businessMonthFromDateInput,
  businessMonthFromInstant,
  formatBusinessMonthInput,
} from '@/lib/business-date';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';
import {
  type AttendanceScopeSummary,
  calculateFinalizedAttendanceSummary,
  formatWorkedDuration,
  getWorkedMinutesForRecord,
  isAttendanceRecordComplete,
  isAttendanceRecordOverdue,
  isMissingCheckoutRecord,
  mergeAttendanceRecords,
  summarizeAttendanceScope,
} from '@/services/attendanceService';

interface PayrollSummary {
  totalShifts: number;
  totalHours: number;
}

interface AttendanceDayDetailsState {
  day: number;
  records: AttendanceRecord[];
}

interface AttendanceAuditEvent {
  id: number | string;
  attendance_id?: number | string | null;
  employee_id: number | string;
  actor_employee_id: number | string;
  operation: string;
  reason: string;
  before_state: Record<string, unknown>;
  after_state: Record<string, unknown>;
  correlation_id: string;
  occurred_at: string;
}

interface AdminAttendancePayload {
  employees: Employee[];
  shifts: Shift[];
  attendanceRecords: AttendanceRecord[];
  sourceCounts?: {
    attendance: number;
    attendanceLogs: number;
  };
  diagnostics?: AttendanceScopeSummary | null;
  auditEvents?: AttendanceAuditEvent[];
  permissions?: {
    canAdjustAttendance: boolean;
  };
  error?: string;
  code?: string;
  failure_stage?: string;
  supabase_error_code?: string | null;
}

function messageForAttendanceLoadError(payload: AdminAttendancePayload | null): string {
  if (payload?.code === 'attendance_permission_denied') {
    return 'Bạn không có quyền xem dữ liệu chấm công.';
  }

  if (payload?.code === 'attendance_mapping_failed') {
    return 'Không thể xử lý dữ liệu chấm công.';
  }

  if (payload?.code === 'attendance_configuration_failed') {
    return payload.error || 'Cấu hình chấm công chưa hợp lệ.';
  }

  return payload?.error || 'Không thể tải dữ liệu chấm công.';
}

function AttendanceDayDetailsPanel({
  day,
  month,
  records,
  employees,
}: AttendanceDayDetailsState & { month: number; employees: Employee[] }) {
  return (
    <aside
      id="attendance-day-details"
      role="tooltip"
      className="pointer-events-none fixed inset-x-4 bottom-4 z-[999999] max-h-[72vh] overflow-hidden rounded-2xl border border-purple-400/50 bg-slate-900/95 p-4 text-left font-sans shadow-[0_24px_80px_rgba(0,0,0,0.65)] backdrop-blur-xl md:left-auto md:right-6 md:w-[30rem] md:p-5"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-3">
        <div>
          <p className="text-base font-black text-purple-300">Chi tiết ngày {day}/{month}</p>
          <p className="mt-1 text-xs text-slate-400">{records.length} bản ghi chấm công</p>
        </div>
        <span className="rounded-lg border border-purple-400/30 bg-purple-500/10 px-2.5 py-1 text-xs font-bold text-purple-200">
          {records.filter(isAttendanceRecordComplete).length} công ca
        </span>
      </div>

      <div className="mt-3 max-h-[calc(72vh-5.5rem)] space-y-3 overflow-y-auto pr-1">
        {records.map((record, recordIndex) => {
          const isCompleted = isAttendanceRecordComplete(record);
          const employee = employees.find(
            (candidate) => String(candidate.id) === String(record.employee_id)
          );
          const workedMinutes = getWorkedMinutesForRecord(record);

          return (
            <div
              key={record.id || recordIndex}
              className="rounded-xl border border-slate-700/80 bg-slate-950/80 p-3.5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-black leading-5 text-slate-100">
                  {record.employee_name || employee?.full_name || 'Nhân sự'}
                </p>
                <span className="shrink-0 rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] font-bold text-purple-300">
                  {employee?.title || 'Chưa gán chức danh'}
                </span>
              </div>

              <p className="mt-2 text-xs font-semibold text-slate-300">Khung làm việc: {record.shift_name}</p>
              <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-xs">
                <span className="rounded-lg bg-emerald-500/10 px-2.5 py-2 font-bold text-emerald-300">
                  Vào: {record.check_in ? record.check_in.slice(0, 5) : '--:--'}
                </span>
                <span className="rounded-lg bg-rose-500/10 px-2.5 py-2 font-bold text-rose-300">
                  Ra: {record.check_out ? record.check_out.slice(0, 5) : '--:--'}
                </span>
              </div>

              <div className="mt-2 flex items-center justify-between gap-3 text-xs">
                <span className="text-slate-400">Thời gian thực tế: {formatWorkedDuration(workedMinutes)}</span>
                {isCompleted ? (
                  <span className="font-black text-emerald-300">1 công ca</span>
                ) : (
                  <span className="font-bold italic text-amber-400">Chưa tính công · thiếu giờ ra</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}

export default function AdminAttendanceManagement() {
  const { showToast, showConfirm } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canAdjustAttendance, setCanAdjustAttendance] = useState(false);
  const [sourceCounts, setSourceCounts] = useState({ attendance: 0, attendanceLogs: 0 });
  const [diagnostics, setDiagnostics] = useState<AttendanceScopeSummary | null>(null);
  const [auditEvents, setAuditEvents] = useState<AttendanceAuditEvent[]>([]);
  const loadRequestIdRef = useRef(0);

  // Bộ lọc chính cho toàn trang
  const [filterEmployeeId, setFilterEmployeeId] = useState('');

  // Định dạng YYYY-MM
  const [monthInput, setMonthInput] = useState(() => {
    return formatBusinessMonthInput(businessMonthFromInstant(new Date()));
  });

  const currentBusinessMonth = businessMonthFromDateInput(monthInput);
  const currentYear = currentBusinessMonth.year;
  const currentMonth = currentBusinessMonth.month - 1;

  // Trạng thái quản lý Modal chỉnh sửa chi tiết ngày
  const [editDateStr, setEditDateStr] = useState<string | null>(null);
  const [attendanceDayDetails, setAttendanceDayDetails] = useState<AttendanceDayDetailsState | null>(null);

  const loadData = useCallback(async () => {
    const requestId = ++loadRequestIdRef.current;
    setLoading(true);
    setLoadError(null);

    try {
      const searchParams = new URLSearchParams({ month: monthInput });
      if (filterEmployeeId) searchParams.set('employeeId', filterEmployeeId);
      const response = await fetch(`/api/admin/attendance?${searchParams.toString()}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as AdminAttendancePayload | null;

      if (!response.ok || !payload) {
        throw new Error(messageForAttendanceLoadError(payload));
      }
      if (requestId !== loadRequestIdRef.current) return;

      setEmployees(payload.employees || []);

      setShifts(payload.shifts || []);
      setAttendanceRecords(payload.attendanceRecords || []);
      setCanAdjustAttendance(Boolean(payload.permissions?.canAdjustAttendance));
      setSourceCounts(payload.sourceCounts || { attendance: 0, attendanceLogs: 0 });
      setDiagnostics(payload.diagnostics || null);
      setAuditEvents(payload.auditEvents || []);
    } catch (error) {
      if (requestId !== loadRequestIdRef.current) return;
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu chấm công.';
      setLoadError(message);
      showToast('Lỗi dữ liệu', message, 'error');
    } finally {
      if (requestId === loadRequestIdRef.current) setLoading(false);
    }
  }, [filterEmployeeId, monthInput, showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleGridDayClick = (dayStr: string) => {
    setEditDateStr(dayStr);
  };

  const handleRecordChanged = useCallback((record: AttendanceRecord, operation: 'create' | 'update' | 'delete') => {
    setAttendanceRecords((current) => {
      const withoutRecord = current.filter((item) => String(item.id) !== String(record.id));
      return operation === 'delete' ? withoutRecord : [...withoutRecord, record];
    });
  }, []);

  const calculatePayrollFromRecords = (targetRecords: AttendanceRecord[]): PayrollSummary => {
    return calculateFinalizedAttendanceSummary(targetRecords);
  };

  // TÍNH TOÁN ĐỒNG BỘ: Tính toán tổng giờ làm và tiền lương dựa trên định mức động từ Metadata
  const calculateFilteredPayroll = () => {
    let targetRecords = attendanceRecords.filter((record) => {
      const recordDate = businessDateFromDateInput(record.work_date);
      return recordDate.month === currentBusinessMonth.month && recordDate.year === currentBusinessMonth.year;
    });

    if (filterEmployeeId) {
      targetRecords = targetRecords.filter((record) => String(record.employee_id) === String(filterEmployeeId));
    }

    return calculatePayrollFromRecords(targetRecords);
  };
  const payrollSummary = calculateFilteredPayroll();
  const normalizedMonthlyRecords = mergeAttendanceRecords(
    attendanceRecords.filter((record) => {
      const recordDate = businessDateFromDateInput(record.work_date);
      const matchesMonth =
        recordDate.month === currentBusinessMonth.month && recordDate.year === currentBusinessMonth.year;
      const matchesEmployee =
        !filterEmployeeId || String(record.employee_id) === String(filterEmployeeId);

      return matchesMonth && matchesEmployee;
    })
  );
  const missingCheckoutRecords = normalizedMonthlyRecords.filter(isMissingCheckoutRecord);
  const overdueCheckoutRecords = missingCheckoutRecords.filter((record) =>
    isAttendanceRecordOverdue({
      record,
      shifts,
    })
  );
  const scopeSummary =
    diagnostics ||
    summarizeAttendanceScope({
      records: normalizedMonthlyRecords,
      monthInput,
    });
  const selectedMonthSummary = scopeSummary.selectedMonth;
  const outsideMonthSummary = scopeSummary.outsideSelectedMonth;
  const { firstWeekday: firstDayOfMonth, daysInMonth } = businessMonthCalendar(currentBusinessMonth);


  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-purple-500" /> Bảng chấm công</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Theo dõi thời gian thực tế và công ca hoàn tất</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl px-3 py-1.5 focus-within:border-purple-500 transition">
            <User className="w-4 h-4 text-slate-500 mr-2" />
            <select 
              className="bg-transparent text-xs font-bold text-slate-300 focus:outline-none cursor-pointer w-36" 
              value={filterEmployeeId} 
              onChange={e => setFilterEmployeeId(e.target.value)}
            >
              <option value="" className="bg-slate-900 text-slate-400">Tất cả nhân sự</option>
              {employees.map(e => <option key={e.id} value={e.id} className="bg-slate-900 text-slate-200">{e.full_name}</option>)}
            </select>
          </div>

          <MonthPicker value={monthInput} onChange={setMonthInput} accent="purple" />
          
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-[11px] font-bold text-slate-500 cursor-not-allowed"
            title="Sẽ triển khai sau khi Project Management foundation hoàn thành"
          >
            <CreditCard className="w-4 h-4"/>
            Quyết toán lương tháng
          </button>
        </div>
      </div>

      {loadError && (
        <div className="rounded-2xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-xs text-red-100">
          <p className="font-bold text-red-300">Không thể tải dữ liệu chấm công</p>
          <p className="mt-1 text-red-100/80">{loadError}</p>
          <button
            type="button"
            onClick={() => void loadData()}
            className="mt-3 rounded-lg border border-red-400/30 bg-red-950/40 px-3 py-1.5 text-[11px] font-bold text-red-100 hover:bg-red-900/40"
          >
            Thử lại
          </button>
        </div>
      )}

      {!canAdjustAttendance && !loadError && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-xs text-amber-100">
          <p className="font-bold text-amber-300">Chế độ chỉ xem</p>
          <p className="mt-1 text-amber-100/80">
            Điều chỉnh chấm công đang chờ xác nhận gói phân quyền và kiểm tra vận hành.
          </p>
        </div>
      )}

      {/* STATS & SETTLEMENT BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-purple-400"/> Công ca hoàn tất</span>
          <span className="text-2xl font-black font-mono text-purple-400 mt-1">{selectedMonthSummary.completed} <span className="text-sm font-sans text-slate-500">Công ca</span></span>
          <span className="mt-1 text-[10px] text-slate-500">Mỗi bản ghi hoàn tất = 1 công ca</span>
        </div>
        
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-500"/> Tổng thời gian thực tế</span>
          <span className="text-2xl font-black font-mono text-amber-400 mt-1">{payrollSummary.totalHours} <span className="text-sm font-sans text-slate-500">Giờ</span></span>
        </div>
        
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Phân loại</span>
          <span className="text-sm font-black font-mono text-slate-200 mt-1">
            {selectedMonthSummary.completed} hoàn tất · {selectedMonthSummary.open} chưa kết thúc
          </span>
          <span className="mt-1 text-[10px] text-slate-500">
            {selectedMonthSummary.excluded} bản ghi bị loại khỏi tổng hợp
          </span>
        </div>
      </div>

      <p className="text-[10px] text-slate-500">
        Nguồn trong phạm vi: {sourceCounts.attendance} attendance · {sourceCounts.attendanceLogs} log cũ
      </p>

      {filterEmployeeId && outsideMonthSummary.open > 0 && (
        <div className="bg-sky-950/20 border border-sky-500/20 rounded-2xl px-4 py-3 text-xs text-sky-100">
          <p className="font-bold text-sky-300">
            Có {outsideMonthSummary.open} ca từ tháng khác chưa kết thúc.
          </p>
          <p className="mt-1 text-sky-100/80">
            Các ca này không được tính vào tháng đang xem.
            {outsideMonthSummary.stale > 0
              ? ` Có ${outsideMonthSummary.stale} ca đã tồn tại từ ngày trước và cần kiểm tra.`
              : ''}
          </p>
        </div>
      )}

      {missingCheckoutRecords.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl px-4 py-3 text-xs text-amber-100">
          <p className="font-bold text-amber-300">
            Đang có {missingCheckoutRecords.length} ca thiếu check-out
            {overdueCheckoutRecords.length > 0 ? `, trong đó ${overdueCheckoutRecords.length} ca đã quá giờ.` : '.'}
          </p>
          <p className="mt-1 text-amber-100/80">
            Ca chưa kết thúc không được tính vào giờ hoặc số ca đã hoàn tất. Việc phục hồi cần được xử lý qua quy trình vận hành đã phê duyệt.
          </p>
        </div>
      )}

      {/* FULL CALENDAR GRID */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <DataTableShell label="Lịch chấm công theo tháng" height="viewport" isRefreshing={loading && attendanceRecords.length > 0}>
        {loading && attendanceRecords.length === 0 ? (
          <DataTableSkeleton rows={5} columns={7} />
        ) : loadError && attendanceRecords.length === 0 ? (
          <DataTableError message={loadError} onRetry={() => void loadData()} />
        ) : (
          <>
        <h2 className="text-sm font-black text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-800/60 pb-3">
          <LayoutGrid className="w-4 h-4 text-purple-400" /> Bảng phân lịch chi tiết theo ngày
        </h2>

        {selectedMonthSummary.records === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 px-4 py-3 text-xs text-slate-300">
            Không có bản ghi chấm công trong tháng đang chọn.
          </div>
        )}

        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 select-none pt-2">
          <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="min-h-[112px] rounded-xl border border-transparent bg-slate-950/20 opacity-20"></div>)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const currentLoopDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let rawDayRecords = attendanceRecords.filter((record) => record.work_date === currentLoopDateStr);
            
            if (filterEmployeeId) {
              rawDayRecords = rawDayRecords.filter((record) => String(record.employee_id) === String(filterEmployeeId));
            }
            const processedDayRecords = mergeAttendanceRecords(rawDayRecords);
            const completedDayRecords = processedDayRecords.filter(isAttendanceRecordComplete).length;

            return (
              <button
                type="button"
                key={`day-${day}`} 
                onClick={() => handleGridDayClick(currentLoopDateStr)} 
                onMouseEnter={() => processedDayRecords.length > 0 && setAttendanceDayDetails({ day, records: processedDayRecords })}
                onMouseLeave={() => setAttendanceDayDetails(null)}
                onFocus={() => processedDayRecords.length > 0 && setAttendanceDayDetails({ day, records: processedDayRecords })}
                onBlur={() => setAttendanceDayDetails(null)}
                aria-label={`Xem chi tiết chấm công ngày ${day}/${currentMonth + 1}`}
                aria-describedby={attendanceDayDetails?.day === day ? 'attendance-day-details' : undefined}
                className={`relative flex min-h-[112px] flex-col justify-between rounded-xl border bg-slate-950 p-3 text-left transition-all hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-400 ${processedDayRecords.length > 0 ? 'border-purple-900/40 bg-gradient-to-b from-slate-950 to-purple-950/10 shadow-md hover:border-purple-500' : 'border-slate-850 hover:border-purple-500/50'}`}
              >
                <span className={`font-mono text-sm font-black ${processedDayRecords.length > 0 ? 'text-purple-300' : 'text-slate-400'}`}>{day}</span>
                <div>{processedDayRecords.length > 0 && <span className="mt-2 block truncate rounded-md border border-purple-500/25 bg-purple-500/10 px-2 py-1 text-center text-[10px] font-bold uppercase text-purple-300 shadow-inner md:text-left">{completedDayRecords} công ca</span>}</div>
              </button>
            );
          })}
        </div>
        {attendanceDayDetails && createPortal(
          <AttendanceDayDetailsPanel
            {...attendanceDayDetails}
            month={currentMonth + 1}
            employees={employees}
          />,
          document.body
        )}
          </>
        )}
        </DataTableShell>
      </div>

      {/* COMPONENT MODAL CHI TIẾT NGÀY */}
      <DailyAttendanceModal 
        isOpen={!!editDateStr}
        dateStr={editDateStr}
        employees={employees}
        shifts={shifts}
        existingRecords={attendanceRecords.filter(r => r.work_date === editDateStr)}
        currentEmpId={filterEmployeeId}
        onClose={() => {
          setEditDateStr(null);
        }}
        onRecordChanged={handleRecordChanged}
        showToast={showToast}
        showConfirm={showConfirm}
        canAdjust={canAdjustAttendance}
        auditEvents={auditEvents}
      />
    </div>
  );
}
