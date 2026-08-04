'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { X, Save, Plus, User, CheckCircle2, Trash2 } from 'lucide-react';
import type { AttendanceRecord, Shift, ToastType } from '@/lib/types/attendance';
import type { Employee } from "@/lib/types/employee";
import { businessDateFromDateInput, formatBusinessDate } from '@/lib/business-date';
import {
  deleteAttendanceRecord,
  formatWorkedDuration,
  getEmployeeHourlyRate,
  getWorkedMinutesForRecord,
  hasDuplicatedShift,
  getFinalizedShiftUnitsForRecord,
  updateAttendanceRecordTime,
  upsertAttendanceRecord,
} from '@/services/attendanceService';
import { resolveAttendanceEmployeeSelection } from '@/lib/attendanceEmployeeSelection';

interface DailyAttendanceModalProps {
  isOpen: boolean;
  dateStr: string | null;
  employees: Employee[];
  shifts: Shift[];
  existingRecords: AttendanceRecord[];
  currentEmpId: string;
  onClose: () => void;
  onRecordChanged: (record: AttendanceRecord, operation: 'create' | 'update' | 'delete') => void;
  showToast: (title: string, message: string, type: ToastType) => void;
  showConfirm: (title: string, message: string, onConfirm: () => void) => void;
  canAdjust: boolean;
  auditEvents: AttendanceAuditEvent[];
}

interface EditRow {
  check_in: string;
  check_out: string;
}

interface AttendanceAuditEvent {
  id: number | string;
  operation: string;
  reason: string;
  correlation_id: string;
  occurred_at: string;
}

function editableTime(value?: string | null): string {
  return value ? value.substring(0, 5) : '';
}

function isRowDirty(record: AttendanceRecord, row?: EditRow): boolean {
  return Boolean(row) && (
    row?.check_in !== editableTime(record.check_in) ||
    row?.check_out !== editableTime(record.check_out)
  );
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
  onRecordChanged,
  showToast,
  showConfirm,
  canAdjust,
  auditEvents,
}: DailyAttendanceModalProps) {
  const [editRows, setEditRows] = useState<Record<string, EditRow>>({});
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [newShift, setNewShift] = useState('');
  const [newIn, setNewIn] = useState('');
  const [newOut, setNewOut] = useState('');
  const [createReason, setCreateReason] = useState('');
  const [createReasonError, setCreateReasonError] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [adjustmentReasonError, setAdjustmentReasonError] = useState('');
  const [pendingActions, setPendingActions] = useState<Record<string, boolean>>({});
  const mutationLocksRef = useRef(new Set<string>());
  const employeeSelectRef = useRef<HTMLSelectElement>(null);
  const createReasonRef = useRef<HTMLTextAreaElement>(null);
  const adjustmentReasonRef = useRef<HTMLTextAreaElement>(null);

  const myRecords = useMemo(() => existingRecords.filter((record) => {
    if (!currentEmpId) return true;

    return String(record.employee_id) === String(currentEmpId);
  }), [currentEmpId, existingRecords]);

  const employeeSelection = useMemo(
    () => resolveAttendanceEmployeeSelection(employees, selectedEmployeeId),
    [employees, selectedEmployeeId],
  );
  const currentEmployee = employeeSelection.employee;

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
    setSelectedEmployeeId(currentEmpId);
    setNewShift(shifts[0]?.shift_name || '');
    setNewIn('');
    setNewOut('');
    setCreateReason('');
    setCreateReasonError('');
    setAdjustmentReason('');
    setAdjustmentReasonError('');
    setPendingActions({});
    mutationLocksRef.current.clear();
  }, [currentEmpId, isOpen, myRecords, shifts]);

  if (!isOpen || !dateStr) return null;

  const beginAction = (actionKey: string): boolean => {
    if (mutationLocksRef.current.has(actionKey)) return false;
    mutationLocksRef.current.add(actionKey);
    setPendingActions((current) => ({ ...current, [actionKey]: true }));
    return true;
  };

  const endAction = (actionKey: string): void => {
    mutationLocksRef.current.delete(actionKey);
    setPendingActions((current) => {
      const next = { ...current };
      delete next[actionKey];
      return next;
    });
  };

  const isPending = (actionKey: string): boolean => Boolean(pendingActions[actionKey]);
  const isRowPending = (recordId: number | string): boolean =>
    isPending(`update:${getRecordKey(recordId)}`) || isPending(`delete:${getRecordKey(recordId)}`);

  const focusReason = (kind: 'create' | 'adjustment'): void => {
    (kind === 'create' ? createReasonRef : adjustmentReasonRef).current?.focus();
  };

  const handleUpdateRecord = async (recordId: number | string) => {
    if (!canAdjust) {
      showToast('KhÃ´ng cÃ³ quyá»n', 'Báº¡n khÃ´ng cÃ³ quyá»n Ä‘iá»u chá»‰nh cháº¥m cÃ´ng.', 'error');
      return;
    }

    const actionKey = `update:${getRecordKey(recordId)}`;
    if (!beginAction(actionKey)) return;

    try {
      const rowData = editRows[getRecordKey(recordId)];
      const targetRecord = myRecords.find((record) => String(record.id) === String(recordId));

      if (!rowData || !targetRecord) {
        showToast('Thiáº¿u dá»¯ liá»‡u', 'KhÃ´ng tÃ¬m tháº¥y dÃ²ng cáº§n cáº­p nháº­t.', 'error');
        return;
      }

      if (String(targetRecord.id).startsWith('log-')) {
        showToast('ChÆ°a thá»ƒ Ä‘iá»u chá»‰nh', 'Dá»¯ liá»‡u log cÅ© cáº§n Ä‘Æ°á»£c chuyá»ƒn Ä‘á»•i trÆ°á»›c khi sá»­a.', 'error');
        return;
      }

      if (!isRowDirty(targetRecord, rowData)) {
        showToast('ChÆ°a cÃ³ thay Ä‘á»•i', 'HÃ£y thay Ä‘á»•i giá» vÃ o hoáº·c giá» ra trÆ°á»›c khi lÆ°u.', 'info');
        return;
      }

      if (adjustmentReason.trim().length < 10) {
        focusReason('adjustment');
        setAdjustmentReasonError('Vui lÃ²ng nháº­p lÃ½ do Ä‘iá»u chá»‰nh cÃ³ Ã­t nháº¥t 10 kÃ½ tá»±.');
        return;
      }
      setAdjustmentReasonError('');

      const record = await updateAttendanceRecordTime({
        recordId,
        employeeId: targetRecord.employee_id,
        workDate: targetRecord.work_date,
        shiftName: targetRecord.shift_name,
        checkIn: rowData.check_in,
        checkOut: rowData.check_out,
        hourlyRate: baseHourlyRate,
        reason: adjustmentReason.trim(),
      });

      showToast('ThÃ nh cÃ´ng', 'ÄÃ£ cáº­p nháº­t giá» cÃ´ng.', 'success');
      onRecordChanged(record, 'update');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ cáº­p nháº­t giá» cÃ´ng.';
      showToast('Lá»—i', message, 'error');
    } finally {
      endAction(actionKey);
    }
  };

  const handleDeleteRecord = (recordId: number | string, shiftName: string) => {
    if (!canAdjust) {
      showToast('KhÃ´ng cÃ³ quyá»n', 'Báº¡n khÃ´ng cÃ³ quyá»n Ä‘iá»u chá»‰nh cháº¥m cÃ´ng.', 'error');
      return;
    }

    if (String(recordId).startsWith('log-')) {
      showToast('ChÆ°a thá»ƒ xÃ³a', 'Dá»¯ liá»‡u log cÅ© cáº§n Ä‘Æ°á»£c chuyá»ƒn Ä‘á»•i trÆ°á»›c khi xÃ³a.', 'error');
      return;
    }

    if (adjustmentReason.trim().length < 10) {
      focusReason('adjustment');
      setAdjustmentReasonError('Vui lÃ²ng nháº­p lÃ½ do há»§y cÃ³ Ã­t nháº¥t 10 kÃ½ tá»±.');
      return;
    }
    setAdjustmentReasonError('');

    showConfirm('XÃ¡c nháº­n xÃ³a', `Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n xÃ³a báº£n ghi [${shiftName}] nÃ y khÃ´ng?`, async () => {
      const actionKey = `delete:${getRecordKey(recordId)}`;
      if (!beginAction(actionKey)) return;

      try {
        const record = await deleteAttendanceRecord(recordId, adjustmentReason.trim());
        showToast('ÄÃ£ xÃ³a', 'Báº£n ghi cháº¥m cÃ´ng Ä‘Ã£ Ä‘Æ°á»£c gá»¡ bá».', 'info');
        onRecordChanged(record, 'delete');
        onClose();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ xÃ³a báº£n ghi.';
        showToast('Lá»—i', message, 'error');
      } finally {
        endAction(actionKey);
      }
    });
  };

  const handleAddNewRecord = async () => {
    if (!canAdjust) {
      showToast('KhÃ´ng cÃ³ quyá»n', 'Báº¡n khÃ´ng cÃ³ quyá»n Ä‘iá»u chá»‰nh cháº¥m cÃ´ng.', 'error');
      return;
    }

    if (!selectedEmployeeId || !newShift) {
      employeeSelectRef.current?.focus();
      showToast('Thiáº¿u dá»¯ liá»‡u', 'Vui lÃ²ng chá»n nhÃ¢n sá»± vÃ  ca lÃ m viá»‡c.', 'error');
      return;
    }

    if (!currentEmployee) {
      showToast('Lá»—i', 'KhÃ´ng tÃ¬m tháº¥y dá»¯ liá»‡u nhÃ¢n sá»±.', 'error');
      return;
    }

    if (!newIn || !newOut) {
      showToast('Thiáº¿u dá»¯ liá»‡u', 'Vui lÃ²ng nháº­p Ä‘á»§ giá» vÃ o vÃ  giá» ra.', 'error');
      return;
    }

    if (createReason.trim().length < 10) {
      setCreateReasonError('Vui lÃ²ng nháº­p lÃ½ do bá»• sung cÃ³ Ã­t nháº¥t 10 kÃ½ tá»±.');
      focusReason('create');
      return;
    }
    setCreateReasonError('');

    const duplicated = hasDuplicatedShift({
      records: existingRecords,
      employeeId: currentEmployee.id,
      workDate: dateStr,
      shiftName: newShift,
    });

    if (duplicated) {
      showToast('ÄÃ£ tá»“n táº¡i', 'NhÃ¢n sá»± nÃ y Ä‘Ã£ cÃ³ báº£n ghi cho ca Ä‘Ã£ chá»n.', 'info');
      return;
    }

    const actionKey = 'create';
    if (!beginAction(actionKey)) return;

    try {
      const record = await upsertAttendanceRecord({
        employee: currentEmployee,
        workDate: dateStr,
        shiftName: newShift,
        checkIn: newIn,
        checkOut: newOut,
        hourlyRate: baseHourlyRate,
        reason: createReason.trim(),
      });

      showToast('ThÃ nh cÃ´ng', 'ÄÃ£ bá»• sung ca lÃ m viá»‡c.', 'success');
      onRecordChanged(record, 'create');
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'KhÃ´ng thá»ƒ bá»• sung ca lÃ m viá»‡c.';
      showToast('Lá»—i', message, 'error');
    } finally {
      endAction(actionKey);
    }
  };

  const displayDate = formatBusinessDate(businessDateFromDateInput(dateStr), { weekday: 'long' });

  const currentEmpName = currentEmployee?.full_name || (currentEmpId ? 'Äang táº£i...' : 'Chá»n má»™t nhÃ¢n sá»± á»Ÿ bá»™ lá»c');
  const selectableEmployees = currentEmpId
    ? employees.filter((employee) => String(employee.id) === String(currentEmpId))
    : employees;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn">
      <div className="bg-[#131924] border border-slate-800 rounded-xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl text-slate-200">
        <div className="flex justify-between items-center p-5 border-b border-slate-800/80">
          <div>
            <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
              CHI TIáº¾T CÃ”NG CA NGÃ€Y
            </h2>
          <p className="text-[11px] text-slate-400 font-medium mt-1">{displayDate}</p>
          {canAdjust && (
            <label className="mt-3 block text-[10px] text-slate-400">
              LÃ½ do Ä‘iá»u chá»‰nh (báº¯t buá»™c)
              <textarea
                value={adjustmentReason}
                ref={adjustmentReasonRef}
                onChange={(event) => {
                  setAdjustmentReason(event.target.value);
                  setAdjustmentReasonError('');
                }}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                placeholder="Nháº­p Ã­t nháº¥t 10 kÃ½ tá»±"
              />
              {adjustmentReasonError && (
                <span className="mt-1 block text-[10px] text-red-400" role="alert">{adjustmentReasonError}</span>
              )}
           </label>
          )}
          {auditEvents.length > 0 && (
            <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/60 p-2 text-[10px] text-slate-400">
              <p className="font-bold text-slate-300">Lá»‹ch sá»­ Ä‘iá»u chá»‰nh</p>
              <div className="mt-1 max-h-24 space-y-1 overflow-y-auto">
                {auditEvents.slice(0, 8).map((event) => (
                  <p key={event.id}>
                    {event.operation} Â· {event.reason} Â· {new Date(event.occurred_at).toLocaleString('vi-VN')}
                  </p>
                ))}
              </div>
            </div>
          )}
           </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-white transition p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6 flex-1 custom-scrollbar">
          <div className="space-y-3">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              CÃ¡c ca Ä‘Ã£ ghi nháº­n
            </h3>

            {myRecords.length === 0 ? (
              <div className="text-center p-6 border border-dashed border-slate-800 rounded-lg text-slate-500 text-[11px] italic">
                ChÆ°a cÃ³ dá»¯ liá»‡u cháº¥m cÃ´ng.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2.5">
                {myRecords.map((record) => {
                  const recordEmployee = employees.find((employee) => String(employee.id) === String(record.employee_id));
                  const workedMinutes = getWorkedMinutesForRecord(record);
                  const shiftUnits = getFinalizedShiftUnitsForRecord(record);
                  const isLegacyLog = String(record.id).startsWith('log-');

                  return (
                  <div
                    key={record.id}
                    className="bg-[#0b0f19] border border-slate-800 p-3 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition hover:border-slate-700"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-slate-300 flex items-center gap-1.5 truncate">
                        <User className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="truncate">{record.employee_name || recordEmployee?.full_name || currentEmpName}</span>
                      </p>

                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-500 font-mono">[{record.shift_name}]</p>

                        {getFinalizedShiftUnitsForRecord(record) > 0 && (
                          <span className="text-[10px] bg-slate-800/60 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                            {formatWorkedDuration(workedMinutes)} Â· {shiftUnits} ca
                          </span>
                        )}

                        <span className="text-[10px] bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          Äiá»u chá»‰nh: {record.adjustment_note ? 'CÃ³' : 'KhÃ´ng'}
                        </span>

                        <span className="text-[10px] bg-slate-800/60 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                          NgÆ°á»i Ä‘iá»u chá»‰nh: {record.adjusted_by_name || 'ChÆ°a cÃ³ audit'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-500 font-medium uppercase mb-1">
                          Giá» VÃ o
                        </label>
                        <input
                          type="time"
                          style={{ colorScheme: 'dark' }}
                          disabled={!canAdjust || isLegacyLog || isRowPending(record.id)}
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
                          className="bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none w-24 disabled:opacity-50"
                        />
                      </div>

                      <div className="flex flex-col">
                        <label className="text-[9px] text-slate-500 font-medium uppercase mb-1">
                          Giá» Ra
                        </label>
                        <input
                          type="time"
                          style={{ colorScheme: 'dark' }}
                          disabled={!canAdjust || isLegacyLog || isRowPending(record.id)}
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
                          className="bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none w-24 disabled:opacity-50"
                        />
                      </div>

                      <div className="flex items-center gap-1 mt-4">
                        <button
                          type="button"
                          onClick={() => handleUpdateRecord(record.id)}
                          disabled={!canAdjust || isLegacyLog || isRowPending(record.id)}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-md border border-transparent hover:border-blue-500/20 transition disabled:opacity-40"
                          title={isLegacyLog ? 'Dá»¯ liá»‡u log cÅ© chá»‰ Ä‘á»c' : 'LÆ°u cáº­p nháº­t'}
                        >
                          <Save className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteRecord(record.id, record.shift_name)}
                          disabled={!canAdjust || isLegacyLog || isRowPending(record.id)}
                          className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-md border border-transparent hover:border-red-500/20 transition disabled:opacity-40"
                          title={isLegacyLog ? 'Dá»¯ liá»‡u log cÅ© chá»‰ Ä‘á»c' : 'XÃ³a ca nÃ y'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isLegacyLog && (
                          <span className="text-[9px] text-amber-400" role="status">Chá»‰ Ä‘á»c: log cÅ©</span>
                        )}
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-[#0b0f19] border border-slate-800 p-4 rounded-lg space-y-3 mt-4">
            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <Plus className="w-3 h-3" /> Bá»• sung ca thá»§ cÃ´ng
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
              <div className="md:col-span-2 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  NhÃ¢n sá»±:
                </label>
                <div className="relative">
                  <select
                    ref={employeeSelectRef}
                    aria-label="NhÃ¢n sá»±"
                    className="w-full bg-[#131924] border border-slate-800 px-2 py-1.5 rounded-md text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none"
                    value={selectedEmployeeId}
                    disabled={!canAdjust || isPending('create')}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                  >
                    <option value="">Chá»n nhÃ¢n sá»±</option>
                    {selectableEmployees.map((employee) => (
                      <option key={employee.id} value={String(employee.id)}>
                        {employee.full_name}
                      </option>
                    ))}
                  </select>
                  <input type="hidden" name="employeeId" value={employeeSelection.employeeId} />
                  {!employeeSelection.employee && (
                    <p className="mt-1 text-[10px] text-amber-400">Chá»n nhÃ¢n sá»± Ä‘á»ƒ giá»¯ Ä‘Ãºng mÃ£ nhÃ¢n sá»± khi táº¡o.</p>
                  )}
                </div>
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  Ca lÃ m:
                </label>
                <select
                  className="w-full bg-[#131924] border border-slate-800 px-2 py-1.5 rounded-md text-[11px] text-slate-300 focus:border-blue-500 focus:outline-none"
                  value={newShift}
                  disabled={!canAdjust || !currentEmployee}
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
                  Giá» VÃ o:
                </label>
                <input
                  type="time"
                  style={{ colorScheme: 'dark' }}
                  value={newIn}
                  disabled={!canAdjust || !currentEmployee}
                  onChange={(event) => setNewIn(event.target.value)}
                  className="w-full bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-1 min-w-0">
                <label className="text-[9px] text-slate-500 font-medium uppercase block mb-1">
                  Giá» Ra:
                </label>
                <input
                  type="time"
                  style={{ colorScheme: 'dark' }}
                  value={newOut}
                  disabled={!canAdjust || !currentEmployee}
                  onChange={(event) => setNewOut(event.target.value)}
                  className="w-full bg-[#131924] border border-slate-800 text-slate-300 rounded-md px-2 py-1.5 text-[11px] font-mono focus:border-blue-500 focus:outline-none disabled:opacity-50"
                />
              </div>
            </div>

            <label className="block text-[10px] text-slate-400">
              LÃ½ do bá»• sung (báº¯t buá»™c, Ã­t nháº¥t 10 kÃ½ tá»±)
              <textarea
                value={createReason}
                ref={createReasonRef}
                onChange={(event) => {
                  setCreateReason(event.target.value);
                  setCreateReasonError('');
                }}
                rows={2}
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-[11px] text-slate-200 outline-none focus:border-blue-500"
                placeholder="Nháº­p lÃ½ do bá»• sung"
              />
              {createReasonError && (
                <span className="mt-1 block text-[10px] text-red-400" role="alert">{createReasonError}</span>
              )}
            </label>

            <div className="pt-2">
              <button
                type="button"
                onClick={handleAddNewRecord}
                disabled={!canAdjust || !currentEmployee || isPending('create')}
                className="w-full bg-[#131924] hover:bg-slate-800 border border-slate-700 hover:border-slate-500 text-slate-300 font-medium py-2 rounded-md transition text-[11px] flex justify-center items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> LÆ°u báº£n ghi bá»• sung
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
