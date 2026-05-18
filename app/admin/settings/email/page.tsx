// app/admin/settings/email/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Mail, ShieldCheck, Save, RefreshCcw } from 'lucide-react';

export default function AdminEmailSettingsPage() {
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Lưu trữ các trạng thái cấu hình SMTP động
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');

  // 1. Hàm đọc cấu hình SMTP từ bảng system_settings trên Supabase
  const fetchEmailSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*');

      if (error) throw error;

      // Ánh xạ dữ liệu dòng cột về các ô input tương ứng
      data?.forEach(setting => {
        if (setting.key === 'smtp_host') setSmtpHost(setting.value);
        if (setting.key === 'smtp_port') setSmtpPort(setting.value);
        if (setting.key === 'smtp_user') setSmtpUser(setting.value);
        if (setting.key === 'smtp_pass') setSmtpPass(setting.value);
      });

    } catch (e) {
      alert('Lỗi tải cấu hình SMTP!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailSettings();
  }, []);

  // 2. Hàm Lưu cập nhật thông tin SMTP xuống Database Cloud
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      const updates = [
        { key: 'smtp_host', value: smtpHost.trim(), description: 'Máy chủ SMTP' },
        { key: 'smtp_port', value: smtpPort.trim(), description: 'Cổng Port SMTP' },
        { key: 'smtp_user', value: smtpUser.trim(), description: 'Email tài khoản gửi' },
        { key: 'smtp_pass', value: smtpPass.trim(), description: 'Mật khẩu ứng dụng Gmail (App Password)' },
      ];

      // Thực hiện lệnh lưu đè hoặc ghi đè đồng loạt (Upsert)
      const { error } = await supabase
        .from('system_settings')
        .upsert(updates, { onConflict: 'key' });

      if (error) throw error;
      alert('Hệ thống cơ động đã cập nhật và đồng bộ cấu hình cổng SMTP gửi Mail thành công!');
    } catch (e) {
      alert('Lỗi lưu trữ cấu hình mạng!');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center font-mono text-xs">
        <RefreshCcw className="w-4 h-4 animate-spin text-blue-500 mr-2" /> Đang tải cấu hình cổng SMTP bảo mật...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans flex justify-center items-start">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-6 mt-4 space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-2.5 border-b border-slate-800 pb-4">
          <div className="p-2 bg-blue-600/10 text-blue-400 rounded-xl border border-blue-500/20">
            <Mail className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide">Cấu Hình Máy Chủ Gửi Email (SMTP Layout Server)</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Quản lý tài khoản lõi phục vụ bắn phiếu lương và lệnh gọi góp vốn tự động</p>
          </div>
        </div>

        {/* Nội dung form cấu hình */}
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Máy chủ SMTP Host:</label>
              <input type="text" className="mt-2 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none" value={smtpHost} onChange={(e) => setSmtpHost(e.target.value)} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cổng Port:</label>
              <input type="text" className="mt-2 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Email tài khoản đại diện gửi (Username):</label>
            <input type="email" className="mt-2 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none" value={smtpUser} onChange={(e) => setSmtpUser(e.target.value)} />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mật khẩu ứng dụng Email (App Password):</label>
            <input type="password" placeholder="•••• •••• •••• ••••" className="mt-2 block w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs font-mono text-slate-200 focus:outline-none text-blue-400 tracking-widest" value={smtpPass} onChange={(e) => setSmtpPass(e.target.value)} />
            <span className="text-[10px] text-slate-500 mt-1.5 block leading-normal">
              *Lưu ý: Đối với Gmail, bạn bắt buộc phải bật Xác minh 2 bước và tạo "Mật khẩu ứng dụng" (16 ký tự viết liền) thay vì điền mật khẩu đăng nhập Gmail gốc vào đây để đảm bảo an toàn bảo mật.
            </span>
          </div>
        </div>

        {/* Nút bấm Lưu */}
        <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
          <div className="flex items-center gap-1.5 text-slate-500 font-mono text-[10px]">
            <ShieldCheck className="w-4 h-4 text-emerald-500/70" /> Mã hóa SSL/TLS Đầu Cuối Kích Hoạt
          </div>
          <button onClick={handleSaveSettings} disabled={isSaving} className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl transition shadow-lg">
            {isSaving ? <RefreshCcw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {isSaving ? 'Đang cập nhật Cloud...' : 'Lưu Cấu Hình SMTP'}
          </button>
        </div>

      </div>
    </div>
  );
}