'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { X, Save, Plus, User, CheckCircle2, Trash2 } from 'lucide-react';

// Import các hàm tính toán chuẩn từ thư mục services bên ngoài
import { calculateHoursFromStrings, calculateSalary } from '@/services/payrollService';

interface DailyAttendanceModalProps {
  isOpen: boolean;
  dateStr: string | null;
  employees: any[];
  shifts: any[];
  existingRecords: any[];
  currentEmpId: string;
  onClose: () => void;
  onReload: () => void;
  showToast: (title: string, message: string, type: 'success' | 'error' | 'info') => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

export default function DailyAttendanceModal({
  isOpen,
  dateStr,
  employees,
  shifts,
  existingRecords,
  currentEmpId,
  onClose,
  onReload,
  showToast,
  showConfirm
}: DailyAttendanceModalProps) {
  const [editRows, setEditRows] = useState<Record<number, { check_in: string; check_out: string }>>({});
  
  const [newShift, setNewShift] = useState('');
  const [newIn, setNewIn] = useState('');
  const [newOut, setNewOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // LỌC CHUẨN XÁC: Chỉ lấy bản ghi của Nhân sự đang được chọn
  const myRecords = existingRecords.filter(rec => String(rec.employee_id) === String(currentEmpId));

  // Tự động tìm nhân sự và cấu hình mức lương dựa theo bảng Metadata danh mục mới (Mặc định fallback là 30000 nếu chưa gán)
  const currentEmployee = employees.find(e => String(e.id) === String(currentEmpId));
  const baseHourlyRate = currentEmployee?.hourly_rate || currentEmployee?.base_salary_per_hour || 30000;

  useEffect(() => {
    if (isOpen && myRecords) {
      const initialEdits: Record<number, { check_in: string; check_out: string }> = {};
      myRecords.forEach(rec => {
        initialEdits[rec.id] = {
          check_in: rec.check_in ? rec.check_in.substring(0, 5) : '', 
          check_out: rec.check_out ? rec.check_out.substring(0, 5) : ''
        };
      });
      setEditRows(initialEdits);
      setNewShift(shifts[0]?.shift_name || '');
      setNewIn('');
      setNewOut('');
    }
  }, [isOpen, existingRecords, currentEmpId, shifts]);

  if (!isOpen || !dateStr) return null;

  const handleUpdateRecord = async (recordId: number) => {
    setIsSubmitting(true);
    try {
      const rowData = editRows[recordId];
      const timeIn = rowData.check_in ? `${rowData.check_in}:00` : null;
      const timeOut = rowData.check_out ? `${rowData.check_out}:00` : null;

      // Tính toán lại số công giờ thập phân và tổng lương ca chính xác từ service chung
      const totalHours = calculateHoursFromStrings(timeIn, timeOut);
      const totalSalary = calculateSalary(totalHours, baseHourlyRate);

      const { error } = await supabase
        .from('attendance')
        .update({ 
          check_in: timeIn, 
          check_out: timeOut,
          total_hours: totalHours,    // Ghi nhận số giờ thập phân (Ví dụ: 3.00)
          total_salary: totalSalary   // Thành tiền chuẩn xác (Ví dụ: 90000)
        })
        .eq('id', recordId);

      if (error) throw error;
      showToast('Thành công', 'Đã cập nhật giờ công và đồng bộ lại tiền lương ca.', 'success');
      onReload();
    } catch (err: any) {
      showToast('Lỗi', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = (recordId: number, shiftName: string) => {
    showConfirm(
      'Xác nhận xóa', 
      `Bạn có chắc chắn muốn xóa bản ghi [${shiftName}] này không?`, 
      async () => {
        setIsSubmitting(true);
        try {
          const { error } = await supabase.from('attendance').delete().eq('id', recordId);
          if (error) throw error;
          showToast('Đã xóa', 'Bản ghi chấm công đã được gỡ bỏ.', 'info');
          onReload();
        } catch (err: any) {
          showToast('Lỗi', err.message, 'error');
        } finally {
          setIsSubmitting(false);
        }
      }
    );
  };

  const handleAddNewRecord = async () => {
    if (!currentEmpId || !newShift) return showToast('Thiếu dữ liệu', 'Vui lòng chọn nhân sự và ca làm việc', 'error');
    
    setIsSubmitting(true);
    try {
      if (!currentEmployee) throw new Error('Không tìm thấy dữ liệu nhân sự');

      const timeIn = newIn ? `${newIn}:00` : null;
      const timeOut = newOut ? `${newOut}:00` : null;

      // Tính toán các trường dữ liệu ngầm dựa trên service chung trước khi insert vào database
      const totalHours = calculateHoursFromStrings(timeIn, timeOut);
      const totalSalary = calculateSalary(totalHours, baseHourlyRate);

      const { error } = await supabase.from('attendance').insert([{
        employee_id: currentEmployee.id,
        employee_name: currentEmployee.full_name,
        work_date: dateStr,
        shift_name: newShift,
        check_in: timeIn,
        check_out: timeOut,
        total_hours: totalHours,      // Lưu số giờ chính xác 
        total_salary: totalSalary,    // Lưu số tiền không làm tròn lệch
        status: 'PRESENT'
      }]);

      if (error) throw error;
      showToast('Thành công', 'Đã bổ sung ca làm việc và tính toán lương chuẩn.', 'success');
      onReload();
      setNewIn(''); setNewOut('');
    } catch (err: any) {
      showToast('Lỗi', err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayDate = new Date(dateStr).toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
  const currentEmpName = currentEmployee?.full_name || 'Đang tải...';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
      <div className="bg-[#131924] border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-slate-200">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              CHI TIẾT CÔNG CA NGÀY
            </h2>
            <p className="text-[11px] text-slate-400 font-medium mt-1">{displayDate}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1"><X className="w-5 h-5"/></button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Các ca đã ghi nhận</h3>
            {myRecords.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-[11px] italic">
                Chưa có dữ liệu chấm công.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {myRecords.map((rec) => (
                  <div key={rec.id} className="bg-[#0b0f19] border border-slate-800 p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 text-slate-500 shrink-0"/> 
                        <span className="truncate">{rec.employee_name}</span>
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-500 font-mono">[{rec.shift_name}]</p>
                        {rec.total_hours > 0 && (
                          <span className="text-[10px] bg-slate-800/60 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                            {rec.total_hours}h → {Number(rec.total_salary).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-500 font-medium uppercase mb-1">Giờ Vào</label>
                        <input 
                          type="time" 
                          style={{ colorScheme: 'dark' }} 
                          value={editRows[rec.id]?.check_in || ''} 
                          onChange={(e) => setEditRows(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], check_in: e.target.value } }))}
                          className="bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none w-24"
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-500 font-medium uppercase mb-1">Giờ Ra</label>
                        <input 
                          type="time" 
                          style={{ colorScheme: 'dark' }}
                          value={editRows[rec.id]?.check_out || ''} 
                          onChange={(e) => setEditRows(prev => ({ ...prev, [rec.id]: { ...prev[rec.id], check_out: e.target.value } }))}
                          className="bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none w-24"
                        />
                      </div>
                      
                      <div className="flex items-center gap-1 mt-4">
                        <button 
                          onClick={() => handleUpdateRecord(rec.id)}
                          disabled={isSubmitting}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-md border border-transparent hover:border-blue-500/20 transition"
                          title="Lưu cập nhật"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={() => handleDeleteRecord(rec.id, rec.shift_name)}
                          disabled={isSubmitting}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-md border border-transparent hover:border-red-500/20 transition"
                          title="Xóa ca này"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-lg space-y-3 mt-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Plus className="w-3 h-3"/> Bổ sung ca thủ công
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">Nhân sự:</label>
                <div className="w-full bg-[#131924] border border-slate-800 px-2 py-1.5 rounded-md text-[11px] text-slate-500 cursor-not-allowed flex items-center gap-1.5 select-none">
                  <User className="w-3 h-3 shrink-0"/>
                  <span className="truncate" title={currentEmpName}>{currentEmpName}</span>
                </div>
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">Ca làm:</label>
                <select 
                  className="w-full bg-[#131924] border border-slate-800 px-2 py-1.5 rounded-md text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none" 
                  value={newShift} 
                  onChange={e => setNewShift(e.target.value)}
                >
                  {shifts.map(s => <option key={s.id} value={s.shift_name}>{s.shift_name}</option>)}
                </select>
              </div>
              
              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">Giờ Vào:</label>
                <input type="time" style={{ colorScheme: 'dark' }} value={newIn} onChange={e => setNewIn(e.target.value)} className="w-full bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none" />
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">Giờ Ra:</label>
                <input type="time" style={{ colorScheme: 'dark' }} value={newOut} onChange={e => setNewOut(e.target.value)} className="w-full bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none" />
              </div>
            </div>

            <div className="pt-2">
              <button 
                onClick={handleAddNewRecord}
                disabled={isSubmitting}
                className="w-full bg-[#131924] hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-2 rounded-md transition text-[11px] flex justify-center items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5"/> Lưu bản ghi bổ sung
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}