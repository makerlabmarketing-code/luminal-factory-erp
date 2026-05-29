// app/admin/tasks/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { ClipboardList, Plus, Trash2, Search, ChevronLeft, ChevronRight, X, Layers, Eye, Calendar, Save, ExternalLink, Activity, CheckSquare, RefreshCcw } from 'lucide-react';

export default function AdminTaskWorkflowDashboard() {
  const { showToast, showConfirm } = useNotification();
  const [tasks, setTasks] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectDeadline, setProjectDeadline] = useState('');
  const [formPhases, setFormPhases] = useState<any[]>([]);

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeProjectName, setActiveProjectName] = useState('');
  const [activeProjectPhases, setActiveProjectPhases] = useState<any[]>([]);
  const [driveLinkInput, setDriveLinkInput] = useState(''); 

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: tList, error: tErr } = await supabase
        .from('system_settings')
        .select('*')
        .eq('group_name', 'PRODUCTION_WORKFLOW')
        .order('key', { ascending: true });
        
      if (tErr) throw tErr;
      setTasks(tList || []);

      const { data: emps, error: eErr } = await supabase.from('employees').select('id, full_name, title').eq('status', 'ACTIVE');
      if (eErr) throw eErr;
      setEmployees(emps || []);
    } catch (e: any) {
      showToast('Lỗi tải dữ liệu', e.message, 'error');
    }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  const handleManualRefresh = async () => {
    await loadData();
    showToast('Hệ thống', 'Đã đồng bộ dữ liệu xưởng mới nhất!', 'success');
  };

  const handleOpenAddModal = () => {
    setNewProjectName('');
    setProjectDeadline('');
    setFormPhases([{ name: 'Giai đoạn 1', tasks: [{ name: '', assignee: '', deadline: '', note: '', status: 'TODO' }] }]);
    setShowAddModal(true);
  };

  const handleAddPhaseInForm = () => {
    setFormPhases([...formPhases, { name: `Giai đoạn ${formPhases.length + 1}`, tasks: [{ name: '', assignee: '', deadline: '', note: '', status: 'TODO' }] }]);
  };

  const handleRemovePhaseInForm = (pIdx: number) => {
    const updated = [...formPhases];
    updated.splice(pIdx, 1);
    setFormPhases(updated);
  };

  const handleAddTaskInForm = (pIdx: number) => {
    const updated = [...formPhases];
    updated[pIdx].tasks.push({ name: '', assignee: '', deadline: '', note: '', status: 'TODO' });
    setFormPhases(updated);
  };

  const handleRemoveTaskInForm = (pIdx: number, tIdx: number) => {
    const updated = [...formPhases];
    updated[pIdx].tasks.splice(tIdx, 1);
    setFormPhases(updated);
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim()) return showToast('Thiếu dữ liệu', 'Vui lòng nhập tên dự án tổng!', 'error');
    if (!projectDeadline) return showToast('Thiếu thời hạn', 'Vui lòng chọn ngày hạn dự án!', 'error');

    try {
      const timestampId = Date.now();
      const payloadArray = formPhases.map((phase, idx) => {
        const validTasks = phase.tasks.filter((t: any) => t.name.trim() !== '').map((t: any) => ({
          name: t.name.trim(),
          assignee: t.assignee,
          deadline: t.deadline,
          note: t.note.trim(),
          status: t.status || 'TODO'
        }));
        
        return {
          group_name: 'PRODUCTION_WORKFLOW',
          config_name: `${newProjectName.trim()} - ${phase.name.trim() || `Giai đoạn ${idx + 1}`}`,
          key: `TASK_${timestampId}_PHASE_${idx}`,
          value: idx === 0 ? 'DOING' : 'TODO',
          description: JSON.stringify({
            project_drive_link: '', 
            project_deadline: projectDeadline,
            tasks_list: validTasks
          })
        };
      });

      const { error } = await supabase.from('system_settings').insert(payloadArray);
      if (error) throw error;

      setShowAddModal(false);
      await loadData();
      showToast('Thành công', 'Đã khởi tạo dự án gọn gàng!', 'success');
    } catch (err: any) {
      showToast('Lỗi Lưu Trữ', err.message, 'error');
    }
  };

  const handleUpdatePhaseStatus = async (taskKey: string, newStatus: string) => {
    try {
      const { error } = await supabase.from('system_settings').update({ value: newStatus }).eq('key', taskKey);
      if (error) throw error;
      
      setActiveProjectPhases(prev => prev.map(p => p.key === taskKey ? { ...p, value: newStatus } : p));
      showToast('Đã cập nhật', 'Trạng thái giai đoạn thay đổi thành công!', 'success');
      
      const { data: tList } = await supabase.from('system_settings').select('*').eq('group_name', 'PRODUCTION_WORKFLOW').order('key', { ascending: true });
      if (tList) setTasks(tList);
    } catch (e: any) { showToast('Lỗi', e.message, 'error'); }
  };

  const handleSaveDriveLinkToDB = async () => {
    if (activeProjectPhases.length === 0) return;
    try {
      const cleanedLink = driveLinkInput.trim();
      const updatePromises = activeProjectPhases.map(async (phase) => {
        let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
        try { currentJSON = JSON.parse(phase.description || '{}'); } catch {}
        currentJSON.project_drive_link = cleanedLink;
        return supabase.from('system_settings').update({ description: JSON.stringify(currentJSON) }).eq('key', phase.key);
      });

      await Promise.all(updatePromises);
      showToast('Thành công', 'Đã lưu link Google Drive tổng!', 'success');
      loadData();
      setShowDetailModal(false);
    } catch (e: any) { showToast('Lỗi', e.message, 'error'); }
  };

  const handleUpdateNestedTaskInline = async (phaseKey: string, rawDescription: string, taskIdx: number, field: string, value: string) => {
    try {
      let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
      try { currentJSON = JSON.parse(rawDescription || '{}'); } catch {}
      currentJSON.tasks_list[taskIdx][field] = value;

      const updatedDescription = JSON.stringify(currentJSON);
      const { error } = await supabase.from('system_settings').update({ description: updatedDescription }).eq('key', phaseKey);
      if (error) throw error;
      
      setActiveProjectPhases(prev => prev.map(p => p.key === phaseKey ? { ...p, description: updatedDescription } : p));
      
      const { data: updatedList } = await supabase.from('system_settings').select('*').eq('group_name', 'PRODUCTION_WORKFLOW').order('key', { ascending: true });
      if (updatedList) setTasks(updatedList);
    } catch (e: any) { showToast('Lỗi', e.message, 'error'); }
  };

  const handleDeleteProjectGroup = (configNamePrefix: string) => {
    if (!configNamePrefix) return;
    const shortName = configNamePrefix.split(' - ')[0]; 
    showConfirm('Xóa dự án', `Sếp có chắc chắn xóa toàn bộ dự án [${shortName}]?`, async () => {
      try {
        const { error } = await supabase.from('system_settings').delete().like('config_name', `${shortName}%`);
        if (error) throw error;
        showToast('Đã xóa', 'Dự án đã được dọn sạch.', 'info');
        loadData();
      } catch (e: any) { showToast('Lỗi', e.message, 'error'); }
    });
  };

  const projectGroupsMap: { [key: string]: any[] } = {};
  tasks.forEach(t => {
    if (!t.config_name) return;
    const parts = t.config_name.split(' - ');
    const pName = parts[0] || 'Dự án không tên';
    if (!projectGroupsMap[pName]) projectGroupsMap[pName] = [];
    projectGroupsMap[pName].push(t);
  });

  const uniqueProjectNamesAll = Object.keys(projectGroupsMap);
  let totalProjectsCount = uniqueProjectNamesAll.length;
  let doingProjectsCount = 0;
  let doneProjectsCount = 0;

  uniqueProjectNamesAll.forEach(pName => {
    const phases = projectGroupsMap[pName];
    if (phases.every(ph => ph.value === 'DONE')) doneProjectsCount++;
    else doingProjectsCount++;
  });

  const uniqueProjectNames = uniqueProjectNamesAll.filter(name => name.toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(uniqueProjectNames.length / itemsPerPage) || 1;
  const currentProjectNames = uniqueProjectNames.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* TIÊU ĐỀ */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-500" />
          <div>
            <h1 className="text-base font-bold">Hệ Thống Gom Nhóm & Quản Lý Dự Án Tập Tập Trung</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">Trạm điều khiển Admin - Tối ưu hóa tinh gọn hiệu năng tốc độ</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleManualRefresh} className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 p-2.5 rounded-xl transition flex items-center gap-1.5 text-xs font-bold cursor-pointer">
            <RefreshCcw className="w-4 h-4" /> Làm mới
          </button>
          <button onClick={handleOpenAddModal} className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg cursor-pointer">
            <Plus className="w-4 h-4" /> Tạo dự án mới
          </button>
        </div>
      </div>

      {/* 📊 BOX TÍNH TỔNG */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Tổng số lượng dự án</span>
            <span className="text-2xl font-black text-slate-50 font-mono">{totalProjectsCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-purple-950/50 text-purple-400"><Layers className="w-5 h-5" /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Dự án đang sản xuất</span>
            <span className="text-2xl font-black text-blue-400 font-mono">{doingProjectsCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/50 text-blue-400"><Activity className="w-5 h-5" /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-sm">
          <div className="space-y-1">
            <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Đã xuất xưởng thành công</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{doneProjectsCount}</span>
          </div>
          <div className="p-3 rounded-xl bg-emerald-950/50 text-emerald-400"><CheckSquare className="w-5 h-5" /></div>
        </div>
      </div>

      {/* BẢNG THEO DÕI CHÍNH */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-5 py-3 border-b border-slate-800 bg-slate-950/40 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <span className="text-xs font-bold uppercase text-slate-400">Nhật Ký Hạch Toán Kỳ</span>
          <input type="text" placeholder="Tìm kiếm nội dung..." className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-200 focus:outline-none w-full sm:w-64" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="p-4 w-6/12">Tên Dự Án Tổng Quan</th>
                <th className="p-4 text-center w-36">Hạn Dự Án Tổng</th>
                <th className="p-4 text-center w-32">Link Google Drive</th>
                <th className="p-4 text-center w-32">Số Giai Đoạn</th>
                <th className="p-4 text-center w-36">Thao tác</th>
                <th className="p-4 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
              {currentProjectNames.map(pName => {
                const projectPhases = projectGroupsMap[pName].sort((a, b) => a.key.localeCompare(b.key));
                const totalPhases = projectPhases.length;
                
                let deadline = 'Chưa đặt';
                let driveLink = '';
                try {
                  const parsed = JSON.parse(projectPhases[0]?.description || '{}');
                  deadline = parsed.project_deadline || 'Chưa đặt';
                  driveLink = parsed.project_drive_link || '';
                } catch {}

                return (
                  <tr key={pName} className="hover:bg-slate-950/20 transition">
                    <td className="p-4">
                      <p className="font-black text-slate-100 text-sm">📦 {pName}</p>
                    </td>
                    <td className="p-4 text-center font-mono text-amber-400 font-bold">
                      <span className="bg-amber-950/20 border border-amber-900/20 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3"/> {deadline}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      {driveLink ? (
                        <a href={driveLink} target="_blank" rel="noreferrer" className="text-blue-400 font-bold underline inline-flex items-center gap-0.5 hover:text-blue-300">
                          <ExternalLink className="w-3 h-3" /> Link Drive
                        </a>
                      ) : <span className="text-slate-600 italic">Chưa gắn link</span>}
                    </td>
                    <td className="p-4 text-center">
                      <span className="bg-slate-950 border border-slate-800 px-2 py-0.5 rounded-md text-purple-400 font-bold font-mono">{totalPhases} Phase</span>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => { setActiveProjectName(pName); setActiveProjectPhases(projectPhases); setDriveLinkInput(driveLink); setShowDetailModal(true); }} className="bg-slate-950 border border-slate-800 hover:border-blue-500 text-blue-400 font-bold text-[10px] px-2.5 py-1.5 rounded-xl transition inline-flex items-center gap-1 cursor-pointer">
                        <Eye className="w-3.5 h-3.5" /> Quản lý chi tiết
                      </button>
                    </td>
                    <td className="p-4 text-center">
                      <button onClick={() => handleDeleteProjectGroup(projectPhases[0]?.config_name)} className="text-slate-600 hover:text-red-400 transition cursor-pointer"><Trash2 className="w-3.5 h-3.5"/></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* PHÂN TRANG */}
        <div className="p-4 bg-slate-950/50 border-t border-slate-800 flex justify-between items-center text-xs font-mono text-slate-400">
          <div>Trang {currentPage} / {totalPages}</div>
          <div className="flex items-center gap-1">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 cursor-pointer"><ChevronLeft className="w-4 h-4" /></button>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1.5 bg-slate-900 border border-slate-800 rounded-lg disabled:opacity-20 cursor-pointer"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>
      </div>

      {/* POPUP CHI TIẾT CÁC PHASE & TASK BÊN TRONG */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl space-y-4 my-auto relative shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-100 uppercase">Dự án: {activeProjectName}</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-500 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="bg-slate-950 border border-slate-850 p-3 rounded-xl space-y-2">
              <label className="text-[10px] text-slate-400 font-bold uppercase block">Đường dẫn thư mục Google Drive dự án:</label>
              <div className="flex gap-2">
                <input type="text" className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-xs text-blue-400 font-mono focus:outline-none" value={driveLinkInput} onChange={(e) => setDriveLinkInput(e.target.value)} placeholder="Nhập đường dẫn tài liệu..." />
                <button onClick={handleSaveDriveLinkToDB} className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 rounded-xl font-bold flex items-center gap-1 cursor-pointer"><Save className="w-4 h-4"/> Lưu</button>
              </div>
            </div>

            <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
              {activeProjectPhases.map((phase, pIdx) => {
                let currentJSON: any = { tasks_list: [] };
                try { currentJSON = JSON.parse(phase.description || '{}'); } catch {}

                return (
                  <div key={phase.key} className="bg-slate-950 p-3 border border-slate-850 rounded-xl space-y-2.5">
                    <div className="flex justify-between items-center border-b border-slate-850 pb-1.5">
                      <span className="font-bold text-xs text-purple-400">Giai đoạn {pIdx + 1}: {phase.config_name?.split(' - ')[1]}</span>
                      <select 
                        className={`text-[10px] font-black rounded-md p-1 focus:outline-none cursor-pointer ${
                          phase.value === 'DONE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-blue-950 text-blue-400 border border-blue-800'
                        }`}
                        value={phase.value || 'TODO'}
                        onChange={(e) => handleUpdatePhaseStatus(phase.key, e.target.value)}
                      >
                        <option value="TODO">⚪ CHỜ SẮP XẾP</option>
                        <option value="DOING">⚡ ĐANG CHẠY</option>
                        <option value="DONE">✓ HOÀN THÀNH</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      {currentJSON.tasks_list?.map((task: any, tIdx: number) => (
                        <div key={tIdx} className="bg-slate-900 border border-slate-850 p-3 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3 items-center text-[11px]">
                          <div className="md:col-span-2 space-y-1">
                            <p className="font-bold text-slate-200">⚙️ {task.name}</p>
                            <input type="text" className="w-full bg-slate-950 border border-slate-850 rounded px-2 py-1 text-[10px] text-slate-300 focus:outline-none" placeholder="Ghi chú công việc..." value={task.note || ''} onChange={(e) => handleUpdateNestedTaskInline(phase.key, phase.description, tIdx, 'note', e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <select className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-slate-300 cursor-pointer" value={task.assignee || ''} onChange={(e) => handleUpdateNestedTaskInline(phase.key, phase.description, tIdx, 'assignee', e.target.value)}>
                              <option value="">Gán thợ...</option>
                              {employees.map(emp => <option key={emp.id} value={emp.full_name}>{emp.full_name}</option>)}
                            </select>
                            <input type="datetime-local" className="w-full bg-slate-950 border border-slate-800 rounded p-1 text-amber-400 text-[10px] cursor-pointer" value={task.deadline || ''} onChange={(e) => handleUpdateNestedTaskInline(phase.key, phase.description, tIdx, 'deadline', e.target.value)} />
                          </div>
                          <select 
                            className="w-full bg-slate-950 border border-slate-850 p-1.5 rounded font-bold text-center text-[10px] cursor-pointer" 
                            value={task.status || 'TODO'} 
                            onChange={(e) => handleUpdateNestedTaskInline(phase.key, phase.description, tIdx, 'status', e.target.value)}
                          >
                            <option value="TODO">⏳ CHỜ LÀM</option>
                            <option value="DOING">⚡ ĐANG LÀM</option>
                            <option value="DONE">✓ ĐÃ XONG</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* POPUP TẠO MỚI DỰ ÁN */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-3xl space-y-4 my-auto relative shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-2">
              <span className="font-bold text-purple-400 uppercase text-xs flex items-center gap-1"><Plus className="w-4 h-4"/>Tạo lệnh sản xuất mới</span>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-850">
              <div className="md:col-span-2 space-y-1">
                <label className="text-slate-400 font-bold block text-[11px]">Tên dự án tổng quát:</label>
                <input type="text" placeholder="Ví dụ: Đơn hàng đúc vỏ bọc máy A..." className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-blue-400 focus:outline-none" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-amber-400 font-bold block text-[11px]">Hạn hoàn thành tổng:</label>
                <input type="date" className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-xs font-bold text-amber-400 focus:outline-none cursor-pointer font-mono" value={projectDeadline} onChange={(e) => setProjectDeadline(e.target.value)} />
              </div>
            </div>

            <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1">
              {formPhases.map((p, pIdx) => (
                <div key={pIdx} className="bg-slate-950/40 p-3 border border-slate-800 rounded-xl space-y-2 relative">
                  {formPhases.length > 1 && (
                    <button type="button" onClick={() => handleRemovePhaseInForm(pIdx)} className="absolute top-3 right-3 text-slate-500 hover:text-red-400 cursor-pointer"><Trash2 className="w-3.5 h-3.5"/></button>
                  )}
                  <div className="pr-8">
                    <input type="text" className="w-full bg-slate-900 border border-slate-800 p-2 rounded-lg font-bold text-emerald-400 text-xs focus:outline-none" placeholder="Tên giai đoạn (Ví dụ: Thiết kế mẫu, Đúc thô...)" value={p.name} onChange={(e) => { const n = [...formPhases]; n[pIdx].name = e.target.value; setFormPhases(n); }} />
                  </div>
                  
                  <div className="pl-3 border-l border-slate-800 space-y-2">
                    {p.tasks?.map((t: any, tIdx: number) => (
                      <div key={tIdx} className="flex flex-col sm:flex-row gap-2 p-2 bg-slate-950 rounded-lg border border-slate-850 items-center">
                        <input type="text" className="flex-1 bg-slate-900 border border-slate-800 p-1.5 rounded text-slate-200 focus:outline-none text-xs" placeholder="Tên công việc con..." value={t.name} onChange={(e) => { const n = [...formPhases]; n[pIdx].tasks[tIdx].name = e.target.value; setFormPhases(n); }} />
                        <select className="bg-slate-900 border border-slate-800 p-1.5 rounded text-slate-400 focus:outline-none text-xs cursor-pointer" value={t.assignee} onChange={(e) => { const n = [...formPhases]; n[pIdx].tasks[tIdx].assignee = e.target.value; setFormPhases(n); }}><option value="">Gán thợ...</option>{employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}</select>
                        <input type="datetime-local" className="bg-slate-900 border border-slate-800 p-1.5 rounded text-amber-400 font-mono text-xs cursor-pointer" value={t.deadline} onChange={(e) => { const n = [...formPhases]; n[pIdx].tasks[tIdx].deadline = e.target.value; setFormPhases(n); }} />
                        <button type="button" onClick={() => handleRemoveTaskInForm(pIdx, tIdx)} className="text-slate-500 hover:text-red-400 cursor-pointer"><Trash2 className="w-4 h-4"/></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => handleAddTaskInForm(pIdx)} className="text-[10px] text-purple-400 font-bold hover:underline cursor-pointer">+ Thêm việc con</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={handleAddPhaseInForm} className="w-full border border-dashed border-slate-700 bg-slate-900/30 text-slate-400 text-xs p-2.5 rounded-xl font-bold hover:text-white transition cursor-pointer">+ Thêm Giai Đoạn</button>
            </div>

            <div className="pt-2 border-t border-slate-800 flex gap-2">
              <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-slate-400">Hủy</button>
              <button type="button" onClick={handleCreateProject} className="flex-1 bg-purple-600 hover:bg-purple-700 text-white font-black p-2.5 rounded-xl uppercase text-xs cursor-pointer">🚀 Phát lệnh sản xuất</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}