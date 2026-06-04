// app/admin/attendance/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import MonthPicker from '@/component/MonthPicker';
import DailyAttendanceModal from './components/DailyAttendanceModal';
import { Calendar as CalendarIcon, Clock, RefreshCcw, LayoutGrid, CalendarDays, Banknote, CreditCard } from 'lucide-react';

export default function AdminAttendanceManagement() {
  const { showToast, showConfirm } = useNotification();
  const [employees, setEmployees] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedEmpId, setSelectedEmpId] = useState('');
  const [selectedShiftName, setSelectedShiftName] = useState('');
  const [checkType, setCheckType] = useState('IN');
  
  const [filterEmployeeId, setFilterEmployeeId] = useState('');

  // Định dạng YYYY-MM
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const currentYear = parseInt(monthInput.split('-')[0]);
  const currentMonth = parseInt(monthInput.split('-')[1]) - 1;

  // Trạng thái cho điểm danh thủ công (Panel Trái)
  const [showPickerPopup, setShowPickerPopup] = useState(false);
  const [pickerDate, setPickerDate] = useState(new Date());
  const [pickerHour, setPickerHour] = useState('08');
  const [pickerMinute, setPickerMinute] = useState('00');
  const [pickerPeriod, setPickerPeriod] = useState('AM');

  // Trạng thái quản lý Modal chỉnh sửa chi tiết ngày
  const [editDateStr, setEditDateStr] = useState<string | null>(null);

  const GET_SHIFT_WAGE_BY_TITLE = (title: string) => {
    const formattedTitle = (title || '').trim().toUpperCase();
    if (formattedTitle === 'A1') return 150000; 
    return 100000; 
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: emps } = await supabase.from('employees').select('id, full_name, title');
      const finalEmps = emps || [];
      setEmployees(finalEmps);
      
      if (finalEmps.length > 0 && !filterEmployeeId) setFilterEmployeeId(String(finalEmps[0].id));

      const { data: sfs } = await supabase.from('shifts').select('*');
      let finalShifts = sfs || [];
      if (!finalShifts.some(s => s.shift_name.includes('Tối'))) {
        finalShifts.push({ id: 't_mock', shift_name: 'Ca Tối', start_time: '18:00:00', end_time: '22:00:00' });
      }
      setShifts(finalShifts);
      if (finalShifts.length > 0 && !selectedShiftName) setSelectedShiftName(finalShifts[0].shift_name);
      
      const { data: atts } = await supabase.from('attendance').select('*').order('work_date', { ascending: false });
      setAttendanceRecords(atts || []);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const getFormattedTime24h = () => {
    let hour = parseInt(pickerHour);
    if (pickerPeriod === 'PM' && hour !== 12) hour += 12;
    if (pickerPeriod === 'AM' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${pickerMinute}:00`;
  };

  const handleAdminCheckIn = async () => {
    if (!selectedEmpId) return showToast('Thiếu thông tin', 'Vui lòng chọn Nhân sự cần tính công!', 'error');
    const emp = employees.find(e => String(e.id) === String(selectedEmpId));
    if (!emp) return;

    const targetDateStr = pickerDate.toLocaleDateString('en-CA');
    const targetTimeStr = getFormattedTime24h();

    try {
      const { data: existing } = await supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('work_date', targetDateStr).eq('shift_name', selectedShiftName).maybeSingle();

      if (checkType === 'IN') {
        if (existing) await supabase.from('attendance').update({ check_in: targetTimeStr }).eq('id', existing.id);
        else await supabase.from('attendance').insert([{ employee_id: emp.id, employee_name: emp.full_name, work_date: targetDateStr, check_in: targetTimeStr, shift_name: selectedShiftName, status: 'PRESENT' }]);
        setCheckType('OUT');
      } else {
        if (existing) await supabase.from('attendance').update({ check_out: targetTimeStr }).eq('id', existing.id);
        else await supabase.from('attendance').insert([{ employee_id: emp.id, employee_name: emp.full_name, work_date: targetDateStr, check_out: targetTimeStr, shift_name: selectedShiftName, status: 'PRESENT' }]);
        setCheckType('IN');
      }
      showToast('Đồng bộ thành công', `Đã lưu thông số công ca cho Nhân sự [${emp.full_name}].`, 'success');
      loadData();
    } catch (err: any) { showToast('Lỗi kết nối', err.message, 'error'); }
  };

  // Mở modal khi bấm vào ô lịch
  const handleGridDayClick = (dayStr: string) => {
    setEditDateStr(dayStr);
  };

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
    let totalPayrollAmount = 0;

    validShiftList.forEach((rec: any) => {
      if (rec.check_in && rec.check_out) {
        totalShiftsCount++;
        const empProfile = employees.find(e => String(e.id) === String(rec.employee_id));
        const empTitle = empProfile ? empProfile.title : 'STANDARD';
        totalPayrollAmount += GET_SHIFT_WAGE_BY_TITLE(empTitle);
      }
    });

    return { totalShifts: totalShiftsCount, totalHours: totalShiftsCount * 3, totalWage: totalPayrollAmount };
  };

  const handleExecuteSettlementToCapital = async () => {
    const currentEmpProfile = employees.find(e => String(e.id) === String(filterEmployeeId));
    if (!currentEmpProfile) return showToast('Lỗi', 'Không xác định được nhân sự đối soát!', 'error');
    if (payrollSummary.totalWage <= 0) return showToast('Từ chối', 'Nhân sự này chưa phát sinh ca công hợp lệ trong tháng để kết toán lương!', 'error');

    const formattedPeriod = `${String(currentMonth + 1).padStart(2, '0')}/${currentYear}`;
    const targetCategory = `Lương T.${currentMonth + 1} - ${currentEmpProfile.full_name}`;

    showConfirm(
      'Xác nhận quyết toán', 
      `Hệ thống sẽ tiến hành đồng bộ hạch toán phiếu lương tháng ${currentMonth + 1} của Nhân sự [${currentEmpProfile.full_name}] với tổng số tiền là ${payrollSummary.totalWage.toLocaleString()}đ sang Sổ cái.`, 
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
        } catch (err: any) { showToast('Thất bại', err.message, 'error'); }
      }
    );
  };

  const payrollSummary = calculateFilteredPayroll();
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-base font-bold flex items-center gap-2"><CalendarIcon className="w-5 h-5 text-purple-500" /> Bảng Điều Hành Chấm Công Admin & Đối Soát Lương</h1>
        <button onClick={loadData} className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition"><RefreshCcw className="w-4 h-4"/></button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* PANEL TRÁI */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
          <h2 className="text-xs font-black uppercase tracking-wider text-purple-400 flex items-center gap-1.5 border-b border-slate-800 pb-3"><Clock className="w-4 h-4" /> Điểm danh thủ công Admin</h2>
          
          <div className="space-y-3 text-xs">
            <div>
              <label className="text-slate-400 font-bold block mb-1">1. Chọn thành viên xưởng:</label>
              <select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 focus:outline-none cursor-pointer" value={selectedEmpId} onChange={e => setSelectedEmpId(e.target.value)}>
                <option value="">-- Click chọn Nhân sự xưởng --</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.full_name} (Chức vụ: {e.title || 'Chưa gán'})</option>)}
              </select>
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">2. Chọn ca kíp trực:</label>
              <select className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-slate-200 focus:outline-none cursor-pointer" value={selectedShiftName} onChange={e => setSelectedShiftName(e.target.value)}>
                {shifts.map(s => <option key={s.id} value={s.shift_name}>⚙️ {s.shift_name}</option>)}
              </select>
            </div>

            <div className="relative">
              <label className="text-slate-400 font-bold block mb-1"><CalendarDays className="w-3.5 h-3.5 text-purple-400 inline mr-1" />3. Cấu hình Ngày & Giờ:</label>
              <div onClick={() => setShowPickerPopup(!showPickerPopup)} className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl font-mono text-purple-400 font-bold text-center cursor-pointer hover:border-purple-500 transition">
                📅 {pickerDate.toLocaleDateString('vi-VN')} — ⏱️ {pickerHour}:{pickerMinute} {pickerPeriod}
              </div>

              {showPickerPopup && (
                <div className="absolute left-0 right-0 mt-2 bg-slate-900 border border-purple-500/40 p-4 rounded-2xl shadow-2xl z-50 space-y-3 animate-fadeIn">
                  <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                    <span className="font-black text-purple-400 text-[10px] uppercase">Mốc thời gian điều phối</span>
                    <button onClick={() => setShowPickerPopup(false)} className="text-slate-400 hover:text-white font-bold text-xs">OK</button>
                  </div>
                  <div className="grid grid-cols-2 gap-3 items-center">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Đổi ngày lùi:</label>
                      <input type="date" className="w-full bg-slate-950 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-200 font-mono focus:outline-none" value={pickerDate.toLocaleDateString('en-CA')} onChange={(e) => { if(e.target.value) setPickerDate(new Date(e.target.value)) }} />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Khung giờ:</label>
                      <div className="flex gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-center font-mono font-bold text-xs">
                        <select className="bg-transparent focus:outline-none cursor-pointer w-1/3 text-amber-400" value={pickerHour} onChange={e => setPickerHour(e.target.value)}>
                          {Array.from({length: 12}, (_, i) => String(i+1).padStart(2,'0')).map(h => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span>:</span>
                        <select className="bg-transparent focus:outline-none cursor-pointer w-1/3 text-amber-400" value={pickerMinute} onChange={e => setPickerMinute(e.target.value)}>
                          {Array.from({length: 60}, (_, i) => String(i).padStart(2,'0')).map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                        <select className="bg-transparent focus:outline-none cursor-pointer w-1/3 text-purple-400" value={pickerPeriod} onChange={e => setPickerPeriod(e.target.value)}>
                          <option value="AM">AM</option><option value="PM">PM</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div>
              <label className="text-slate-400 font-bold block mb-1">4. Trạng thái ca kíp:</label>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button onClick={() => setCheckType('IN')} className="p-2.5 rounded-xl font-black text-[11px] transition bg-emerald-600 text-white shadow-lg">🟢 VÀO CA</button>
                <button onClick={() => setCheckType('OUT')} className="p-2.5 rounded-xl font-black text-[11px] transition bg-red-600 text-white shadow-lg">🔴 RỜI CA</button>
              </div>
            </div>
            <button onClick={handleAdminCheckIn} className="w-full bg-purple-600 hover:bg-purple-700 text-white font-black p-3 rounded-xl transition text-xs shadow-lg">✓ Thực thi hạch toán Cloud</button>
          </div>
        </div>

        {/* PANEL PHẢI */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-800/60 pb-3">
            <h2 className="text-sm font-black text-slate-100 uppercase tracking-wide flex items-center gap-1.5"><LayoutGrid className="w-4 h-4 text-purple-400" /> Bảng phân lịch đối soát ca trực</h2>
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
              <select className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300 focus:outline-none cursor-pointer" value={filterEmployeeId} onChange={e => setFilterEmployeeId(e.target.value)}>
                {employees.map(e => <option key={e.id} value={e.id}>👤 {e.full_name}</option>)}
              </select>

              <MonthPicker value={monthInput} onChange={setMonthInput} accent="purple" />

            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-950 border border-slate-850 p-4 rounded-xl font-medium text-xs relative group/box">
            <div className="space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1"><LayoutGrid className="w-3.5 h-3.5 text-purple-400"/> Tổng ca trực máy:</span>
              <span className="text-base font-black font-mono text-purple-400">{payrollSummary.totalShifts} Ca công</span>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 sm:border-x border-slate-850 pt-2 sm:pt-0 sm:px-4">
              <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1"><Clock className="w-3.5 h-3.5 text-amber-500"/> Tổng số giờ làm việc:</span>
              <span className="text-base font-black font-mono text-amber-400">{payrollSummary.totalHours} Giờ</span>
            </div>
            <div className="space-y-1 border-t sm:border-t-0 pt-2 sm:pt-0 sm:pl-3 flex flex-col justify-between">
              <div>
                <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1"><Banknote className="w-3.5 h-3.5 text-emerald-500"/> Lương dự kiến chi trả:</span>
                <span className="text-base font-black font-mono text-emerald-400">{payrollSummary.totalWage.toLocaleString('vi-VN')} đ</span>
              </div>
              
              <button 
                onClick={handleExecuteSettlementToCapital}
                className="mt-2 w-full bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600 text-purple-300 hover:text-white transition rounded-lg py-1.5 px-2 font-bold text-[10px] uppercase flex items-center justify-center gap-1 shadow-md"
              >
                <CreditCard className="w-3.5 h-3.5" /> Quyết toán lương
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 select-none pt-2">
            <div>CN</div><div>T2</div><div>T3</div><div>T4</div><div>T5</div><div>T6</div><div>T7</div>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} className="bg-slate-950/20 border border-transparent min-h-[75px] rounded-xl opacity-20"></div>)}

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
                  className={`group relative min-h-[85px] p-2 rounded-xl bg-slate-950 border transition-all flex flex-col justify-between cursor-pointer hover:bg-slate-900 ${processedDayRecords.length > 0 ? 'border-purple-900/40 bg-gradient-to-b from-slate-950 to-purple-950/10 shadow-lg' : 'border-slate-850 hover:border-purple-500/50'}`}
                >
                  <span className={`text-[11px] font-mono font-black ${processedDayRecords.length > 0 ? 'text-purple-400' : 'text-slate-400'}`}>{day}</span>
                  <div>{processedDayRecords.length > 0 && <span className="block text-[8px] bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded px-1 py-0.5 font-bold uppercase truncate">👥 {processedDayRecords.length} ca trực</span>}</div>

                  {processedDayRecords.length > 0 && (
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-slate-900 border border-purple-500/40 p-3 rounded-xl shadow-2xl text-[10px] w-56 z-50 text-left space-y-1.5 font-sans">
                      <p className="font-black text-purple-400 border-b border-slate-800 pb-1 font-mono uppercase tracking-wider flex items-center justify-between">
                        <span>📅 Ngày {day}/{currentMonth + 1}:</span>
                      </p>
                      <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                        {processedDayRecords.map((rec: any, rIdx) => {
                          const isSuccessShift = rec.check_in && rec.check_out;
                          const currentEmp = employees.find(e => String(e.id) === String(rec.employee_id));
                          const empTitle = currentEmp ? currentEmp.title : 'Chưa gán';
                          
                          return (
                            <div key={rec.id || rIdx} className="border-b border-slate-850/50 pb-1.5 last:border-none last:pb-0">
                              <div className="flex justify-between items-center">
                                <p className="font-black text-slate-200">👤 {rec.employee_name}</p>
                                <span className="text-[8px] px-1 bg-slate-950 border border-slate-800 rounded font-mono text-purple-400 font-bold">{empTitle}</span>
                              </div>
                              <p className="text-[9px] text-slate-400 font-medium font-mono mt-0.5">⏱️ Khung: {rec.shift_name}</p>
                              <div className="grid grid-cols-2 gap-1 font-mono text-[9px] mt-0.5">
                                <span className="text-emerald-400 font-bold">Vào: {rec.check_in ? rec.check_in.slice(0,5) : '--:--'}</span>
                                <span className="text-red-400 font-bold">Ra: {rec.check_out ? rec.check_out.slice(0,5) : '--:--'}</span>
                              </div>
                              <div className="text-[8px] font-mono mt-1 text-right">
                                {isSuccessShift ? (
                                  <span className="text-emerald-400 font-bold">Đạt công: +{GET_SHIFT_WAGE_BY_TITLE(empTitle).toLocaleString()} đ</span>
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