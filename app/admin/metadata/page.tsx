// app/admin/metadata/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Database, Plus, Trash2, Save, RefreshCcw, Layers, X } from 'lucide-react';

export default function MetadataManagement() {
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCatName, setNewCatName] = useState('');

  const loadMetadata = async () => {
    setLoading(true);
    const { data } = await supabase.from('system_metadata').select('*').order('id', { ascending: true });
    setCategories(data || []);
    setLoading(false);
  };

  useEffect(() => { loadMetadata(); }, []);

  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    await supabase.from('system_metadata').insert([{ name: newCatName.trim(), data: [] }]);
    setNewCatName('');
    loadMetadata();
  };

  // HÀM XÓA VĨNH VIỄN 1 DANH MỤC KHỎI DB
  const handleDeleteCategory = async (id: number, name: string) => {
    if (window.confirm(`⚠️ SẾP CHÚ Ý: Hành động này sẽ xóa vĩnh viễn toàn bộ danh mục [${name}] khỏi cơ sở dữ liệu! Sếp chắc chắn chứ?`)) {
      await supabase.from('system_metadata').delete().eq('id', id);
      loadMetadata();
      alert('Đã xóa danh mục thành công!');
    }
  };

  // THUẬT TOÁN ĐỘNG: Thêm dòng con thông minh dựa trên tên danh mục sếp chọn
  const handleAddRow = (cat: any) => {
    const isGps = cat.name.includes('GPS') || cat.name.includes('cơ sở');
    const newRow = isGps 
      ? { facility_name: 'Cơ sở mới', lat: 21.0285, lng: 105.8542, radius: 15 }
      : { title: 'Vị trí công việc', level: 'A1', rate: 30000 };

    setCategories(categories.map(c => c.id === cat.id ? { ...c, data: [...c.data, newRow] } : c));
  };

  const handleUpdateRow = (catId: number, index: number, field: string, value: any) => {
    setCategories(categories.map(c => {
      if (c.id === catId) {
        const newData = [...c.data];
        newData[index] = { ...newData[index], [field]: (field === 'rate' || field === 'lat' || field === 'lng' || field === 'radius') ? Number(value) : value };
        return { ...c, data: newData };
      }
      return c;
    }));
  };

  const handleRemoveRow = (catId: number, index: number) => {
    setCategories(categories.map(c => c.id === catId ? { ...c, data: c.data.filter((_: any, i: number) => i !== index) } : c));
  };

  const handleSaveCategory = async (cat: any) => {
    await supabase.from('system_metadata').update({ data: cat.data }).eq('id', cat.id);
    alert(`✨ Đã đóng gói và ghi đè cấu trúc JSON cho [${cat.name}] vào Cloud DB thành công!`);
  };

  if (loading) return <div className="p-6 text-xs text-center font-mono text-slate-500"><RefreshCcw className="w-4 h-4 animate-spin inline mr-2" /> Đang đồng bộ ma trận danh mục...</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 text-slate-100 font-sans">
      <div className="flex items-center gap-2 border-b border-slate-800 pb-4">
        <Layers className="w-5 h-5 text-purple-400" />
        <div>
          <h1 className="text-base font-bold">Hệ Thống Danh Mục Metadata (Dữ liệu Động 100%)</h1>
          <p className="text-[11px] text-slate-400">Thiết lập ma trận phân cấp lương, chuỗi cơ sở và tọa độ GPS định vị chuỗi xưởng</p>
        </div>
      </div>

      {/* FORM TẠO DANH MỤC MỚI */}
      <div className="flex gap-2 bg-slate-900 p-3 rounded-xl border border-slate-800">
        <input type="text" placeholder="Tên danh mục cấu hình mới (Ví dụ: Danh sách cơ sở - Vị trí làm việc)..." className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 focus:outline-none" value={newCatName} onChange={(e) => setNewCatName(e.target.value)} />
        <button onClick={handleCreateCategory} className="bg-purple-600 hover:bg-purple-700 text-xs px-4 py-2 rounded-lg font-bold flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Thêm danh mục</button>
      </div>

      {/* KHỐI CONVERT BIỂU MẪU ĐỘNG */}
      <div className="space-y-6">
        {categories.map(cat => {
          const isGpsCategory = cat.name.includes('GPS') || cat.name.includes('cơ sở');

          return (
            <div key={cat.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-4 shadow-xl">
              <div className="flex justify-between items-center border-b border-slate-800/60 pb-2.5">
                <span className="text-xs font-black text-purple-400 uppercase tracking-wide">📁 {cat.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleSaveCategory(cat)} className="bg-emerald-600 hover:bg-emerald-700 text-[10px] font-bold px-3 py-1.5 rounded-lg flex items-center gap-1 transition"><Save className="w-3.5 h-3.5" /> Lưu cấu trúc</button>
                  <button onClick={() => handleDeleteCategory(cat.id, cat.name)} className="bg-slate-950 border border-slate-800 hover:bg-red-950/40 text-slate-500 hover:text-red-400 p-1.5 rounded-lg transition" title="Xóa danh mục"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              {/* BẢNG INPUT TỰ ĐỘNG CONVERT BIẾN ĐỔI THEO LOẠI DATA */}
              <div className="space-y-2">
                {cat.data.map((row: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-950/60 p-2 rounded-xl border border-slate-900 text-xs items-center">
                    {isGpsCategory ? (
                      // NẾU LÀ NHÓM CƠ SỞ / GPS ➔ CONVERT RA Ô NHẬP ĐỊNH VỊ CHUỖI CƠ SỞ
                      <>
                        <input type="text" className="bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-200" value={row.facility_name} onChange={(e) => handleUpdateRow(cat.id, idx, 'facility_name', e.target.value)} placeholder="Tên Cơ Sở/Chi Nhánh" />
                        <input type="number" className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-blue-400" value={row.lat} onChange={(e) => handleUpdateRow(cat.id, idx, 'lat', e.target.value)} placeholder="Vĩ độ (Lat)" step="0.000001" />
                        <input type="number" className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-blue-400" value={row.lng} onChange={(e) => handleUpdateRow(cat.id, idx, 'lng', e.target.value)} placeholder="Kinh độ (Lng)" step="0.000001" />
                        <div className="flex items-center justify-between gap-2">
                          <input type="number" className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-amber-400 font-bold w-full" value={row.radius} onChange={(e) => handleUpdateRow(cat.id, idx, 'radius', e.target.value)} placeholder="Bán kính (m)" />
                          <button onClick={() => handleRemoveRow(cat.id, idx)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </>
                    ) : (
                      // NẾU LÀ CÁC NHÓM KHÁC ➔ CONVERT RA Ô NHẬP LƯƠNG/CẤP BẬC NHƯ CŨ
                      <>
                        <input type="text" className="bg-slate-900 border border-slate-800 rounded-lg p-2" value={row.title} onChange={(e) => handleUpdateRow(cat.id, idx, 'title', e.target.value)} placeholder="Chức danh" />
                        <input type="text" className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono" value={row.level} onChange={(e) => handleUpdateRow(cat.id, idx, 'level', e.target.value)} placeholder="Level" />
                        <input type="number" className="bg-slate-900 border border-slate-800 rounded-lg p-2 font-mono text-amber-400 font-bold" value={row.rate} onChange={(e) => handleUpdateRow(cat.id, idx, 'rate', e.target.value)} placeholder="Mức lương" />
                        <div className="text-right pr-2">
                          <button onClick={() => handleRemoveRow(cat.id, idx)} className="text-slate-600 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <button onClick={() => handleAddRow(cat)} className="text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1 pt-1"><Plus className="w-3.5 h-3.5" /> Thêm hàng con mới</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}