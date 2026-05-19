// app/admin/attendance/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { CalendarDays, User, RefreshCcw, ChevronLeft, ChevronRight, X, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

export default function AdminAttendanceCalendar() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Điều khiển bộ lọc tháng (Định dạng YYYY-MM)
  const [monthInput, setMonthInput] = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  const year = Number(monthInput.split('-')[0]);
  const month = Number(monthInput.split('-')[1]);

  // States quản lý Popup Xếp Ca / Đổi Ca làm việc cho thợ
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [clickedDay, setClickedDay] = useState<number | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState<number>(1); // Mặc định ca 1

  const loadInitialData = async () => {
    setLoading(true);
    try {
      // 1. Kéo toàn bộ danh sách thợ đang hoạt động để sếp chọn lọc trên dropdown
      const { data: emps } = await supabase.from('employees').select('id, full_name').eq('status', 'ACTIVE').order('id', { ascending: true });
      setEmployees(emps || []);
      
      if (emps && emps.length > 0 && !selectedEmployeeId) {
        setSelectedEmployeeId(emps[0].id.toString());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendanceCalendar = async () => {
    if (!selectedEmployeeId) return;
    setLoading(true);
    try {
      // Định dạng ngày bắt đầu và kết thúc tháng để quét DB
      const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
      const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

      // 2. Truy vấn nhật ký chấm công ca của thợ được chọn trong tháng đó
      const { data: logs } = await supabase
        .from('attendance_log')
        .select('*')
        .eq('employee_id', Number(selectedEmployeeId))
        .gte('work_date', startDate)
        .lte('work_date', endDate);
        
      setAttendanceLogs(logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadInitialData(); }, []);
  useEffect(() => { loadAttendanceCalendar(); }, [selectedEmployeeId, monthInput]);

  // THUẬT TOÁN XỬ LÝ LỊCH VẠN NIÊN CHO XƯỞNG
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayIndex = new Date(year, month - 1, 1).getDay(); // Ngày đầu tháng rơi vào thứ mấy (0: Chủ nhật)
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1; // Ép Thứ 2 lên đầu bảng

  const totalCells = [];
  // Nạp ô trống đệm cho các ngày của tháng trước
  for (let i = 0; i < adjustedFirstDayIndex; i++) { totalCells.push(null); }
  // Nạp toàn bộ các ngày thực tế của tháng này
  for (let i = 1; i <= daysInMonth; i++) { totalCells.push(i); }

  // HÀM: BẬT POPUP KHI CLICK VÀO Ô LỊCH ĐỂ XẾP CA CHO THỢ
  const handleDayClick = (day: number) => {
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const existingLog = attendanceLogs.find(l => l.work_date === formattedDate);
    
    setClickedDay(day);
    setSelectedShiftId(existingLog ? existingLog.shift_id : 1);
    setShowShiftModal(true);
  };

  // HÀM: LƯU HOẶC HỦY CA LÀM VIỆC LÊN CLOUD DATABASE
  const handleSaveShift = async () => {
    if (!clickedDay || !selectedEmployeeId) return;
    const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(clickedDay).padStart(2, '0')}`;

    if (selectedShiftId === 0) {
      // Nếu sếp chọn "0 - Báo Nghỉ" ➔ Xóa dòng chấm công ca đó khỏi DB
      await supabase.from('attendance_log').delete().eq('employee_id', Number(selectedEmployeeId)).eq('work_date', formattedDate);
    } else {
      // Tiến hành chèn mới hoặc cập nhật đè (Upsert) nếu thợ đã đổi ca
      await supabase.from('attendance_log').upsert({
        employee_id: Number(selectedEmployeeId),
        work_date: formattedDate,
        shift_id: selectedShiftId,
        clock_in: selectedShiftId === 1 ? '08:00' : selectedShiftId === 2 ? '13:30' : '18:00',
        status: 'SCHEDULED'
      }, { onConflict: 'employee_id,work_date' });
    }

    setShowShiftModal(false);
    loadAttendanceCalendar();
    alert('✨ Hệ thống đã cập nhật và nạp lịch ca thợ thành công!');
  };

  // Tính số ngày công thợ đã đi làm trong tháng để sếp tiện đối soát
  const totalDaysScheduled = attendanceLogs.filter(l => l.shift_id > 0).length;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER BỘ LỌC ĐIỀU KHIỂN HỢP NHẤT */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-500" />
          <div>
            <h1 className="text-base font-bold">Lịch Chấm Công Ca & Phân Bổ Ca Trực Chuỗi</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Click trực tiếp lên ngày để sắp ca, đổi lịch trực hoặc báo nghỉ cho thợ xưởng</p>
          </div>
        </div>

        {/* CỤM ĐIỀU KHIỂN TRA CỨU NHANH */}
        <div className="flex flex-wrap gap-2 w-full md:w-auto items-center">
          <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs font-mono flex items-center gap-1.5 w-full sm:w-auto">
            <span className="text-slate-500 font-bold">KỲ:</span>
            <input type="month" className="bg-slate-950 border border-slate-800 rounded p-1 text-slate-200 focus:outline-none [color-scheme:dark] font-bold" value={monthInput} onChange={(e) => setMonthInput(e.target.value)} />
          </div>

          <div className="bg-slate-900 border border-slate-800 px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 w-full sm:w-auto">
            <User className="w-4 h-4 text-purple-400" />
            <span className="text-slate-500 font-bold whitespace-nowrap">THỢ:</span>
            <select className="bg-slate-950 border border-slate-800 rounded-lg p-1 text-xs text-blue-400 font-black focus:outline-none w-full sm:w-44" value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
              {employees.map(e => <option key={e.id} value={e.id}>👤 {e.full_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* THẺ PHÂN TÍCH NHANH CÔNG THỢ */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex justify-between items-center max-w-sm text-xs font-bold uppercase tracking-wider shadow-md">
        <div>
          <p className="text-slate-500 text-[10px]">Tổng số ca xếp trong kỳ {month}/{year}</p>
          <p className="text-base font-black text-emerald-400 font-mono mt-1">✓ {totalDaysScheduled} Ca Làm Việc</p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400"><CheckCircle2 className="w-5 h-5" /></div>
      </div>

      {/* KHUNG BẢNG LỊCH CHẤM CÔNG CA CHUYÊN NGHIỆP */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
        
        {/* TIÊU ĐỀ THỨ TRONG TUẦN */}
        <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800/60 pb-3">
          <div>Thứ 2</div><div>Thứ 3</div><div>Thứ 4</div><div>Thứ 5</div><div>Thứ 6</div><div>Thứ 7</div><div className="text-red-400/80">Chủ Nhật</div>
        </div>

        {/* GRID CÁC Ô NGÀY - TÍCH HỢP BADGE CA TO RÕ NÉT (SỬA LỖI SỐ 1 BÉ) */}
        <div className="grid grid-cols-7 gap-2">
          {totalCells.map((day, idx) => {
            if (day === null) {
              return <div key={`empty-${idx}`} className="bg-slate-950/20 border border-transparent rounded-xl h-16" />;
            }

            const formattedDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const matchedLog = attendanceLogs.find(l => l.work_date === formattedDate);
            const currentShiftId = matchedLog ? matchedLog.shift_id : null;

            return (
              <div 
                key={`day-${day}`} 
                onClick={() => handleDayClick(day)}
                className="relative bg-slate-950 border border-slate-800/80 rounded-xl h-16 flex items-center justify-center font-mono font-bold hover:border-blue-500/50 hover:bg-slate-900/40 transition cursor-pointer group"
              >
                {/* Số ngày chính giữa bảng */}
                <span className="text-xs text-slate-400 group-hover:text-white transition">{day}</span>

                {/* SỐ HIỆU CA TO RÕ NÉT PHỦ GÓC (ĐÃ SỬA LỖI MẮT KHÔNG NHÌN THẤY) */}
                {currentShiftId && (
                  <span className={`absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black text-slate-950 shadow-lg scale-105 border ${
                    currentShiftId === 1 ? 'bg-amber-400 border-amber-300' : currentShiftId === 2 ? 'bg-cyan-400 border-cyan-300' : 'bg-purple-400 border-purple-300'
                  }`} title={`Thợ trực ca số: ${currentShiftId}`}>
                    {currentShiftId}
                  </span>
                )}

                {/* Chỉ báo chấm công chân đáy */}
                {currentShiftId && <div className="absolute bottom-1 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              </div>
            );
          })}
        </div>

        {/* CHÚ THÍCH CÁC CA DƯỚI ĐÁY LỊCH */}
        <div className="pt-3 border-t border-slate-800/60 flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-400" /> Ca 1 (08h00 - 12h00)</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-cyan-400" /> Ca 2 (13h30 - 17h30)</div>
          <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-400" /> Ca 3 (18h00 - 22h00)</div>
        </div>
      </div>

      {/* POPUP XẾP LỊCH CA HOẶC BÁO NGHỈ CHO THỢ */}
      {showShiftModal && clickedDay && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-xs space-y-4 text-xs relative text-slate-200">
            <button onClick={() => setShowShiftModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            
            <div className="border-b border-slate-800 pb-2">
              <h3 className="font-black text-xs uppercase tracking-wider text-blue-400">📅 Phân bổ ca làm việc</h3>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Ngày: {clickedDay}/{month}/{year}</p>
            </div>

            <div className="space-y-3">
              <label className="text-slate-400 font-bold block">Chọn khung ca trực cho thợ:</label>
              <div className="space-y-2 font-semibold">
                <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-400 transition cursor-pointer">
                  <input type="radio" name="shift_select" checked={selectedShiftId === 1} onChange={() => setSelectedShiftId(1)} className="accent-amber-400" />
                  <span className="text-amber-400 font-bold font-mono">Ca 1</span> <span className="text-slate-400 text-[11px]">(Sáng 8h-12h)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-cyan-400 transition cursor-pointer">
                  <input type="radio" name="shift_select" checked={selectedShiftId === 2} onChange={() => setSelectedShiftId(2)} className="accent-cyan-400" />
                  <span className="text-cyan-400 font-bold font-mono">Ca 2</span> <span className="text-slate-400 text-[11px]">(Chiều 13h30-17h30)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-slate-800 rounded-xl hover:border-purple-400 transition cursor-pointer">
                  <input type="radio" name="shift_select" checked={selectedShiftId === 3} onChange={() => setSelectedShiftId(3)} className="accent-purple-400" />
                  <span className="text-purple-400 font-bold font-mono">Ca 3</span> <span className="text-slate-400 text-[11px]">(Tối 18h-22h)</span>
                </label>
                <label className="flex items-center gap-2 p-2.5 bg-slate-950 border border-red-900/50 rounded-xl hover:border-red-500 transition cursor-pointer bg-red-950/10">
                  <input type="radio" name="shift_select" checked={selectedShiftId === 0} onChange={() => setSelectedShiftId(0)} className="accent-red-500" />
                  <span className="text-red-400 font-bold font-mono">Ca 0</span> <span className="text-slate-500 text-[11px]">(Báo nghỉ / Xóa ca)</span>
                </label>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button onClick={() => setShowShiftModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-slate-500">Hủy</button>
              <button onClick={ someId => handleSaveShift()} className="flex-1 bg-blue-600 hover:bg-blue-700 p-2.5 rounded-xl font-black uppercase text-white shadow-lg tracking-wider">Xác Nhận</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}