// app/admin/facilities/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useNotification } from '@/component/NotificationContext';
import { fetchCoordinatesFromAddress } from '@/ultis/geocoding';
import { MapPin, Plus, Trash2, Edit2, X, RefreshCcw, Navigation, Loader2 } from 'lucide-react';

type AdminFacility = {
  id: number | string;
  facilityName: string;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
  radius: number | string | null;
};

type FacilityApiResult = {
  success?: boolean;
  message?: string;
  facilities?: AdminFacility[];
};

export default function AdminFacilitiesManagement() {
  const { showToast, showConfirm } = useNotification();
  const [branches, setBranches] = useState<AdminFacility[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showModal, setShowModal] = useState(false);

  // States for CRUD
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('20');

  const loadFacilities = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/facilities', { cache: 'no-store' });
      const result = (await response.json().catch(() => ({}))) as FacilityApiResult;

      if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Không thể tải danh sách cơ sở làm việc.');
      }

      setBranches(result.facilities || []);
    } catch (error) {
      console.error(error);
      showToast('Lỗi tải dữ liệu', 'Không thể tải danh sách cơ sở làm việc.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFacilities();
  }, []);

  const handleGeocode = async () => {
    if (!address.trim()) {
      showToast('Thiếu địa chỉ', 'Sếp cần gõ Địa chỉ thực tế xưởng trước khi dò tọa độ!', 'error');
      return;
    }

    setIsGeocoding(true);
    const result = await fetchCoordinatesFromAddress(address);
    setIsGeocoding(false);

    if (result.success) {
      setLat(result.lat);
      setLng(result.lng);
      showToast('Dò tọa độ xong', 'Hệ thống đã tự động định vị mốc Vĩ độ và Kinh độ cho cơ sở!', 'success');
    } else {
      showToast('Lỗi định vị', result.error || 'Không thể tìm thấy tọa độ từ địa chỉ này.', 'error');
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setName('');
    setAddress('');
    setLat('');
    setLng('');
    setRadius('20');
    setShowModal(true);
  };

  const handleOpenEdit = (b: AdminFacility) => {
    setIsEditing(true);
    setEditingId(b.id);
    setName(b.facilityName);
    setAddress(b.address || '');
    setLat(b.lat?.toString() || '');
    setLng(b.lng?.toString() || '');
    setRadius(b.radius?.toString() || '20');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !address.trim() || !lat || !lng) {
      showToast('Thiếu thông tin', 'Sếp vui lòng điền đủ Tên cơ sở, Địa chỉ và bấm Dò tọa độ vệ tinh!', 'error');
      return;
    }

    const payload = {
      id: editingId,
      facilityName: name.trim(),
      address: address.trim(),
      lat: Number(lat),
      lng: Number(lng),
      radius: Number(radius),
    };

    try {
      const response = await fetch('/api/admin/facilities', {
        method: isEditing && editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as FacilityApiResult;

      if (!response.ok || result.success === false) {
        throw new Error(result.message || 'Không thể lưu cơ sở làm việc.');
      }

      showToast('Thành công', isEditing ? 'Đã cập nhật cơ sở làm việc.' : 'Đã thêm cơ sở làm việc mới.', 'success');
      setShowModal(false);
      loadFacilities();
    } catch (err) {
      showToast('Lỗi lưu dữ liệu', err instanceof Error ? err.message : 'Không thể lưu cơ sở làm việc.', 'error');
    }
  };

  const handleDelete = (id: number | string) => {
    showConfirm('Xác nhận xóa cơ sở', 'Bạn có chắc muốn xóa cơ sở này không? Nhân sự đang gán vào cơ sở này có thể không chấm công được.', async () => {
      try {
        const response = await fetch('/api/admin/facilities', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id }),
        });
        const result = (await response.json().catch(() => ({}))) as FacilityApiResult;

        if (!response.ok || result.success === false) {
          throw new Error(result.message || 'Không thể xóa cơ sở làm việc.');
        }

        showToast('Đã xóa', 'Đã xóa cơ sở làm việc.', 'success');
        loadFacilities();
      } catch (err) {
        showToast('Lỗi hệ thống', err instanceof Error ? err.message : 'Không thể xóa cơ sở làm việc.', 'error');
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
            <tr>
              <th className="p-4 w-[25%]">Tên Cơ Sở / Chi Nhánh</th>
              <th className="p-4 w-[35%]">Địa Chỉ Thực Tế Tại Xưởng</th>
              <th className="p-4 w-[12%]">Vĩ Độ</th>
              <th className="p-4 w-[12%]">Kinh Độ</th>
              <th className="p-4 w-[10%]">Vùng An Toàn</th>
              <th className="p-4 w-[6%] text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
            {branches.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center p-8 text-slate-500 italic">
                  Chưa có dữ liệu cơ sở xưởng trên hệ thống.
                </td>
              </tr>
            ) : (
              branches.map(b => (
                <tr key={b.id} className="hover:bg-slate-950/20 transition">
                  <td className="p-4 font-bold text-slate-200">
                    🏛️ {b.facilityName}
                    <br/>
                    <span className="text-[9px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 mt-1 block w-fit">ID: {b.id}</span>
                  </td>
                  <td className="p-4 text-slate-400 max-w-xs truncate" title={b.address || ''}>{b.address}</td>
                  <td className="p-4 font-mono font-bold text-blue-400">{b.lat}</td>
                  <td className="p-4 font-mono font-bold text-blue-400">{b.lng}</td>
                  <td className="p-4 font-bold text-amber-400 font-mono">{b.radius} mét</td>
                  <td className="p-4 text-center space-x-1">
                    <button onClick={() => handleOpenEdit(b)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400 hover:bg-slate-800 transition" title="Chỉnh sửa"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => handleDelete(b.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500 hover:bg-red-950/20 transition" title="Xóa cơ sở"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))
            )}
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
              <div>
                <label className="text-slate-400 font-medium">Tên gợi nhớ cơ sở làm việc:</label>
                <input type="text" placeholder="Ví dụ: Xưởng CNC Số 1 - Hà Nội" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-slate-200" value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div>
                <label className="text-slate-400 font-medium">Địa chỉ thực tế xưởng:</label>
                <div className="flex gap-2 mt-1.5">
                  <input type="text" placeholder="Gõ đủ số nhà, tên đường, thành phố..." className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 focus:outline-none text-slate-200" value={address} onChange={e => setAddress(e.target.value)} />
                  <button
                    type="button"
                    onClick={handleGeocode}
                    disabled={isGeocoding}
                    className="bg-slate-950 border border-slate-850 text-cyan-400 font-bold px-3 py-2 rounded-xl flex items-center gap-1 hover:border-cyan-500/40 transition shrink-0 disabled:opacity-50"
                  >
                    {isGeocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Navigation className="w-3.5 h-3.5"/>}
                    {isGeocoding ? 'Đang dò...' : 'Dò Tọa Độ'}
                  </button>
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
