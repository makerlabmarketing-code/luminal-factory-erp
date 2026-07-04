// app/admin/attendance/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import DailyAttendanceModal from './components/DailyAttendanceModal';
import { Calendar as CalendarIcon, Clock, RefreshCcw, LayoutGrid, Banknote, CreditCard, User } from 'lucide-react';
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';
import type { AttendanceRecord, Shift } from '@/lib/types/attendance';
import type { Employee } from '@/lib/types/employee';

interface SalaryMetadataItem {
  key?: string | null;
  level?: string | null;
  value?: number | string | null;
  rate?: number | string | null;
}

export default function AdminAttendanceManagement() {
  const { showToast, showConfirm } = useNotification();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [salaryMetadata, setSalaryMetadata] = useState<any[]>([]); // Lưu trữ danh mục cấu trúc lương động từ DB
  const [loading, setLoading] = useState(true);

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
      const finalEmps = emps || [];
      setEmployees(finalEmps);
      
      if (finalEmps.length > 0 && !filterEmployeeId) {
        setFilterEmployeeId(String(finalEmps[0].id));
      }

      // 3. Truy vấn ca làm việc
      const { data: sfs } = await supabase.from('shifts').select('*');
      let finalShifts = sfs || [];
      if (!finalShifts.some(s => s.shift_name.includes('Tối'))) {
        finalShifts.push({ id: 't_mock', shift_name: 'Ca Tối', start_time: '18:00:00', end_time: '22:00:00' });
      }
      setShifts(finalShifts);
      
      // 4. Truy vấn lịch sử chấm công
      const { data: atts } = await supabase.from('attendance').select('*').order('work_date', { ascending: false });
      setAttendanceRecords(atts || []);
    } catch (error) { 
      console.error(error); 
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleGridDayClick = (dayStr: string) => {
    setEditDateStr(dayStr);
  };

  // TÍNH TOÁN ĐỒNG BỘ: Tính toán tổng giờ làm và tiền lương dựa trên định mức động từ Metadata
  const calculateFilteredPayroll = () => {
    let targetRecords = attendanceRecords.filter(r => {
      const recordDate = new Date(r.work_date);
      return recordDate.getMonth() === currentMonth && recordDate.getFullYear() === currentYear;
    });

    if (filterEmployeeId) {
      targetRecords = targetRecords.filter(r => String(r.employee_id) === String(filterEmployeeId));
    }

    const uniqueRecordsMap: { [key: string]: any } = {};
    targetRecords.forEach(rec => {
      const uniqueKey = `${rec.employee_id}-${rec.work_date}-${rec.shift_name}`;
      if (!uniqueRecordsMap[uniqueKey]) uniqueRecordsMap[uniqueKey] = rec;
    });

    const validShiftList = Object.values(uniqueRecordsMap);
    let totalShiftsCount = 0;
    let totalHoursAccumulated = 0;
    let totalPayrollAmount = 0;

    validShiftList.forEach((rec: any) => {
      if (rec.check_in && rec.check_out) {
        totalShiftsCount++;
        
        // Trích xuất thông tin chức danh của nhân sự thuộc bản ghi này
        const empProfile = employees.find(e => String(e.id) === String(rec.employee_id));
        const empTitle = empProfile ? empProfile.title : '';
        const hourlyRate = getHourlyRateByTitle(empTitle);

        // Ưu tiên sử dụng số giờ tính toán chính xác lưu sẵn dưới DB, nếu chưa có thì tính từ chuỗi giờ công
        const decimalHours = rec.total_hours ? Number(rec.total_hours) : calculateHoursFromStrings(rec.check_in, rec.check_out);
        
        totalHoursAccumulated += decimalHours;
        totalPayrollAmount += calculateSalary(decimalHours, hourlyRate);
      }
    });

    return { 
      totalShifts: totalShiftsCount, 
      totalHours: Number(totalHoursAccumulated.toFixed(2)), 
      totalWage: totalPayrollAmount 
    };
  };

  const handleExecuteSettlementToCapital = async () => {
    const currentEmpProfile = employees.find(e => String(e.id) === String(filterEmployeeId));
    if (!currentEmpProfile) return showToast('Lỗi', 'Không xác định được nhân sự đối soát!', 'error');
    if (payrollSummary.totalWage <= 0) return showToast('Từ chối', 'Nhân sự này chưa phát sinh ca công hợp lệ trong tháng để kết toán lương!', 'error');

    const formattedPeriod = `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;
    const targetCategory = `Lương T.${currentMonth + 1} - ${currentEmpProfile.full_name}`;

    showConfirm(
      'Xác nhận quyết toán', 
      `Hệ thống sẽ tiến hành đồng bộ phiếu lương tháng ${currentMonth + 1} của Nhân sự [${currentEmpProfile.full_name}] với tổng số tiền là ${payrollSummary.totalWage.toLocaleString()}đ sang Sổ cái.`, 
      async () => {
        try {
          const { data: existingLedger } = await supabase.from('financial_ledger').select('id, amount').eq('month_period', formattedPeriod).eq('category', targetCategory).maybeSingle();

          if (existingLedger) {
            if (Number(existingLedger.amount) === Number(payrollSummary.totalWage)) {
              return showToast('Đã quyết toán', `Thành viên [${currentEmpProfile.full_name}] đã được hạch toán lương tháng này với số tiền ${payrollSummary.totalWage.toLocaleString()}đ trước đó rồi!`, 'error');
            } else {
              const { error: updateErr } = await supabase.from('financial_ledger').update({ amount: payrollSummary.totalWage, is_paid: false }).eq('id', existingLedger.id);
              if (updateErr) throw updateErr;
              showToast('Đã làm mới', `✓ Phát hiện thay đổi ngày công! Đã cập nhật lại số tiền lương mới: ${payrollSummary.totalWage.toLocaleString()}đ`, 'success');
            }
          } else {
            const { error: insertErr } = await supabase.from('financial_ledger').insert([{
              type: 'CHI_TIEU', category: targetCategory, amount: payrollSummary.totalWage, requested_by: currentEmpProfile.full_name, month_period: formattedPeriod, is_paid: false 
            }]);
            if (insertErr) throw insertErr;
            showToast('Thành công', `✓ Đã kết toán thành công phiếu lương trị giá ${payrollSummary.totalWage.toLocaleString()}đ!`, 'success');
          }
          loadData();
        } catch (err: any) { showToast('Thất bại', err.message, 'error'); }
      }
    );
  };

  const payrollSummary = calculateFilteredPayroll();
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
              <option value="" disabled className="bg-slate-900 text-slate-400">-- Chọn Nhân sự --</option>
              {employees.map(e => <option key={e.id} value={e.id} className="bg-slate-900 text-slate-200">{e.full_name}</option>)}
            </select>
          </div>

          <MonthPicker value={monthInput} onChange={setMonthInput} accent="purple" />
          
          <button onClick={loadData} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white hover:border-slate-700 transition" title="Làm mới dữ liệu">
            <RefreshCcw className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {/* STATS & SETTLEMENT BAR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
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
        
        <div className="flex items-center justify-center">
          <button 
            onClick={handleExecuteSettlementToCapital}
            className="w-full py-4 bg-gradient-to-br from-purple-600 to-purple-800 hover:from-purple-500 hover:to-purple-700 text-white transition rounded-xl font-bold tracking-wider text-[11px] uppercase flex items-center justify-center gap-2 shadow-lg border border-purple-500/50 hover:scale-[1.02]"
          >
            <CreditCard className="w-4 h-4" />
            Phát Lệnh Quyết Toán
          </button>
        </div>
      </div>

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
            let rawDayRecords = attendanceRecords.filter(r => r.work_date === currentLoopDateStr);
            
            if (filterEmployeeId) {
              rawDayRecords = rawDayRecords.filter(r => String(r.employee_id) === String(filterEmployeeId));
            }

            const uniqueDayRecordsMap: { [key: string]: any } = {};
            rawDayRecords.forEach(rec => {
              const uniqueKey = `${rec.employee_id}-${rec.shift_name}`;
              if (!uniqueDayRecordsMap[uniqueKey]) uniqueDayRecordsMap[uniqueKey] = { ...rec };
              else {
                if (rec.check_in && !uniqueDayRecordsMap[uniqueKey].check_in) uniqueDayRecordsMap[uniqueKey].check_in = rec.check_in;
                if (rec.check_out && !uniqueDayRecordsMap[uniqueKey].check_out) uniqueDayRecordsMap[uniqueKey].check_out = rec.check_out;
              }
            });

            const processedDayRecords = Object.values(uniqueDayRecordsMap);

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
                      {processedDayRecords.map((rec: any, rIdx) => {
                        const isSuccessShift = rec.check_in && rec.check_out;
                        const currentEmp = employees.find(e => String(e.id) === String(rec.employee_id));
                        const empTitle = currentEmp ? currentEmp.title : 'Chưa gán';
                        const hourlyRate = getHourlyRateByTitle(empTitle);
                        const decimalHours = rec.total_hours ? Number(rec.total_hours) : calculateHoursFromStrings(rec.check_in, rec.check_out);
                        const currentShiftWage = calculateSalary(decimalHours, hourlyRate);
                        
                        return (
                          <div key={rec.id || rIdx} className="border-b border-slate-850/50 pb-1.5 last:border-none last:pb-0">
                            <div className="flex justify-between items-center">
                              <p className="font-black text-slate-200 truncate pr-2">👤 {rec.employee_name}</p>
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

      {/* COMPONENT MODAL CHI TIẾT NGÀY */}
      <DailyAttendanceModal 
        isOpen={!!editDateStr}
        dateStr={editDateStr}
        employees={employees}
        shifts={shifts}
        existingRecords={attendanceRecords.filter(r => r.work_date === editDateStr)}
        currentEmpId={filterEmployeeId}
        onClose={() => setEditDateStr(null)}
        onReload={loadData}
        showToast={showToast}
        showConfirm={showConfirm}
      />
    </div>
  );
}
