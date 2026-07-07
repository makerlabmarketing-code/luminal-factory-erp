// app/admin/attendance/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import DailyAttendanceModal from './components/DailyAttendanceModal';
import { Calendar as CalendarIcon, Clock, LayoutGrid, Banknote, CreditCard, User, X } from 'lucide-react';
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';
import {
  calculateShiftUnitsFromHours,
  isAttendanceRecordComplete,
  isAttendanceRecordOverdue,
  isMissingCheckoutRecord,
  mergeAttendanceRecords,
} from '@/services/attendanceService';

interface SalaryMetadataItem {
  key?: string | null;
  level?: string | null;
  value?: number | string | null;
  rate?: number | string | null;
}

interface PayrollSummary {
  totalShifts: number;
  totalHours: number;
  totalWage: number;
}

interface EmployeePayrollSummary extends PayrollSummary {
  employee: Employee;
  recordCount: number;
}

function getPayrollPaymentPeriod(workMonthIndex: number, workYear: number) {
  const paymentDate = new Date(workYear, workMonthIndex + 1, 1);
  const paymentMonth = paymentDate.getMonth() + 1;
  const paymentYear = paymentDate.getFullYear();

  return {
    month: paymentMonth,
    year: paymentYear,
    formattedPeriod: `${String(paymentMonth).padStart(2, '0')}/${paymentYear}`,
  };
}

export default function AdminAttendanceManagement() {
  const { showToast, showConfirm } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryMetadata, setSalaryMetadata] = useState<SalaryMetadataItem[]>([]); // Lưu trữ danh mục cấu trúc lương động từ DB
  const [loading, setLoading] = useState(true);
  const [isSettlementModalOpen, setIsSettlementModalOpen] = useState(false);
  const [isSettlingPayroll, setIsSettlingPayroll] = useState(false);

  // Bộ lọc chính cho toàn trang
  const [filterEmployeeId, setFilterEmployeeId] = useState('');

  // Định dạng YYYY-MM
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const currentYear = parseInt(monthInput.split('-')[0]);
  const currentMonth = parseInt(monthInput.split('-')[1]) - 1;

  // Trạng thái quản lý Modal chỉnh sửa chi tiết ngày
  const [editDateStr, setEditDateStr] = useState<string | null>(null);

  // HÀM ĐỘNG: Tìm định mức lương/giờ dựa trên chức danh nhân sự và danh mục Metadata trung tâm
  const getHourlyRateByTitle = (title?: string | null): number => {
    if (!title || salaryMetadata.length === 0) return 30000; // Fallback mặc định 30k nếu chưa thiết lập
    
    const formattedTitle = title.trim().toUpperCase();
    // Tìm kiếm hàng dữ liệu có Key trùng với chức danh nhân sự (Ví dụ: A1, A2, A3)
    const matchedGrade = salaryMetadata.find(
      (item: any) => String(item.key || item.level || '').trim().toUpperCase() === formattedTitle
    );
    
    if (matchedGrade) {
      return Number(matchedGrade.value || matchedGrade.rate || 30000);
    }
    return 30000;
  };

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Truy vấn Metadata trung tâm để lấy danh mục Mức lương cơ bản
      const { data: metaData } = await supabase
        .from('system_metadata')
        .select('*')
        .ilike('name', '%mức lương cơ bản%')
        .maybeSingle();
      
      if (metaData && metaData.data) {
        setSalaryMetadata(metaData.data);
      }

      // 2. Truy vấn danh sách nhân sự
      const { data: emps } = await supabase.from('employees').select('id, full_name, title');
      const finalEmps = (emps || []) as Employee[];
      setEmployees(finalEmps);
      
      // 3. Truy vấn ca làm việc
      const { data: sfs } = await supabase.from('shifts').select('*');
      let finalShifts = (sfs || []) as Shift[];
      if (!finalShifts.some((shift) => shift.shift_name.includes('Tối'))) {
        finalShifts.push({ id: 't_mock', shift_name: 'Ca Tối', start_time: '18:00:00', end_time: '22:00:00' });
      }
      setShifts(finalShifts);
      
      // 4. Truy vấn lịch sử chấm công
      const { data: atts } = await supabase.from('attendance').select('*').order('work_date', { ascending: false });
      setAttendanceRecords((atts || []) as AttendanceRecord[]);
    } catch (error) { 
      console.error(error); 
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleGridDayClick = (dayStr: string) => {
    setEditDateStr(dayStr);
  };

  const calculatePayrollFromRecords = (targetRecords: AttendanceRecord[]): PayrollSummary => {
    const normalizedRecords = mergeAttendanceRecords(targetRecords);
    let totalShiftsCount = 0;
    let totalHoursAccumulated = 0;
    let totalPayrollAmount = 0;

    normalizedRecords.forEach((record) => {
      if (!isAttendanceRecordComplete(record)) return;

      const empProfile = employees.find((employee) => String(employee.id) === String(record.employee_id));
      const hourlyRate = getHourlyRateByTitle(empProfile?.title);
      const decimalHours = record.total_hours
        ? Number(record.total_hours)
        : calculateHoursFromStrings(record.check_in || null, record.check_out || null);

      totalShiftsCount += calculateShiftUnitsFromHours(decimalHours);
      totalHoursAccumulated += decimalHours;
      totalPayrollAmount += calculateSalary(decimalHours, hourlyRate);
    });

    return { 
      totalShifts: totalShiftsCount, 
      totalHours: Number(totalHoursAccumulated.toFixed(2)), 
      totalWage: totalPayrollAmount 
    };
  };

  // TÍNH TOÁN ĐỒNG BỘ: Tính toán tổng giờ làm và tiền lương dựa trên định mức động từ Metadata
  const calculateFilteredPayroll = () => {
    let targetRecords = attendanceRecords.filter((record) => {
      const recordDate = new Date(record.work_date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    if (filterEmployeeId) {
      targetRecords = targetRecords.filter((record) => String(record.employee_id) === String(filterEmployeeId));
    }

    return calculatePayrollFromRecords(targetRecords);
  };

  const buildEmployeePayrollSummaries = (): EmployeePayrollSummary[] => {
    return employees
      .map((employee) => {
        const employeeRecords = attendanceRecords.filter((record) => {
          const recordDate = new Date(record.work_date);
          return (
            recordDate.getMonth() === currentMonth &&
            recordDate.getFullYear() === currentYear &&
            String(record.employee_id) === String(employee.id)
          );
        });
        const summary = calculatePayrollFromRecords(employeeRecords);

        return {
          employee,
          recordCount: mergeAttendanceRecords(employeeRecords).filter(isAttendanceRecordComplete).length,
          ...summary,
        };
      })
      .filter((summary) => summary.totalWage > 0);
  };

  const settlePayrollSummary = async (summary: EmployeePayrollSummary) => {
    const paymentPeriod = getPayrollPaymentPeriod(currentMonth, currentYear);
    const formattedPeriod = paymentPeriod.formattedPeriod;
    const targetCategory = `Lương T.${currentMonth + 1} - ${summary.employee.full_name}`;
    const { data: existingLedger } = await supabase
      .from('financial_ledger')
      .select('id, amount')
      .eq('month_period', formattedPeriod)
      .eq('category', targetCategory)
      .maybeSingle();

    if (existingLedger) {
      if (Number(existingLedger.amount) === Number(summary.totalWage)) {
        return 'skipped';
      }

      const { error: updateErr } = await supabase
        .from('financial_ledger')
        .update({ amount: summary.totalWage, is_paid: false })
        .eq('id', existingLedger.id);
      if (updateErr) throw updateErr;
      return 'updated';
    }

    const { error: insertErr } = await supabase.from('financial_ledger').insert([{
      type: 'CHI_TIEU',
      category: targetCategory,
      amount: summary.totalWage,
      requested_by: summary.employee.full_name,
      month_period: formattedPeriod,
      is_paid: false
    }]);
    if (insertErr) throw insertErr;
    return 'inserted';
  };

  const handleOpenBulkSettlement = () => {
    if (employeePayrollSummaries.length === 0) {
      showToast('Từ chối', 'Tháng này chưa có công hợp lệ để phát lệnh quyết toán.', 'error');
      return;
    }

    setIsSettlementModalOpen(true);
  };

  const handleExecuteBulkSettlement = async () => {
    setIsSettlingPayroll(true);

    try {
      let inserted = 0;
      let updated = 0;
      let skipped = 0;

      for (const summary of employeePayrollSummaries) {
        const result = await settlePayrollSummary(summary);
        if (result === 'inserted') inserted += 1;
        if (result === 'updated') updated += 1;
        if (result === 'skipped') skipped += 1;
      }

      showToast(
        'Thành công',
        `Đã phát lệnh quyết toán: ${inserted} mới, ${updated} cập nhật, ${skipped} đã khớp.`,
        'success'
      );
      setIsSettlementModalOpen(false);
      await loadData();
    } catch (err: any) {
      showToast('Thất bại', err.message, 'error');
    } finally {
      setIsSettlingPayroll(false);
    }
  };

  const payrollSummary = calculateFilteredPayroll();
  const employeePayrollSummaries = buildEmployeePayrollSummaries();
  const paymentPeriod = getPayrollPaymentPeriod(currentMonth, currentYear);
  const bulkPayrollSummary = employeePayrollSummaries.reduce(
    (result, summary) => ({
      totalShifts: result.totalShifts + summary.totalShifts,
      totalHours: Number((result.totalHours + summary.totalHours).toFixed(2)),
      totalWage: result.totalWage + summary.totalWage,
    }),
    { totalShifts: 0, totalHours: 0, totalWage: 0 }
  );
  const normalizedMonthlyRecords = mergeAttendanceRecords(
    attendanceRecords.filter((record) => {
      const recordDate = new Date(record.work_date);
      const matchesMonth =
        recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
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
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER & FILTER BAR */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-purple-500" /> Bảng Chấm Công & Đối Soát Lương</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Quản lý chuyên sâu lịch trực và đồng bộ lương tự động</p>
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
          
          <button onClick={handleOpenBulkSettlement} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition" title="Phát lệnh quyết toán tổng">
            <CreditCard className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* STATS & SETTLEMENT BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-purple-400"/> Tổng ca trực máy</span>
          <span className="text-2xl font-black font-mono text-purple-400 mt-1">{payrollSummary.totalShifts} <span className="text-sm font-sans text-slate-500">Ca</span></span>
        </div>
        
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><Clock className="w-4 h-4 text-amber-500"/> Tổng số giờ làm việc</span>
          <span className="text-2xl font-black font-mono text-amber-400 mt-1">{payrollSummary.totalHours} <span className="text-sm font-sans text-slate-500">Giờ</span></span>
        </div>
        
        <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase font-bold flex items-center gap-1.5"><Banknote className="w-4 h-4 text-emerald-500"/> Lương dự kiến</span>
          <span className="text-2xl font-black font-mono text-emerald-400 mt-1">{payrollSummary.totalWage.toLocaleString('vi-VN')} <span className="text-sm font-sans text-slate-500">đ</span></span>
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
                        const hourlyRate = getHourlyRateByTitle(currentEmp?.title);
                        const decimalHours = rec.total_hours
                          ? Number(rec.total_hours)
                          : calculateHoursFromStrings(rec.check_in || null, rec.check_out || null);
                        const currentShiftWage = calculateSalary(decimalHours, hourlyRate);
                        
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
                                <span className="text-emerald-400 font-bold">Đạt công: +{currentShiftWage.toLocaleString()} đ</span>
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

      {isSettlementModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[110] animate-fadeIn">
          <div className="bg-[#131924] border border-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl text-slate-200">
            <div className="flex justify-between items-center p-5 border-b border-slate-800/80">
              <div>
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-purple-400" /> Phát lệnh quyết toán tổng
                </h2>
                <p className="text-[11px] text-slate-400 font-medium mt-1">
                  Công tháng {String(currentMonth + 1).padStart(2, '0')}/{currentYear} - ghi sổ kỳ {paymentPeriod.formattedPeriod} - {employeePayrollSummaries.length} nhân viên có công hợp lệ
                </p>
              </div>
              <button onClick={() => setIsSettlementModalOpen(false)} className="text-slate-500 hover:text-white transition p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 flex-1 custom-scrollbar">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Tổng ca quy đổi</span>
                  <p className="text-xl font-black font-mono text-purple-400 mt-1">{bulkPayrollSummary.totalShifts} Ca</p>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Tổng giờ</span>
                  <p className="text-xl font-black font-mono text-amber-400 mt-1">{bulkPayrollSummary.totalHours} Giờ</p>
                </div>
                <div className="bg-slate-950 border border-slate-850 p-3 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase font-bold">Tổng lương</span>
                  <p className="text-xl font-black font-mono text-emerald-400 mt-1">{bulkPayrollSummary.totalWage.toLocaleString('vi-VN')} đ</p>
                </div>
              </div>

              <div className="border border-slate-800 rounded-lg overflow-hidden">
                <div className="grid grid-cols-12 gap-2 bg-slate-950 px-3 py-2 text-[10px] text-slate-500 uppercase font-bold">
                  <div className="col-span-5">Nhân sự</div>
                  <div className="col-span-2 text-right">Ca</div>
                  <div className="col-span-2 text-right">Giờ</div>
                  <div className="col-span-3 text-right">Lương</div>
                </div>
                <div className="divide-y divide-slate-800/80">
                  {employeePayrollSummaries.map((summary) => (
                    <div key={summary.employee.id} className="grid grid-cols-12 gap-2 px-3 py-2.5 text-[11px] items-center">
                      <div className="col-span-5 min-w-0">
                        <p className="font-bold text-slate-200 truncate">{summary.employee.full_name}</p>
                        <p className="text-[10px] text-slate-500">{summary.recordCount} bản ghi công hợp lệ</p>
                      </div>
                      <div className="col-span-2 text-right font-mono text-purple-400 font-bold">{summary.totalShifts}</div>
                      <div className="col-span-2 text-right font-mono text-amber-400 font-bold">{summary.totalHours}</div>
                      <div className="col-span-3 text-right font-mono text-emerald-400 font-bold">{summary.totalWage.toLocaleString('vi-VN')} đ</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-5 border-t border-slate-800/80 flex flex-col sm:flex-row justify-end gap-3">
              <button
                onClick={() => setIsSettlementModalOpen(false)}
                disabled={isSettlingPayroll}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-[11px] font-bold text-slate-300 transition"
              >
                Đóng
              </button>
              <button
                onClick={handleExecuteBulkSettlement}
                disabled={isSettlingPayroll}
                className="px-4 py-2 bg-purple-700 hover:bg-purple-600 border border-purple-500/50 rounded-lg text-[11px] font-bold text-white transition flex items-center justify-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                {isSettlingPayroll ? 'Đang quyết toán...' : 'Xác nhận phát lệnh tổng'}
              </button>
            </div>
          </div>
        </div>
      )}

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
      />
    </div>
  );
}
