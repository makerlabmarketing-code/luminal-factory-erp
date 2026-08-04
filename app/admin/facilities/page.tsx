// app/admin/facilities/page.tsx
'use client';
import { useEffect, useState } from 'react';
import { useNotification } from '@/component/NotificationContext';
import { fetchCoordinatesFromAddress, type GeocodeMatch } from '@/ultis/geocoding';
import { MapPin, Plus, Trash2, Edit2, X, RefreshCcw, Navigation, Loader2 } from 'lucide-react';
import { AdminListRequestError, useAdminListData } from '@/hooks/useAdminListData';
import { AdminPage } from '@/component/AdminUI';
import { reconcileCreatedFacility, reconcileDeletedFacility, reconcileUpdatedFacility } from '@/lib/facilityReconciliation';

type AdminFacility = {
  id: number | string;
  facilityName: string;
  address: string | null;
  lat: number | string | null;
  lng: number | string | null;
  radius: number | string | null;
  code: string | null;
  isActive: boolean;
};

type FacilityApiResult = {
  success?: boolean;
  message?: string;
  facilities?: AdminFacility[];
  facility?: AdminFacility;
  deletedId?: number | string;
  capabilities?: { canPersistStatusAndCode: boolean; canManageFacilities: boolean };
  code?: string;
};

export default function AdminFacilitiesManagement() {
  const { showToast, showConfirm } = useNotification();
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [branches, setBranches] = useState<AdminFacility[]>([]);
  const [geocodeDisplayName, setGeocodeDisplayName] = useState<string | null>(null);
  const [geocodeAlternatives, setGeocodeAlternatives] = useState<GeocodeMatch[]>([]);

  // States for CRUD
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radius, setRadius] = useState('20');

  const facilityRequest = async (signal: AbortSignal) => {
      const response = await fetch('/api/admin/facilities', { cache: 'no-store', signal });
      const result = (await response.json().catch(() => ({}))) as FacilityApiResult;
      if (!response.ok || result.success === false) {
        throw new AdminListRequestError(response.status === 403 ? 'forbidden' : result.code === 'facility_schema_unavailable' ? 'facility_schema_unavailable' : 'facility_list_load_failed');
      }
      return result;
  };
  const { data: facilityData, error: loadError, isLoading: loading, isRefreshing, refresh: loadFacilities } = useAdminListData({ request: facilityRequest });
  const canManageFacilities = facilityData?.capabilities?.canManageFacilities !== false;
  const hasFacilityStatus = facilityData?.capabilities?.canPersistStatusAndCode === true;

  useEffect(() => {
    if (facilityData?.facilities) setBranches(facilityData.facilities);
  }, [facilityData]);

  useEffect(() => {
    if (!showModal) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showModal]);

  const handleGeocode = async () => {
    if (!address.trim()) {
      showToast('Thiếu địa chỉ', 'Sếp cần gõ Địa chỉ thực tế xưởng trước khi dò tọa độ!', 'error');
      return;
    }

    setIsGeocoding(true);
    const result = await fetchCoordinatesFromAddress(address).finally(() => setIsGeocoding(false));

    if (result.success) {
      setLat(result.lat);
      setLng(result.lng);
      setGeocodeDisplayName(result.displayName || null);
      setGeocodeAlternatives(result.alternatives || []);
      showToast(result.errorCode === 'ambiguous' ? 'Cần xác nhận địa chỉ' : 'Dò tọa độ xong', result.error || 'Đã điền tọa độ. Vui lòng xác nhận địa chỉ bản đồ trước khi lưu.', result.errorCode === 'ambiguous' ? 'info' : 'success');
    } else {
      showToast('Lỗi định vị', result.error || 'Không thể tìm thấy tọa độ từ địa chỉ này.', 'error');
    }
  };

  const handleOpenAdd = () => {
    setIsEditing(false);
    setEditingId(null);
    setSaveError(null);
    setName('');
    setAddress('');
    setLat('');
    setLng('');
    setRadius('20');
    setGeocodeDisplayName(null);
    setGeocodeAlternatives([]);
    setShowModal(true);
  };

  const handleOpenEdit = (b: AdminFacility) => {
    setIsEditing(true);
    setEditingId(b.id);
    setSaveError(null);
    setName(b.facilityName);
    setAddress(b.address || '');
    setLat(b.lat?.toString() || '');
    setLng(b.lng?.toString() || '');
    setRadius(b.radius?.toString() || '20');
    setGeocodeDisplayName(null);
    setGeocodeAlternatives([]);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (isSaving) return;

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

    setIsSaving(true);
    setSaveError(null);

    try {
      const response = await fetch('/api/admin/facilities', {
        method: isEditing && editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = (await response.json().catch(() => ({}))) as FacilityApiResult;

      if (!response.ok || result.success === false) {
        throw new Error('Không thể lưu cơ sở làm việc. Vui lòng thử lại.');
      }

      if (!result.facility) throw new Error('Không thể xác nhận dữ liệu cơ sở vừa lưu. Vui lòng thử lại.');
      setBranches((current) => isEditing
        ? reconcileUpdatedFacility(current, result.facility!)
        : reconcileCreatedFacility(current, result.facility!));

      showToast('Đã lưu', 'Đã lưu cơ sở làm việc.', 'success');
      setShowModal(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể lưu cơ sở làm việc. Vui lòng thử lại.';
      setSaveError(message);
      showToast('Không thể lưu', 'Không thể lưu cơ sở làm việc. Vui lòng thử lại.', 'error');
    } finally {
      setIsSaving(false);
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

        const deletedId = result.deletedId ?? id;
        setBranches((current) => reconcileDeletedFacility(current, deletedId));

        showToast('Đã xóa', 'Đã xóa cơ sở làm việc.', 'success');
      } catch (err) {
        showToast('Lỗi hệ thống', err instanceof Error ? err.message : 'Không thể xóa cơ sở làm việc.', 'error');
      }
    });
  };

  return (
    <AdminPage>
    <div className="space-y-6">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-base font-bold flex items-center gap-2"><MapPin className="w-5 h-5 text-blue-500" /> Danh Sách Cơ Sở & Quản Lý Vị Trí Làm Việc</h1>
          <p className="text-[11px] text-slate-400 mt-0.5">Cấu hình rào chắn địa lý vùng an toàn chấm công Nhân sự máy số hóa</p>
        </div>
        <button onClick={handleOpenAdd} disabled={!canManageFacilities} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg disabled:cursor-not-allowed disabled:opacity-50"><Plus className="w-4 h-4" /> Thêm Cơ Sở Mới</button>
      </div>

      {!canManageFacilities && <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">Chức năng cập nhật cơ sở đang chờ kích hoạt.</p>}

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="bg-slate-950 text-slate-400 font-semibold border-b border-slate-800 uppercase text-[10px]">
            <tr>
              <th className="p-4 w-[25%]">Tên Cơ Sở / Chi Nhánh</th>
              <th className="p-4 w-[35%]">Địa Chỉ Thực Tế Tại Xưởng</th>
              <th className="p-4 w-[12%]">Vĩ Độ</th>
              <th className="p-4 w-[12%]">Kinh Độ</th>
              <th className="p-4 w-[10%]">Vùng An Toàn</th>
              {hasFacilityStatus && <th className="p-4">Trạng thái</th>}
              <th className="p-4 w-[6%] text-center">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
            {loading ? (
              <tr><td colSpan={hasFacilityStatus ? 7 : 6} className="p-8 text-center text-slate-400"><RefreshCcw className="mr-2 inline h-4 w-4 animate-spin" />Đang tải danh sách cơ sở...</td></tr>
            ) : loadError ? (
              <tr>
                <td colSpan={hasFacilityStatus ? 7 : 6} className="p-8 text-center text-slate-400">
                  <p>Không thể tải danh sách cơ sở làm việc.</p>
                  <button type="button" onClick={() => void loadFacilities()} disabled={isRefreshing} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-blue-500/40 px-3 py-2 font-bold text-blue-300">
                    <RefreshCcw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> {isRefreshing ? 'Đang thử lại...' : 'Thử lại'}
                  </button>
                </td>
              </tr>
            ) : branches.length === 0 ? (
              <tr>
                <td colSpan={hasFacilityStatus ? 7 : 6} className="text-center p-8 text-slate-500 italic">
                  Chưa có dữ liệu cơ sở xưởng trên hệ thống.
                </td>
              </tr>
            ) : (
              branches.map(b => (
                <tr key={b.id} className="hover:bg-slate-950/20 transition">
                  <td className="p-4 font-bold text-slate-200">
                    🏛️ {b.facilityName}
                    {!b.isActive && <span className="ml-2 rounded border border-slate-700 px-1.5 py-0.5 text-[9px] text-slate-400">Ngừng hoạt động</span>}
                    <br/>
                    <span className="text-[9px] text-slate-500 font-mono bg-slate-950 px-1.5 py-0.5 rounded border border-slate-850 mt-1 block w-fit">ID: {b.id}</span>
                  </td>
                  <td className="p-4 text-slate-400 max-w-xs truncate" title={b.address || ''}>{b.address || 'Chưa cập nhật'}</td>
                  <td className="p-4 font-mono font-bold text-blue-400">{b.lat ?? 'Chưa cập nhật'}</td>
                  <td className="p-4 font-mono font-bold text-blue-400">{b.lng ?? 'Chưa cập nhật'}</td>
                  <td className="p-4 font-bold text-amber-400 font-mono">{b.radius == null ? 'Chưa cập nhật' : `${b.radius} mét`}</td>
                  {hasFacilityStatus && <td className="p-4 text-slate-400">{b.isActive ? 'Đang hoạt động' : 'Ngừng hoạt động'}</td>}
                  <td className="p-4 text-center space-x-1">
                    <button disabled={!canManageFacilities} onClick={() => handleOpenEdit(b)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-blue-400 hover:bg-slate-800 transition disabled:opacity-40" title="Chỉnh sửa"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button disabled={!canManageFacilities} onClick={() => handleDelete(b.id)} className="p-1.5 bg-slate-950 border border-slate-800 rounded-lg text-red-500 hover:bg-red-950/20 transition disabled:opacity-40" title="Xóa cơ sở"><Trash2 className="w-3.5 h-3.5" /></button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-40 animate-fadeIn overflow-y-auto overscroll-contain">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md max-h-[calc(100vh-2rem)] overflow-hidden text-xs text-slate-200 shadow-2xl flex flex-col">
            <div className="flex justify-between items-center border-b border-slate-800 p-6 pb-2.5">
              <h3 className="font-bold text-slate-200 uppercase tracking-wider text-[11px]">KHAI BÁO CHI NHÁNH CƠ SỞ MỚI</h3>
              <button type="button" disabled={isSaving} onClick={() => setShowModal(false)}><X className="w-5 h-5 text-slate-500 hover:text-white" /></button>
            </div>

            <div className="space-y-3 overflow-y-auto px-6 py-4 pr-5">
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
                    disabled={isGeocoding || isSaving}
                    className="bg-slate-950 border border-slate-850 text-cyan-400 font-bold px-3 py-2 rounded-xl flex items-center gap-1 hover:border-cyan-500/40 transition shrink-0 disabled:opacity-50"
                  >
                    {isGeocoding ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Navigation className="w-3.5 h-3.5"/>}
                    {isGeocoding ? 'Đang dò...' : 'Dò Tọa Độ'}
                  </button>
                </div>
                {geocodeDisplayName && (
                  <div className="mt-2 rounded-lg border border-cyan-500/30 bg-cyan-500/5 p-3" role="status">
                    <p className="font-semibold text-cyan-200">Địa chỉ bản đồ (chỉ để xác nhận)</p>
                    <p className="mt-1 text-slate-300">{geocodeDisplayName}</p>
                    {geocodeAlternatives.length > 1 && (
                      <div className="mt-2 space-y-1.5">
                        <p className="text-amber-200">Địa chỉ có nhiều kết quả gần giống, vui lòng chọn lại.</p>
                        {geocodeAlternatives.map((option) => (
                          <button key={`${option.lat}-${option.lng}`} type="button" onClick={() => { setLat(option.lat); setLng(option.lng); setGeocodeDisplayName(option.displayName); }} className="block w-full rounded border border-slate-700 p-2 text-left hover:border-cyan-500/50">
                            {option.displayName}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-[10px] text-slate-500">Địa chỉ đã nhập được giữ nguyên. Tọa độ chưa được lưu cho đến khi bấm lưu cơ sở.</p>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div><label className="text-slate-400 font-medium">Vĩ độ (Latitude):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-cyan-400 font-mono font-bold focus:outline-none" value={lat} onChange={e => setLat(e.target.value)} /></div>
                <div><label className="text-slate-400 font-medium">Kinh độ (Longitude):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 text-cyan-400 font-mono font-bold focus:outline-none" value={lng} onChange={e => setLng(e.target.value)} /></div>
              </div>
              <div><label className="text-slate-400 font-medium">Bán kính khoanh vùng bảo mật chấm công (Mét):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none text-amber-400 font-mono font-bold" value={radius} onChange={e => setRadius(e.target.value)} /></div>
            </div>

            <div className="border-t border-slate-800 p-6 pt-3 font-sans">
              {saveError && (
                <p role="alert" className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-[11px] font-semibold text-red-200">
                  {saveError}
                </p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" disabled={isSaving} onClick={() => setShowModal(false)} className="bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 text-center disabled:opacity-60">Hủy bỏ</button>
                <button type="button" disabled={isSaving} onClick={handleSave} className="bg-blue-600 text-white font-black p-3 rounded-xl transition hover:bg-blue-700 shadow-lg tracking-wide uppercase text-[11px] disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? 'ĐANG LƯU...' : '💾 KÍCH HOẠT CƠ SỞ'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AdminPage>
  );
}
