// app/admin/facilities/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { MapPin, Plus, Edit2, Trash2, X, Save, RefreshCcw } from 'lucide-react';

export default function AdminFacilitiesManagement() {
  const [facilities, setFacilities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // States quản lý Popup Modals
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [targetId, setTargetId] = useState<number | null>(null);

  // States dữ liệu form nhập liệu cơ sở
  const [facilityName, setFacilityName] = useState('');
  const [lat, setLat] = useState('21.0285');
  const [lng, setLng] = useState('105.8542');
  const [radius, setRadius] = useState('15');

  const loadFacilities = async () => {
    setLoading(true);
    const { data } = await supabase.from('facilities').select('*').order('id', { ascending: true });
    setFacilities(data || []);
    setLoading(false);
  };

  useEffect(() => { loadFacilities(); }, []);

  const handleOpenAdd = () => {
    setIsEditing(false); setTargetId(null); setFacilityName(''); setLat('21.0285'); setLng('105.8542'); setRadius('15');
    setShowModal(true);
  };

  const handleOpenEdit = (f: any) => {
    setIsEditing(true); setTargetId(f.id); setFacilityName(f.facility_name); setLat(f.lat.toString()); setLng(f.lng.toString()); setRadius(f.radius.toString());
    setShowModal(true);
  };

  const handleDelete = async (id: number, name: string) => {
    if (window.confirm(`⚠️ Sếp có chắc chắn muốn xóa vĩnh viễn cơ sở [${name}] khỏi chuỗi hệ thống không?`)) {
      setFacilities(prev => prev.filter(f => f.id !== id));
      await supabase.from('facilities').delete().eq('id', id);
      alert('Đã xóa chi nhánh cơ sở thành công!');
    }
  };

  const handleSave = async () => {
    if (!facilityName.trim() || !lat || !lng || !radius) { alert('Vui lòng điền đủ thông tin tọa độ!'); return; }
    
    const payload = { facility_name: facilityName.trim(), lat: Number(lat), lng: Number(lng), radius: Number(radius) };

    if (isEditing && targetId) {
      await supabase.from('facilities').update(payload).eq('id', targetId);
    } else {
      await supabase.from('facilities').insert([payload]);
    }

    setShowModal(false); loadFacilities();
    alert('✨ Hệ thống đã cập nhật định vị cơ sở thành công!');
  };

  if (loading) return <div className="p-6 text-xs text-center font-mono text-slate-500"><RefreshCcw className="w-4 h-4 animate-spin inline mr-2" /> Đang đồng bộ định vị vệ tinh các chi nhánh...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-amber-500" />
          <div>
            <h1 className="text-base font-bold">Danh Sách Cơ Sở & Quản Lý Vị Trí Làm Việc</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Quản lý rào chắn GPS Geofencing cho từng chi nhánh phục vụ chấm công thợ tại chỗ</p>
          </div>
        </div>
        <button onClick={handleOpenAdd} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition">
          <Plus className="w-4 h-4" /> Thêm Cơ Sở Mới
        </button>
      </div>

      {/* BẢNG CHUỖI CHI NHÁNH CƠ SỞ HIỂN THỊ RÕ RÀNG */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
            <tr>
              <th className="p-4">Tên cơ sở / Chi nhánh</th>
              <th className="p-4">Vĩ độ (Latitude)</th>
              <th className="p-4">Kinh độ (Longitude)</th>
              <th className="p-4">Vùng an toàn (Bán kính)</th>
              <th className="p-4 text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {facilities.length === 0 ? (
              <tr><td colSpan={5} className="p-8 text-center text-slate-500 font-mono">Chưa ghi nhận cơ sở sản xuất nào.</td></tr>
            ) : facilities.map(f => (
              <tr key={f.id} className="hover:bg-slate-950/40 transition text-[11px]">
                <td className="p-4 font-bold text-slate-200">🏢 {f.facility_name}</td>
                <td className="p-4 font-mono text-blue-400 font-semibold">{f.lat}</td>
                <td className="p-4 font-mono text-blue-400 font-semibold">{f.lng}</td>
                <td className="p-4 font-mono font-bold text-amber-400">{f.radius} mét</td>
                <td className="p-4 text-center space-x-2">
                  <button onClick={() => handleOpenEdit(f)} className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-slate-800 rounded-lg text-blue-400 transition" title="Chỉnh sửa tọa độ chi nhánh"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(f.id, f.facility_name)} className="p-1.5 bg-slate-950 border border-slate-800 hover:bg-red-950/30 rounded-lg text-red-400 transition" title="Xóa bỏ cơ sở"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* POPUP (MODAL) THÊM MỚI / CHỈNH SỬA TỌA ĐỘ CƠ SỞ CHUYÊN NGHIỆP */}
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-xs shadow-2xl relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-slate-200 uppercase">{isEditing ? 'Cập nhật định vị chi nhánh' : 'Khai báo chi nhánh cơ sở mới'}</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-slate-400 font-bold">Tên cơ sở làm việc:</label>
                <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-slate-200 focus:outline-none font-semibold" placeholder="Ví dụ: Cơ sở 3 - Cầu Giấy" value={facilityName} onChange={(e) => setFacilityName(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-400 font-bold">Vĩ độ (Latitude):</label>
                  <input type="number" step="0.000001" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-blue-400 focus:outline-none" value={lat} onChange={(e) => setLat(e.target.value)} />
                </div>
                <div>
                  <label className="text-slate-400 font-bold">Kinh độ (Longitude):</label>
                  <input type="number" step="0.000001" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-blue-400 focus:outline-none" value={lng} onChange={(e) => setLng(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="text-slate-400 font-bold">Bán kính quét an toàn cho phép chấm công (Mét):</label>
                <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-amber-400 font-black text-sm focus:outline-none" value={radius} onChange={(e) => setRadius(e.target.value)} />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button onClick={() => setShowModal(false)} className="flex-1 bg-slate-950 border border-slate-800 hover:bg-slate-800 p-3 rounded-xl font-bold text-slate-400 text-center transition">Hủy bỏ</button>
              <button onClick={handleSave} className="flex-1 bg-blue-600 hover:bg-blue-700 p-3 rounded-xl font-bold text-white uppercase tracking-wider flex items-center justify-center gap-1.5 transition shadow-lg"><Save className="w-4 h-4" /> {isEditing ? 'Lưu thay đổi' : 'Kích hoạt cơ sở'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}