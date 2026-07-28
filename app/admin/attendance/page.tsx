// app/admin/attendance/page.tsx
'use client';
import { useCallback, useEffect, useState } from 'react';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import DailyAttendanceModal from './components/DailyAttendanceModal';
import { Calendar as CalendarIcon, Clock, LayoutGrid, CreditCard, User } from 'lucide-react';
import { calculateHoursFromStrings } from '@/services/payrollService';
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
  calculateShiftUnitsFromMinutes,
  formatWorkedDuration,
  getWorkedMinutesForRecord,
  isAttendanceRecordComplete,
  isAttendanceRecordOverdue,
  isMissingCheckoutRecord,
  mergeAttendanceRecords,
} from '@/services/attendanceService';

interface PayrollSummary {
  totalShifts: number;
  totalHours: number;
}

interface AdminAttendancePayload {
  employees: Employee[];
  shifts: Shift[];
  attendanceRecords: AttendanceRecord[];
  sourceCounts?: {
    attendance: number;
    attendanceLogs: number;
  };
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

export default function AdminAttendanceManagement() {
  const { showToast, showConfirm } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [canAdjustAttendance, setCanAdjustAttendance] = useState(false);
  const [sourceCounts, setSourceCounts] = useState({ attendance: 0, attendanceLogs: 0 });

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

  const loadData = useCallback(async () => {
    setLoading(true);
    setLoadError(null);

    try {
      const response = await fetch(`/api/admin/attendance?month=${encodeURIComponent(monthInput)}`, {
        cache: 'no-store',
      });
      const payload = (await response.json().catch(() => null)) as AdminAttendancePayload | null;

      if (!response.ok || !payload) {
        throw new Error(messageForAttendanceLoadError(payload));
      }

      setEmployees(payload.employees || []);

      setShifts(payload.shifts || []);
      setAttendanceRecords(payload.attendanceRecords || []);
      setCanAdjustAttendance(Boolean(payload.permissions?.canAdjustAttendance));
      setSourceCounts(payload.sourceCounts || { attendance: 0, attendanceLogs: 0 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể tải dữ liệu chấm công.';
      setLoadError(message);
      showToast('Lỗi dữ liệu', message, 'error');
    } finally {
      setLoading(false);
    }
  }, [monthInput, showToast]);

  useEffect(() => { void loadData(); }, [loadData]);

  const handleGridDayClick = (dayStr: string) => {
    setEditDateStr(dayStr);
  };

  const calculatePayrollFromRecords = (targetRecords: AttendanceRecord[]): PayrollSummary => {
    const normalizedRecords = mergeAttendanceRecords(targetRecords);
    let totalShiftsCount = 0;
    let totalHoursAccumulated = 0;

    normalizedRecords.forEach((record) => {
      const workedMinutes = getWorkedMinutesForRecord(record);
      const decimalHours = workedMinutes > 0
        ? Number((workedMinutes / 60).toFixed(2))
        : calculateHoursFromStrings(record.check_in || null, record.check_out || null);

      totalShiftsCount += calculateShiftUnitsFromMinutes(workedMinutes);
      totalHoursAccumulated += decimalHours;
    });

    return { 
      totalShifts: totalShiftsCount, 
      totalHours: Number(totalHoursAccumulated.toFixed(2)),
    };
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
  const { firstWeekday: firstDayOfMonth, daysInMonth } = businessMonthCalendar(currentBusinessMonth);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto text-slate-400 bg-slate-950 min-h-screen font-sans">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 text-xs">
          Đang tải dữ liệu chấm công...
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-purple-500" /> Bảng chấm công</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Theo dõi thời gian thực tế và số ca quy đổi</p>
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
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-purple-400"/> Tổng ca quy đổi</span>
          <span className="text-2xl font-black font-mono text-purple-400 mt-1">{payrollSummary.totalShifts} <span className="text-sm font-sans text-slate-500">Ca</span></span>
        </div>
        
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-500"/> Tổng thời gian thực tế</span>
          <span className="text-2xl font-black font-mono text-amber-400 mt-1">{payrollSummary.totalHours} <span className="text-sm font-sans text-slate-500">Giờ</span></span>
        </div>
        
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold">Nguồn dữ liệu</span>
          <span className="text-sm font-black font-mono text-slate-200 mt-1">
            {sourceCounts.attendance} attendance · {sourceCounts.attendanceLogs} log cũ
          </span>
        </div>
      </div>

      {missingCheckoutRecords.length > 0 && (
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-2xl px-4 py-3 text-xs text-amber-100">
          <p className="font-bold text-amber-300">
            Đang có {missingCheckoutRecords.length} ca thiếu check-out
            {overdueCheckoutRecords.length > 0 ? `, trong đó ${overdueCheckoutRecords.length} ca đã quá giờ.` : '.'}
          </p>
          <p className="mt-1 text-amber-100/80">
            Hệ thống hiện chưa tự gửi email nhắc check-out. Giải pháp an toàn lúc này là mở từng ngày để bổ sung giờ ra, sau đó mình có thể nối tiếp bằng cron/email reminder theo `shift.end_time`.
          </p>
        </div>
      )}

      {/* FULL CALENDAR GRID */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <h2 className="text-sm font-black text-slate-100 uppercase tracking-wide flex items-center gap-1.5 border-b border-slate-800/60 pb-3">
          <LayoutGrid className="w-4 h-4 text-purple-400" /> Bảng phân lịch chi tiết theo ngày
        </h2>

        <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 select-none pt-2">
          <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-950/20 border border-transparent min-h-[90px] rounded-xl opacity-20"></div>)}

          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const currentLoopDateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            let rawDayRecords = attendanceRecords.filter((record) => record.work_date === currentLoopDateStr);
            
            if (filterEmployeeId) {
              rawDayRecords = rawDayRecords.filter((record) => String(record.employee_id) === String(filterEmployeeId));
            }
            const processedDayRecords = mergeAttendanceRecords(rawDayRecords);

            return (
              <div 
                key={`day-${day}`} 
                onClick={() => handleGridDayClick(currentLoopDateStr)} 
                className={`group relative min-h-[90px] p-2.5 rounded-xl bg-slate-950 border transition-all flex flex-col justify-between cursor-pointer hover:bg-slate-900 ${processedDayRecords.length > 0 ? 'border-purple-900/40 bg-gradient-to-b from-slate-950 to-purple-950/10 shadow-md hover:border-purple-500' : 'border-slate-850 hover:border-purple-500/50'}`}
              >
                <span className={`text-xs font-mono font-black ${processedDayRecords.length > 0 ? 'text-purple-400' : 'text-slate-400'}`}>{day}</span>
                <div>{processedDayRecords.length > 0 && <span className="block text-[9px] bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded md:px-1.5 py-0.5 font-bold uppercase truncate shadow-inner text-center md:text-left mt-1">👥 {processedDayRecords.length} Ca</span>}</div>

                {processedDayRecords.length > 0 && (
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-purple-500/40 p-3 rounded-xl shadow-2xl text-[10px] w-60 z-50 text-left space-y-1.5 font-sans pointer-events-none">
                    <p className="font-black text-purple-400 border-b border-slate-800 pb-1 font-mono uppercase tracking-wider flex items-center justify-between">
                      <span>📅 Ngày {day}/{currentMonth + 1}:</span>
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {processedDayRecords.map((rec, rIdx) => {
                        const isSuccessShift = isAttendanceRecordComplete(rec);
                        const currentEmp = employees.find((employee) => String(employee.id) === String(rec.employee_id));
                        const empTitle = currentEmp?.title || 'Chưa gán';
                        const workedMinutes = getWorkedMinutesForRecord(rec);
                        const shiftUnits = calculateShiftUnitsFromMinutes(workedMinutes);
                        
                        return (
                          <div key={rec.id || rIdx} className="border-b border-slate-850/50 pb-1.5 last:border-none last:pb-0">
                            <div className="flex justify-between items-center">
                              <p className="font-black text-slate-200 truncate pr-2">👤 {rec.employee_name || currentEmp?.full_name || 'Nhân sự'}</p>
                              <span className="text-[8px] px-1 bg-slate-950 border border-slate-800 rounded font-mono text-purple-400 font-bold shrink-0">{empTitle}</span>
                            </div>
                            <p className="text-[9px] text-slate-400 font-medium font-mono mt-0.5">⏱️ Khung: {rec.shift_name}</p>
                            <div className="grid grid-cols-2 gap-1 font-mono text-[9px] mt-0.5">
                              <span className="text-emerald-400 font-bold">Vào: {rec.check_in ? rec.check_in.slice(0,5) : '--:--'}</span>
                              <span className="text-red-400 font-bold">Ra: {rec.check_out ? rec.check_out.slice(0,5) : '--:--'}</span>
                            </div>
                            <div className="text-[8px] font-mono mt-1 text-right">
                              {isSuccessShift ? (
                                <span className="text-emerald-400 font-bold">
                                  {formatWorkedDuration(workedMinutes)} · {shiftUnits} ca
                                </span>
                              ) : (
                                <span className="text-amber-500 italic">Thiếu lượt Check-out</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
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
        onReload={loadData}
        showToast={showToast}
        showConfirm={showConfirm}
        canAdjust={canAdjustAttendance}
      />
    </div>
  );
}
