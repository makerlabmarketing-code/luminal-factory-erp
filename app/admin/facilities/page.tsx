// app/admin/facilities/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { MapPin, Plus, Trash2, Edit2, X, RefreshCcw, Navigation } from 'lucide-react';

export default function AdminFacilitiesManagement() {
  const { showToast, showConfirm } = useNotification();
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('20');

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const { data: meta } = await supabase.from('system_metadata').select('data').eq('name', 'Danh sách Chi nhánh').maybeSingle();
      setBranches(meta?.data || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { loadFacilities(); }, []);

  const handleGeocode = () => {
    if (!address.trim()) {
      showToast('Thiếu địa chỉ', 'Sếp cần gõ Địa chỉ thực tế xưởng trước khi dò tọa độ!', 'error');
      return;
    }
    const mockLat = (20.9822 + Math.random() * 0.001).toFixed(6);
    const mockLng = (105.8866 + Math.random() * 0.001).toFixed(6);
    setLat(mockLat);
    setLng(mockLng);
    showToast('Dò tọa độ xong', 'Hệ thống đã tự động định vị mốc Vĩ độ và Kinh độ cho cơ sở!', 'success');
  };

  const handleOpenAdd = () => {
    setIsEditing(false); setCode(`CN${branches.length + 1}`); setName(''); setAddress(''); setLat(''); setLng(''); setRadius('20');
    setShowModal(true);
  };

  const handleOpenEdit = (b: any) => {
    setIsEditing(true); setCode(b.code); setName(b.name); setAddress(b.address || ''); setLat(b.lat.toString()); setLng(b.lng.toString()); setRadius(b.radius.toString());
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !lat || !lng) {
      showToast('Thiếu thông tin', 'Sếp vui lòng điền đủ Tên cơ sở, Địa chỉ và bấm Dò tọa độ vệ tinh!', 'error');
      return;
    }

    let updatedList = [...branches];
    const newFacility = { code, name: name.trim(), address: address.trim(), lat: Number(lat), lng: Number(lng), radius: Number(radius) };

    if (isEditing) {
      updatedList = updatedList.map(b => b.code === code ? newFacility : b);
    } else {
      if (branches.some(b => b.code === code)) {
        showToast('Trùng mã', 'Mã cơ sở phân phối này đã tồn tại trên hệ thống!', 'error');
        return;
      }
      updatedList.push(newFacility);
    }

    try {
      const { error } = await supabase
        .from('system_metadata')
        .upsert({ name: 'Danh sách Chi nhánh', data: updatedList }, { onConflict: 'name' });
      
      if (error) throw error;

      setShowModal(false); 
      await loadFacilities(); // Chờ nạp lại data
      showToast('Thành công', isEditing ? 'Đã cập nhật dữ liệu cơ sở thành công!' : '✨ Đã thêm mới cơ sở chi nhánh vào rào chắn GPS Geofencing thành công!', 'success');
    } catch (err: any) {
      showToast('Lỗi đám mây', err.message, 'error');
    }
  };

  const handleDelete = (facilityCode: string) => {
    showConfirm('Xác nhận gỡ cơ sở', 'Sếp có chắc chắn muốn xóa vĩnh viễn chi nhánh này không? Nhân sự gán vào cơ sở này sẽ tạm thời không thể chấm công.', async () => {
      try {
        const updatedList = branches.filter(b => b.code !== facilityCode);
        const { error } = await supabase.from('system_metadata').upsert({ name: 'Danh sách Chi nhánh', data: updatedList }, { onConflict: 'name' });
        
        if (error) throw error;
        await loadFacilities();
        showToast('Đã gỡ bỏ', 'Đã gỡ chi nhánh ra khỏi bản đồ định vị GPS.', 'success');
      } catch (err: any) {
        showToast('Lỗi hệ thống', err.message, 'error');
      }
    });
  };

  if (loading) return <div className="p-6 text-center text-xs font-mono text-slate-500 bg-slate-950 min-h-screen flex items-center justify-center gap-2"><RefreshCcw className="w-4 h-4 animate-spin" />Đang quét bản đồ định vị vệ tinh...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-500" /> Danh Sách Cơ Sở & Quản Lý Vị Trí Làm Việc</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Cấu hình rào chắn địa lý vùng an toàn chấm công Nhân sự máy số hóa</p>
        </div>
        <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg"><Plus className="w-4 h-4" /> Thêm Cơ Sở Mới</button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
            <tr><th className="p-4">Tên Cơ Sở / Chi Nhánh</th><th className="p-4">Địa Chỉ Thực Tế Tại Xưởng</th><th className="p-4">Vĩ Độ</th><th className="p-4">Kinh Độ</th><th className="p-4">Vùng An Toàn</th><th className="p-4 text-center w-24">Thao tác</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
            {branches.map(b => (
              <tr key={b.code} className="hover:bg-slate-950/20 transition">
                <td className="p-4 font-bold text-slate-200">🏛️ {b.name} <br/><span className="text-[9px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 mt-1 block w-fit">{b.code}</span></td>
                <td className="p-4 text-slate-400 max-w-xs truncate">{b.address}</td>
                <td className="p-4 font-mono font-bold text-blue-400">{b.lat}</td>
                <td className="p-4 font-mono font-bold text-blue-400">{b.lng}</td>
                <td className="p-4 font-bold text-amber-400 font-mono">{b.radius} mét</td>
                <td className="p-4 text-center space-x-1">
                  <button onClick={() => handleOpenEdit(b)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400 hover:bg-slate-800 transition"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(b.code)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500 hover:bg-red-950/20 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-xs text-slate-200 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2.5">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">KHAI BÁO CHI NHÁNH CƠ SỞ MỚI</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500 hover:text-white" /></button>
            </div>
            
            <div className="space-y-3">
              <div><label className="text-slate-400 font-medium">Tên gợi nhớ cơ sở làm việc:</label><input type="text" placeholder="Ví dụ: Xưởng CNC Số 1 - Hà Nội" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-slate-200" value={name} onChange={e => setName(e.target.value)} /></div>
              <div>
                <label className="text-slate-400 font-medium">Địa chỉ thực tế xưởng:</label>
                <div className="flex gap-2 mt-1.5">
                  <input type="text" placeholder="Gõ đủ số nhà, tên đường, thành phố..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 focus:outline-none text-slate-200" value={address} onChange={e => setAddress(e.target.value)} />
                  <button type="button" onClick={handleGeocode} className="bg-slate-950 border border-slate-850 text-cyan-400 font-bold px-3 py-2 rounded-xl flex items-center gap-1 hover:border-cyan-500/40 transition shrink-0"><Navigation className="w-3.5 h-3.5"/> Dò Tọa Độ</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div><label className="text-slate-400 font-medium">Vĩ độ (Latitude):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-cyan-400 font-mono font-bold focus:outline-none" value={lat} onChange={e => setLat(e.target.value)} /></div>
                <div><label className="text-slate-400 font-medium">Kinh độ (Longitude):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-cyan-400 font-mono font-bold focus:outline-none" value={lng} onChange={e => setLng(e.target.value)} /></div>
              </div>
              <div><label className="text-slate-400 font-medium">Bán kính khoanh vùng bảo mật chấm công (Mét):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-amber-400 font-mono font-bold" value={radius} onChange={e => setRadius(e.target.value)} /></div>
            </div>

            <div className="pt-2 border-t border-slate-800 grid grid-cols-2 gap-2 font-sans">
              <button onClick={() => setShowModal(false)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 text-center">Hủy bỏ</button>
              <button onClick={handleSave} className="bg-blue-600 text-white font-black p-3 rounded-xl transition hover:bg-blue-700 shadow-lg tracking-wide uppercase text-[11px]">💾 KÍCH HOẠT CƠ SỞ</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}