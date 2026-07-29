'use client';

import { useEffect, useState } from 'react';
import { useNotification } from '@/component/NotificationContext';
import { Briefcase, RefreshCcw, ShieldCheck } from 'lucide-react';
import type { Facility } from '@/lib/types/facility';
import type { Employee } from '@/lib/types/employee';
import { getShiftWageByTitle, updateStaffProfile } from '@/services/staffProfileService';

interface StaffProfileContentProps {
  workerData?: Employee | null;
  assignedBranchData?: Facility | null;
}

export function StaffProfileContent({
  workerData,
  assignedBranchData,
}: StaffProfileContentProps) {
  const { showToast } = useNotification();

  const [worker, setWorker] = useState<Employee | null>(workerData || null);
  const [assignedBranch] = useState<Facility | null>(assignedBranchData || null);
  const [loading, setLoading] = useState(!workerData);

  const [profilePhone, setProfilePhone] = useState('');
  const [profileBankName, setProfileBankName] = useState('');
  const [profileBankAcc, setProfileBankAcc] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setWorker(workerData || null);
    setProfilePhone(workerData?.phone || '');
    setProfileBankName(workerData?.bank_name || '');
    setProfileBankAcc(workerData?.bank_account_number || '');
    setLoading(false);
  }, [workerData]);

  const handleSaveProfile = async () => {
    if (!worker || saving) return;

    const changes = {
      ...(profilePhone !== (worker.phone || '') ? { phone: profilePhone } : {}),
      ...(profileBankName !== (worker.bank_name || '') ? { bankName: profileBankName } : {}),
      ...(profileBankAcc !== (worker.bank_account_number || '') ? { bankAccountNumber: profileBankAcc } : {}),
    };
    if (Object.keys(changes).length === 0) return;

    setSaving(true);
    setSaveError(null);
    try {
      const saved = await updateStaffProfile(changes);
      setWorker((current) => current ? { ...current, ...saved } : current);
      setProfilePhone(saved.phone || '');
      setProfileBankName(saved.bank_name || '');
      setProfileBankAcc(saved.bank_account_number || '');
      showToast('Đã cập nhật', 'Đã cập nhật thông tin cá nhân.', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu hồ sơ.';
      setSaveError(message);
      showToast('Không thể cập nhật', 'Không thể cập nhật thông tin. Vui lòng thử lại.', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center p-6 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mx-auto mb-2" /> Đang tải hồ sơ...
      </div>
    );
  }

  if (!worker) {
    return <div className="text-center p-6 text-slate-500 text-xs">Không tìm thấy nhân sự.</div>;
  }

  const currentWage = getShiftWageByTitle(worker.title);
  const assignedBranchName = assignedBranch?.name || assignedBranch?.facility_name || worker.branch_code || worker.branch || 'Chưa phân phối';

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-5 text-xs max-w-2xl mx-auto animate-fadeIn w-full text-slate-100 font-sans">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
        <Briefcase className="w-4 h-4 text-blue-400" />
        <h2 className="font-bold text-slate-200 uppercase tracking-wider text-[12px]">
          Hồ Sơ Thành Viên Số Hóa
        </h2>
      </div>

      <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-2 gap-4 text-[11px]">
        <div>
          <span className="text-slate-500 font-bold uppercase block text-[9px]">
            🏛️ Vị trí cơ sở làm việc:
          </span>
          <p className="font-black text-slate-200 mt-1">{assignedBranchName}</p>
        </div>

        <div>
          <span className="text-slate-500 font-bold uppercase block text-[9px]">
            🧧 Định mức lương ca máy mặc định:
          </span>
          <p className="font-black text-emerald-400 mt-1 font-mono">
            {currentWage.toLocaleString()} đ / ca
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-slate-400 font-bold">Số điện thoại liên hệ:</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 p-3 mt-1 rounded-xl focus:outline-none text-slate-200"
            value={profilePhone}
            onChange={(event) => setProfilePhone(event.target.value)}
          />
        </div>

        <div>
          <label className="text-slate-400 font-bold">Tên Ngân hàng:</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 p-3 mt-1 rounded-xl focus:outline-none text-slate-200"
            value={profileBankName}
            onChange={(event) => setProfileBankName(event.target.value)}
          />
        </div>

        <div className="sm:col-span-2">
          <label className="text-slate-400 font-bold">Số tài khoản nhận tiền lương quỹ:</label>
          <input
            type="text"
            className="w-full bg-slate-950 border border-slate-800 p-3 mt-1 rounded-xl focus:outline-none text-amber-400 font-bold font-mono tracking-wider"
            value={profileBankAcc}
            onChange={(event) => setProfileBankAcc(event.target.value)}
          />
        </div>
      </div>

      {saveError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-red-200">{saveError}</p>}
      {(profilePhone !== (worker.phone || '') || profileBankName !== (worker.bank_name || '') || profileBankAcc !== (worker.bank_account_number || '')) && <button
        type="button"
        disabled={saving}
        onClick={handleSaveProfile}
        className="w-full bg-blue-600 text-white font-black p-3 rounded-xl transition shadow-lg flex items-center justify-center gap-1 cursor-pointer"
      >
        <ShieldCheck className="w-4 h-4" /> {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
      </button>}
    </div>
  );
}
