// app/staff/profile/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Briefcase, RefreshCcw, ShieldCheck, MapPin, Award, Banknote } from 'lucide-react';

export default function StaffProfilePage() {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [worker, setWorker] = useState<any>(null);
  const [assignedBranch, setAssignedBranch] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [profilePhone, setProfilePhone] = useState('');
  const [profileBankName, setProfileBankName] = useState('');
  const [profileBankAcc, setProfileBankAcc] = useState('');

  const GET_SHIFT_WAGE_BY_TITLE = (title: string) => {
    const formattedTitle = (title || '').trim().toUpperCase();
    if (formattedTitle === 'A1') return 150000; 
    return 100000; 
  };

  useEffect(() => {
    const loadProfile = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const { data: emp } = await supabase.from('employees').select('*').eq('qr_token', token).maybeSingle();
        if (emp) {
          setWorker(emp);
          setProfilePhone(emp.phone || '');
          setProfileBankName(emp.bank_name || '');
          setProfileBankAcc(emp.bank_account_number || '');

          const { data: metaBranch } = await supabase.from('system_metadata').select('data').eq('name', 'Danh sách Chi nhánh').maybeSingle();
          const branchData = metaBranch?.data || [];
          const myBranch = branchData.find((b: any) => b.code === emp.branch_code || b.name === emp.branch);
          setAssignedBranch(myBranch || branchData[0] || null);
        }
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    };
    loadProfile();
  }, [token]);

  const handleSaveProfile = async () => {
    if (!worker) return;
    try {
      const { error } = await supabase.from('employees').update({
        phone: profilePhone.trim(),
        bank_name: profileBankName.trim(),
        bank_account_number: profileBankAcc.trim()
      }).eq('id', worker.id);

      if (error) throw error;
      showToast('Thành công', 'Hồ sơ thông tin tài khoản thụ hưởng lương đã được cập nhật cố định!', 'success');
    } catch (e: any) {
      showToast('Thất bại', e.message, 'error');
    }
  };

  if (loading) return <div className="text-center p-12 text-xs text-slate-500 font-mono bg-slate-950 min-h-screen flex flex-col items-center justify-center gap-2"><RefreshCcw className="w-4 h-4 animate-spin text-blue-500"/> Đang kiểm tra hồ sơ số hóa...</div>;
  if (!worker) return <div className="text-center p-12 text-xs text-slate-500 bg-slate-950 min-h-screen">Không tìm thấy thông tin nhân sự hợp lệ.</div>;

  const currentWage = GET_SHIFT_WAGE_BY_TITLE(worker.title);

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-5 text-xs bg-slate-950 min-h-screen pt-8">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
          <Briefcase className="w-4 h-4 text-blue-400" />
          <h2 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">Hồ Sơ Thành Viên Số Hóa</h2>
        </div>

        <div className="bg-slate-950 border border-slate-850 p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-4 text-[11px]">
          <div className="space-y-1">
            <span className="text-slate-500 font-bold uppercase block text-[9px] tracking-wide flex items-center gap-1"><MapPin className="w-3 h-3 text-purple-400" /> Vị trí làm việc:</span>
            <div className="w-full bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-xl text-slate-400 font-black truncate">🏛️ {worker.branch || 'Chưa gán'}</div>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 font-bold uppercase block text-[9px] tracking-wide flex items-center gap-1"><Award className="w-3 h-3 text-blue-400" /> Chức vụ (Title):</span>
            <div className="w-full bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-xl text-blue-400 font-black tracking-wider truncate">⚙️ {worker.title || 'KTV'}</div>
          </div>
          <div className="space-y-1">
            <span className="text-slate-500 font-bold uppercase block text-[9px] tracking-wide flex items-center gap-1"><Banknote className="w-3 h-3 text-emerald-400" /> Đơn giá ca công:</span>
            <div className="w-full bg-slate-900/60 border border-slate-800/60 p-2.5 rounded-xl text-emerald-400 font-bold font-mono truncate">{currentWage.toLocaleString('vi-VN')} đ</div>
          </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-slate-400 font-bold block pl-0.5">Số điện thoại liên lạc liên hệ:</label>
            <input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:outline-none text-slate-200 font-medium font-mono" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-slate-400 font-bold block pl-0.5">Tên Ngân hàng thụ hưởng lương:</label>
            <input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:outline-none text-slate-200 font-medium" value={profileBankName} onChange={e => setProfileBankName(e.target.value)} />
          </div>
          <div className="sm:col-span-2 space-y-1.5">
            <label className="text-slate-400 font-bold block pl-0.5">Số tài khoản nhận tiền lương quỹ:</label>
            <input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:outline-none text-amber-400 font-bold font-mono text-sm tracking-wider" value={profileBankAcc} onChange={e => setProfileBankAcc(e.target.value)} />
          </div>
        </div>

        <button onClick={handleSaveProfile} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black p-3.5 rounded-xl transition shadow-lg uppercase text-[10px] tracking-widest flex items-center justify-center gap-1 cursor-pointer"><ShieldCheck className="w-4 h-4" /> Cập nhật tài khoản lương</button>
      </div>
    </div>
  );
}