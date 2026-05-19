// app/admin/settings/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Settings, Save, Plus, Trash2, ChevronDown, ChevronUp, X, Sliders, Info, Eye, EyeOff, RefreshCcw } from 'lucide-react';

interface SettingItem { key: string; value: string; config_name: string; group_name: string; description: string; }

export default function AdminDynamicSettingsPage() {
  const [settings, setSettings] = useState<SettingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [openGroups, setOpenGroups] = useState<string[]>(['Cổng Gửi Email']);
  const [showSecretKeys, setShowSecretKeys] = useState<{ [key: string]: boolean }>({});

  // Popup States
  const [showPopup, setShowPopup] = useState(false);
  const [newGroup, setNewGroup] = useState('Cổng Gửi Email');
  const [newConfigName, setNewConfigName] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const loadSettingsFromDb = async () => {
    setLoading(true);
    const { data } = await supabase.from('system_settings').select('*').order('group_name', { ascending: true });
    setSettings(data || []);
    setLoading(false);
  };

  useEffect(() => { loadSettingsFromDb(); }, []);

  const handleValueChangeInState = (key: string, updatedVal: string) => {
    setSettings(prev => prev.map(s => s.key === key ? { ...s, value: updatedVal } : s));
  };

  const handleCreateNewConfigKey = async () => {
    if (!newKey.trim() || !newValue.trim() || !newConfigName.trim()) { alert('Vui lòng điền đủ thông tin!'); return; }
    const cleanKey = newKey.trim().toLowerCase().replace(/\s+/g, '_');
    
    await supabase.from('system_settings').insert([{
      key: cleanKey, value: newValue.trim(), config_name: newConfigName.trim(), group_name: newGroup, description: newDesc.trim()
    }]);

    setShowPopup(false); setNewConfigName(''); setNewKey(''); setNewValue(''); setNewDesc('');
    loadSettingsFromDb();
    alert('✨ Đã thêm biến cấu hình lõi mới thành công!');
  };

  const handleDeleteConfigKey = async (key: string, name: string) => {
    if (window.confirm(`⚠️ Sếp có chắc chắn muốn xóa cấu hình [${name}] khỏi hệ thống?`)) {
      setSettings(prev => prev.filter(s => s.key !== key));
      await supabase.from('system_settings').delete().eq('key', key);
      alert('Đã xóa cấu hình!');
    }
  };

  const handleSaveAllSettings = async () => {
    setIsSaving(true);
    await supabase.from('system_settings').upsert(settings, { onConflict: 'key' });
    setIsSaving(false);
    alert('✨ Đã đồng bộ cấu hình hệ thống!');
  };

  const groupedSettings = settings.reduce((acc: { [key: string]: SettingItem[] }, item) => {
    if (!acc[item.group_name]) acc[item.group_name] = [];
    acc[item.group_name].push(item);
    return acc;
  }, {});

  const uniqueGroupNames = Array.from(new Set(settings.map(s => s.group_name)));

  if (loading) return <div className="p-6 text-xs text-center font-mono text-slate-500"><RefreshCcw className="w-4 h-4 animate-spin inline mr-2" /> Đang tải...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-500" />
          <h1 className="text-base font-bold">Cấu Hình Biến Hệ Thống Cốt Lõi</h1>
        </div>
        <button onClick={() => setShowPopup(true)} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition"><Plus className="w-4 h-4" /> Tạo Biến Mới</button>
      </div>

      <div className="space-y-3">
        {Object.keys(groupedSettings).map((groupName) => {
          const isGroupOpen = openGroups.includes(groupName);
          const groupItems = groupedSettings[groupName];

          return (
            <div key={groupName} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <button onClick={() => setOpenGroups(prev => prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName])} className="w-full flex justify-between items-center p-4 hover:bg-slate-800/40 transition text-left focus:outline-none">
                <span className="text-xs font-black text-slate-200 uppercase tracking-wide">⚙️ {groupName}</span>
                {isGroupOpen ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
              </button>

              {isGroupOpen && (
                <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 space-y-4">
                  {groupItems.map((item) => {
                    const isSecret = item.key.includes('pass') || item.key.includes('key') || item.key.includes('secret') || item.key.includes('token');
                    const isVisible = showSecretKeys[item.key] || false;

                    return (
                      <div key={item.key} className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-slate-950/70 border border-slate-900 rounded-xl items-start text-xs">
                        <div>
                          <label className="font-bold text-slate-300 block">{item.config_name}</label>
                          <span className="text-[9px] text-slate-600 font-mono block mt-1 uppercase">Key: {item.key}</span>
                        </div>
                        <div className="relative">
                          <input type={isSecret && !isVisible ? "password" : "text"} className="w-full bg-slate-900 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 font-mono focus:outline-none" value={item.value} onChange={(e) => handleValueChangeInState(item.key, e.target.value)} />
                          {isSecret && <button type="button" onClick={() => setShowSecretKeys(p=>({...p,[item.key]:!p[item.key]}))} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500"><Eye className="w-4 h-4" /></button>}
                        </div>
                        <div className="flex gap-2 justify-between items-start">
                          <p className="text-[11px] text-slate-500 leading-normal">{item.description}</p>
                          <button onClick={() => handleDeleteConfigKey(item.key, item.config_name)} className="text-slate-700 hover:text-red-400 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="pt-4 border-t border-slate-800 text-right">
        <button onClick={handleSaveAllSettings} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl flex items-center justify-center gap-2 text-xs uppercase tracking-wider transition"><Save className="w-4 h-4" /> Lưu & Áp Dụng</button>
      </div>

      {/* POPUP THÊM BIẾN MỚI */}
      {showPopup && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-md space-y-4 text-xs relative">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3"><h3 className="font-bold text-slate-200 uppercase">🔌 Thêm Biến Hệ Thống</h3><button onClick={() => setShowPopup(false)}><X className="w-5 h-5 text-slate-500" /></button></div>
            <div className="space-y-3">
              <div><label className="text-slate-400 font-bold">Thuộc nhóm:</label><select className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none" value={newGroup} onChange={(e) => setNewGroup(e.target.value)}>{uniqueGroupNames.map(g => <option key={g} value={g}>{g}</option>)}<option value="Tích Hợp API Ngoài">➕ Thêm nhóm: API Bên Thứ 3</option></select></div>
              <div><label className="text-slate-400 font-bold">Tên hiển thị:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none" placeholder="Ví dụ: Google Drive Token" value={newConfigName} onChange={(e) => setNewConfigName(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold">Từ khóa (Key):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-blue-400 focus:outline-none" placeholder="drive_token" value={newKey} onChange={(e) => setNewKey(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold">Giá trị (Value):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 font-mono text-amber-400 focus:outline-none" placeholder="Nhập giá trị..." value={newValue} onChange={(e) => setNewValue(e.target.value)} /></div>
              <div><label className="text-slate-400 font-bold">Mô tả mục đích:</label><textarea className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mt-1.5 focus:outline-none h-14 resize-none" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} /></div>
            </div>
            <div className="pt-2 border-t border-slate-800 flex gap-2"><button onClick={() => setShowPopup(false)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400">Hủy</button><button onClick={handleCreateNewConfigKey} className="flex-1 bg-blue-600 font-bold text-white rounded-xl uppercase">Lưu</button></div>
          </div>
        </div>
      )}
    </div>
  );
}