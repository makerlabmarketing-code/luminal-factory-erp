'use client';

import { useEffect, useState } from 'react';
import { X, Save, Plus, User, CheckCircle2, Trash2 } from 'lucide-react';
import type { AttendanceRecord, Shift, ToastType } from '@/lib/types/attendance';
import type { Employee } from "@/lib/types/employee";
import { businessDateFromDateInput, formatBusinessDate } from '@/lib/business-date';
import {
  deleteAttendanceRecord,
  getEmployeeHourlyRate,
  hasDuplicatedShift,
  updateAttendanceRecordTime,
  upsertAttendanceRecord,
} from '@/services/attendanceService';

interface DailyAttendanceModalProps {
  isOpen: boolean;
  dateStr: string | null;
  employees: Employee[];
  shifts: Shift[];
  existingRecords: AttendanceRecord[];
  currentEmpId: string;
  onClose: () => void;
  onReload: () => void;
  showToast: (title: string, message: string, type: ToastType) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
}

interface EditRow {
  check_in: string;
  check_out: string;
}

function getRecordKey(recordId: number | string): string {
  return String(recordId);
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
  showConfirm,
}: DailyAttendanceModalProps) {
  const [editRows, setEditRows] = useState<Record<string, EditRow>>({});
  const [newShift, setNewShift] = useState('');
  const [newIn, setNewIn] = useState('');
  const [newOut, setNewOut] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const myRecords = existingRecords.filter((record) => {
    return String(record.employee_id) === String(currentEmpId);
  });

  const currentEmployee = employees.find((employee) => {
    return String(employee.id) === String(currentEmpId);
  });

  const baseHourlyRate = getEmployeeHourlyRate(currentEmployee);

  useEffect(() => {
    if (!isOpen) return;

    const initialEdits: Record<string, EditRow> = {};

    myRecords.forEach((record) => {
      initialEdits[getRecordKey(record.id)] = {
        check_in: record.check_in ? record.check_in.substring(0, 5) : '',
        check_out: record.check_out ? record.check_out.substring(0, 5) : '',
      };
    });

    setEditRows(initialEdits);
    setNewShift(shifts[0]?.shift_name || '');
    setNewIn('');
    setNewOut('');
  }, [isOpen, existingRecords, currentEmpId, shifts]);

  if (!isOpen || !dateStr) return null;

  const handleUpdateRecord = async (recordId: number | string) => {
    setIsSubmitting(true);

    try {
      const rowData = editRows[getRecordKey(recordId)];

      if (!rowData) {
        showToast('Thiếu dữ liệu', 'Không tìm thấy dòng cần cập nhật.', 'error');
        return;
      }

      await updateAttendanceRecordTime({
        recordId,
        checkIn: rowData.check_in,
        checkOut: rowData.check_out,
        hourlyRate: baseHourlyRate,
      });

      showToast('Thành công', 'Đã cập nhật giờ công.', 'success');
      onReload();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật giờ công.';
      showToast('Lỗi', message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteRecord = (recordId: number | string, shiftName: string) => {
    showConfirm('Xác nhận xóa', `Bạn có chắc chắn muốn xóa bản ghi [${shiftName}] này không?`, async () => {
      setIsSubmitting(true);

      try {
        await deleteAttendanceRecord(recordId);
        showToast('Đã xóa', 'Bản ghi chấm công đã được gỡ bỏ.', 'info');
        onReload();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Không thể xóa bản ghi.';
        showToast('Lỗi', message, 'error');
      } finally {
        setIsSubmitting(false);
      }
    });
  };

  const handleAddNewRecord = async () => {
    if (!currentEmpId || !newShift) {
      showToast('Thiếu dữ liệu', 'Vui lòng chọn nhân sự và ca làm việc.', 'error');
      return;
    }

    if (!currentEmployee) {
      showToast('Lỗi', 'Không tìm thấy dữ liệu nhân sự.', 'error');
      return;
    }

    if (!newIn || !newOut) {
      showToast('Thiếu dữ liệu', 'Vui lòng nhập đủ giờ vào và giờ ra.', 'error');
      return;
    }

    const duplicated = hasDuplicatedShift({
      records: existingRecords,
      employeeId: currentEmployee.id,
      workDate: dateStr,
      shiftName: newShift,
    });

    if (duplicated) {
      showToast('Đã tồn tại', 'Nhân sự này đã có bản ghi cho ca đã chọn.', 'info');
      return;
    }

    setIsSubmitting(true);

    try {
      await upsertAttendanceRecord({
        employee: currentEmployee,
        workDate: dateStr,
        shiftName: newShift,
        checkIn: newIn,
        checkOut: newOut,
        hourlyRate: baseHourlyRate,
      });

      showToast('Thành công', 'Đã bổ sung ca làm việc.', 'success');
      onReload();
      setNewIn('');
      setNewOut('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể bổ sung ca làm việc.';
      showToast('Lỗi', message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const displayDate = formatBusinessDate(businessDateFromDateInput(dateStr), { weekday: 'long' });

  const currentEmpName = currentEmployee?.full_name || 'Đang tải...';

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
      <div className="bg-[#131924] border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-slate-200">
        <div className="flex justify-between items-center p-5 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              CHI TIẾT CÔNG CA NGÀY
            </h2>
            <p className="text-[11px] text-slate-400 font-medium mt-1">{displayDate}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              Các ca đã ghi nhận
            </h3>

            {myRecords.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-[11px] italic">
                Chưa có dữ liệu chấm công.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {myRecords.map((record) => (
                  <div
                    key={record.id}
                    className="bg-[#0b0f19] border border-slate-800 p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{record.employee_name || currentEmpName}</span>
                      </p>

                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-500 font-mono">[{record.shift_name}]</p>

                        {Number(record.total_hours || 0) > 0 && (
                          <span className="text-[10px] bg-slate-800/60 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                            {record.total_hours}h → {Number(record.total_salary || 0).toLocaleString('vi-VN')}đ
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-500 font-medium uppercase mb-1">
                          Giờ Vào
                        </label>
                        <input
                          type="time"
                          style={{ colorScheme: 'dark' }}
                          value={editRows[getRecordKey(record.id)]?.check_in || ''}
                          onChange={(event) =>
                            setEditRows((prev) => ({
                              ...prev,
                              [getRecordKey(record.id)]: {
                                ...prev[getRecordKey(record.id)],
                                check_in: event.target.value,
                              },
                            }))
                          }
                          className="bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none w-24"
                        />
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-500 font-medium uppercase mb-1">
                          Giờ Ra
                        </label>
                        <input
                          type="time"
                          style={{ colorScheme: 'dark' }}
                          value={editRows[getRecordKey(record.id)]?.check_out || ''}
                          onChange={(event) =>
                            setEditRows((prev) => ({
                              ...prev,
                              [getRecordKey(record.id)]: {
                                ...prev[getRecordKey(record.id)],
                                check_out: event.target.value,
                              },
                            }))
                          }
                          className="bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none w-24"
                        />
                      </div>

                      <div className="flex items-center gap-1 mt-4">
                        <button
                          onClick={() => handleUpdateRecord(record.id)}
                          disabled={isSubmitting}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-md border border-transparent hover:border-blue-500/20 transition"
                          title="Lưu cập nhật"
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteRecord(record.id, record.shift_name)}
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
              <Plus className="w-3 h-3" /> Bổ sung ca thủ công
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  Nhân sự:
                </label>
                <div className="w-full bg-[#131924] border border-slate-800 px-2 py-1.5 rounded-md text-[11px] text-slate-500 cursor-not-allowed flex items-center gap-1.5 select-none">
                  <User className="w-3 h-3 shrink-0" />
                  <span className="truncate" title={currentEmpName}>
                    {currentEmpName}
                  </span>
                </div>
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  Ca làm:
                </label>
                <select
                  className="w-full bg-[#131924] border border-slate-800 px-2 py-1.5 rounded-md text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none"
                  value={newShift}
                  onChange={(event) => setNewShift(event.target.value)}
                >
                  {shifts.map((shift) => (
                    <option key={shift.id} value={shift.shift_name}>
                      {shift.shift_name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  Giờ Vào:
                </label>
                <input
                  type="time"
                  style={{ colorScheme: 'dark' }}
                  value={newIn}
                  onChange={(event) => setNewIn(event.target.value)}
                  className="w-full bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  Giờ Ra:
                </label>
                <input
                  type="time"
                  style={{ colorScheme: 'dark' }}
                  value={newOut}
                  onChange={(event) => setNewOut(event.target.value)}
                  className="w-full bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleAddNewRecord}
                disabled={isSubmitting}
                className="w-full bg-[#131924] hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-2 rounded-md transition text-[11px] flex justify-center items-center gap-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Lưu bản ghi bổ sung
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
