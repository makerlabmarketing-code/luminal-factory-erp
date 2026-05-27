// app/staff/tasks/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { ClipboardList, Clock, Save, ChevronLeft, ChevronRight, Calendar, Link as LinkIcon, MessageSquare, RefreshCcw, Activity, CheckSquare, ListTodo } from 'lucide-react';

export default function StaffTasksPage() {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [workerName, setWorkerName] = useState('');
  const [loading, setLoading] = useState(true);

  // Phân trang dự án (Cột trái)
  const [allWorkflowTasks, setAllWorkflowTasks] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);

  // Bộ lưu đệm dữ liệu input local để tránh lag và đồng bộ mượt mà
  const [localDriveInputs, setLocalDriveInputs] = useState<{ [key: string]: string }>({});
  const [editableTasks, setEditableTasks] = useState<{ [key: string]: any }>({});

  const loadTasksData = async () => {
    if (!token) { setLoading(false); return; }
    try {
      // 1. Định danh Nhân sự qua Token URL
      const { data: emp } = await supabase.from('employees').select('full_name').eq('qr_token', token).maybeSingle();
      if (!emp) { setLoading(false); return; }
      setWorkerName(emp.full_name);

      // 2. Kéo toàn bộ dữ liệu quy trình từ system_settings
      const { data: workflow } = await supabase.from('system_settings').select('*').eq('group_name', 'PRODUCTION_WORKFLOW');
      const allData = workflow || [];
      setAllWorkflowTasks(allData);

      const driveMap: { [key: string]: string } = {};
      const editMap: { [key: string]: any } = {};

      allData.forEach(item => {
        let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
        try { currentJSON = JSON.parse(item.description || '{}'); } catch {}

        driveMap[item.key] = currentJSON.project_drive_link || '';

        currentJSON.tasks_list.forEach((t: any, idx: number) => {
          if (t.assignee === emp.full_name) {
            editMap[`${item.key}_TASK_${idx}`] = {
              status: t.status || 'TODO',
              deadline: t.deadline || '',
              note: t.note || ''
            };
          }
        });
      });

      setLocalDriveInputs(driveMap);
      setEditableTasks(editMap);

      // Tự động ghim chọn dự án đầu tiên có chứa việc của Nhân sự này để hiển thị lên bảng phải
      if (!selectedProjectName) {
        const myFirstProj = allData.find(item => (item.description || '').includes(emp.full_name));
        if (myFirstProj) {
          setSelectedProjectName(myFirstProj.config_name.split(' - ')[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  // 🔥 TỰ ĐỘNG LẤY THÔNG TIN MỚI MỖI KHI TRUY CẬP HOẶC QUAY LẠI MÀN HÌNH NHẬN VIỆC
  useEffect(() => {
    loadTasksData();
    window.addEventListener('focus', loadTasksData);
    return () => window.removeEventListener('focus', loadTasksData);
  }, [token]);

  const handleStaffRefresh = async () => {
    await loadTasksData();
    showToast('Hệ thống', 'Đã nạp lại tiến độ ca máy mới nhất từ Admin sếp!', 'info');
  };

  const handleBufferChange = (itemKey: string, taskIdx: number, field: string, value: string) => {
    const targetKey = `${itemKey}_TASK_${taskIdx}`;
    setEditableTasks(prev => ({ ...prev, [targetKey]: { ...prev[targetKey], [field]: value } }));
  };

  // Nút Lưu cập nhật trạng thái việc con phản hồi trực quan siêu tốc
  const handleSaveSpecificTask = async (item: any, taskIdx: number) => {
    try {
      let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
      try { currentJSON = JSON.parse(item.description || '{}'); } catch {}

      const targetKey = `${item.key}_TASK_${taskIdx}`;
      const bufferedData = editableTasks[targetKey];
      if (!bufferedData) return;

      currentJSON.tasks_list[taskIdx].status = bufferedData.status;
      currentJSON.tasks_list[taskIdx].deadline = bufferedData.deadline;
      currentJSON.tasks_list[taskIdx].note = bufferedData.note;

      const updatedDescription = JSON.stringify(currentJSON);

      const { error } = await supabase.from('system_settings').update({ description: updatedDescription }).eq('key', item.key);
      if (error) throw error;
      
      // Đè nóng trực tiếp vào state cục bộ để bảng chi tiết đổi màu trạng thái luôn
      setAllWorkflowTasks(prev => prev.map(t => t.key === item.key ? { ...t, description: updatedDescription } : t));
      showToast('Đồng bộ thành công', '✓ Đã cập nhật tiến độ việc con trực tiếp lên hệ thống!', 'success');
      
      const { data: workflow } = await supabase.from('system_settings').select('*').eq('group_name', 'PRODUCTION_WORKFLOW');
      if (workflow) setAllWorkflowTasks(workflow);
    } catch (e: any) { showToast('Thất bại', e.message, 'error'); }
  };

  const handleStaffSaveDriveLink = async (currentProjectItem: any) => {
    try {
      const newLink = (localDriveInputs[currentProjectItem.key] || '').trim();
      const currentProjectPrefix = currentProjectItem.config_name.split(' - ')[0];

      const { data: siblingPhases } = await supabase.from('system_settings').select('*').eq('group_name', 'PRODUCTION_WORKFLOW').like('config_name', `${currentProjectPrefix}%`);
      if (!siblingPhases || siblingPhases.length === 0) return;

      const updatePromises = siblingPhases.map(async (phase) => {
        let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
        try { currentJSON = JSON.parse(phase.description || '{}'); } catch {}
        currentProjectItem.project_drive_link = newLink;
        return supabase.from('system_settings').update({ description: JSON.stringify(currentJSON) }).eq('key', phase.key);
      });

      await Promise.all(updatePromises);
      showToast('Thành công', 'Đã ghim link Drive tổng cho toàn dự án!', 'success');
      loadTasksData();
    } catch (err: any) { showToast('Lỗi', err.message, 'error'); }
  };

  // Gom nhóm dự án xưởng vĩ mô từ system_settings
  const globalProjectGroupsMap: { [key: string]: any[] } = {};
  allWorkflowTasks.forEach(t => {
    if (!t.config_name) return;
    const pName = t.config_name.split(' - ')[0];
    if (!globalProjectGroupsMap[pName]) globalProjectGroupsMap[pName] = [];
    globalProjectGroupsMap[pName].push(t);
  });

  // Chỉ hiển thị dự án nào Nhân sự này được sếp giao việc
  const uniqueMyProjectNames = Object.keys(globalProjectGroupsMap).filter(pName => {
    return globalProjectGroupsMap[pName].some(phase => (phase.description || '').includes(workerName));
  });

  const totalPages = Math.ceil(uniqueMyProjectNames.length / itemsPerPage) || 1;
  const paginatedProjectNames = uniqueProjectNames.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // 📊 3 BOX ĐỐI SOÁT ĐẦU VIỆC CÁ NHÂN CỦA STAFF
  let totalMyTasksCount = 0;
  let doneMyTasksCount = 0;
  let pendingMyTasksCount = 0;

  allWorkflowTasks.forEach(item => {
    let currentJSON: any = { tasks_list: [] };
    try { currentJSON = JSON.parse(item.description || '{}'); } catch {}
    currentJSON.tasks_list.forEach((t: any) => {
      if (t.assignee === workerName) {
        totalMyTasksCount++;
        if (t.status === 'DONE') doneMyTasksCount++;
        else pendingMyTasksCount++;
      }
    });
  });

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400 text-xs font-mono"><RefreshCcw className="w-4 h-4 animate-spin mr-2 text-purple-500"/> Đang tải ma trận việc ca máy...</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto space-y-4 text-slate-100 bg-slate-950 min-h-screen pb-12 font-sans select-none">
      
      {/* HEADER */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-500" />
          <div>
            <h1 className="text-base font-bold">Trạm Nhận Việc & Nghiệm Thu Tiến Độ</h1>
            <p className="text-[10px] text-slate-500 font-mono">Nhân sự vận hành: {workerName}</p>
          </div>
        </div>
        <button onClick={handleStaffRefresh} className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 p-2 rounded-xl transition flex items-center gap-1 text-[11px] font-bold">
          <RefreshCcw className="w-3.5 h-3.5" /> Làm mới dữ liệu
        </button>
      </div>

      {/* 📊 3 BOX TIẾN ĐỘ CÁ NHÂN */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold tracking-wide">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div><p className="text-slate-400 text-[10px] uppercase">Tổng việc con gán máy của bạn</p><p className="text-xl font-black font-mono text-purple-400 mt-0.5">{totalMyTasksCount} Đầu việc</p></div>
          <div className="p-2.5 rounded-xl bg-purple-950/40 text-purple-400"><ListTodo className="w-4 h-4" /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div><p className="text-slate-400 text-[10px] uppercase">Hạng mục chưa hoàn thành</p><p className="text-xl font-black font-mono text-blue-400 mt-0.5">{pendingMyTasksCount} Ca trực</p></div>
          <div className="p-2.5 rounded-xl bg-blue-950/40 text-blue-400"><Activity className="w-4 h-4" /></div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div><p className="text-slate-400 text-[10px] uppercase">Hạng mục đã xong (✓)</p><p className="text-xl font-black font-mono text-emerald-400 mt-0.5">{doneMyTasksCount} Nghiệm thu</p></div>
          <div className="p-2.5 rounded-xl bg-emerald-950/40 text-emerald-400"><CheckSquare className="w-4 h-4" /></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[65vh] items-start pt-2">
        
        {/* 🧩 BẢNG TRÁI: DANH SÁCH TÊN DỰ ÁN (ĐÃ XÓA SẠCH VÒNG % PHỨC TẠP) */}
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl h-full">
          <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 font-bold uppercase text-[10px] text-slate-400 tracking-wider">Danh mục dự án</div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {paginatedProjectNames.map(pName => {
              const isSelected = selectedProjectName === pName;
              return (
                <div 
                  key={pName} 
                  onClick={() => setSelectedProjectName(pName)} 
                  className={`p-4 cursor-pointer transition flex items-center justify-between ${
                    isSelected ? 'bg-purple-950/10 border-l-4 border-purple-500 font-bold' : 'hover:bg-slate-950/20'
                  }`}
                >
                  <p className="text-slate-200 font-bold text-xs">📦 {pName}</p>
                </div>
              );
            })}
            {uniqueMyProjectNames.length === 0 && <div className="p-8 text-center text-slate-600 font-mono italic text-xs">Hiện tại bạn chưa được gán đầu việc con nào.</div>}
          </div>
          
          <div className="p-2.5 flex justify-between items-center bg-slate-950 border-t border-slate-800 font-mono text-[10px] text-slate-500">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="p-1 disabled:opacity-20 hover:text-white"><ChevronLeft size={16}/></button>
            <span>Trang {currentPage} / {totalPages}</span>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="p-1 disabled:opacity-20 hover:text-white"><ChevronRight size={16}/></button>
          </div>
        </div>

        {/* 🧩 BẢNG PHẢI: PIPELINE CHI TIẾT */}
        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto shadow-xl space-y-4 h-full">
          {selectedProjectName ? (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-purple-400 uppercase tracking-wider border-b border-slate-800 pb-2">🎯 Dự án đang mở: {selectedProjectName}</h3>
              
              {globalProjectGroupsMap[selectedProjectName]?.sort((a, b) => a.key.localeCompare(b.key)).map((phase, pIdx) => {
                let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
                try { currentJSON = JSON.parse(phase.description || '{}'); } catch {}

                const myTasksInPhase = currentJSON.tasks_list
                  .map((t: any, i: number) => ({ ...t, __globalIdx: i }))
                  .filter((t: any) => t.assignee === workerName);

                if (myTasksInPhase.length === 0) return null;

                return (
                  <div key={phase.key} className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-3 shadow-inner">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-300 border-b border-slate-900 pb-1.5">
                      <span>⚡ Bước Phase {pIdx + 1}: {phase.config_name.split(' - ')[1]}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${phase.value === 'DONE' ? 'text-emerald-400 bg-emerald-950/20' : 'text-blue-400 bg-blue-950/20'}`}>{phase.value === 'DONE' ? '✓ HOÀN THÀNH PHASE' : '⚡ ĐANG TRIỂN KHAI'}</span>
                    </div>

                    {pIdx === 0 && (
                      <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl space-y-2">
                        <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><LinkIcon className="w-3 h-3 text-blue-400" /> Thư mục Google Drive dự án tổng:</label>
                        <div className="flex gap-2">
                          <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-blue-400 font-mono focus:outline-none" value={localDriveInputs[phase.key] || ''} onChange={e => setLocalDriveInputs({ ...localDriveInputs, [phase.key]: e.target.value })} placeholder="Dán link Drive tổng bản vẽ màu sắc..." />
                          <button onClick={() => handleStaffSaveDriveLink(phase)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold shrink-0">Lưu</button>
                          {currentJSON.project_drive_link?.trim() && <a href={currentJSON.project_drive_link} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold text-[10px] bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1 rounded-lg shrink-0">Mở</a>}
                        </div>
                        <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 pt-0.5"><Calendar className="w-3 h-3 text-amber-500"/> Ngày hạn hoàn thiện tổng quan: <span className="text-amber-400 font-bold">{phase.param_type || currentJSON.project_deadline || 'Chưa định hạn'}</span></div>
                      </div>
                    )}

                    <div className="space-y-3 pt-1">
                      {myTasksInPhase.map((t: any) => {
                        const targetKey = `${phase.key}_TASK_${t.__globalIdx}`;
                        const taskBuffer = editableTasks[targetKey] || { status: 'TODO', deadline: '', note: '' };

                        return (
                          <div key={t.__globalIdx} className="bg-slate-900 border border-slate-850 p-3 rounded-xl flex flex-col gap-2.5">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-2 border-b border-slate-950 pb-1.5">
                              <div className="space-y-1.5 flex-1">
                                <p className="font-bold text-slate-200 text-xs">⚙️ Hạng mục: {t.name}</p>
                                <div className="flex items-center gap-1 text-amber-400 font-mono">
                                  <Clock className="w-3.5 h-3.5 text-amber-500"/>
                                  <span className="text-[9px] text-slate-500 font-bold">Hạn ca trực:</span>
                                  <input type="datetime-local" className="bg-transparent text-amber-400 text-[10px] font-bold focus:outline-none cursor-pointer border border-slate-800 p-0.5 rounded" value={taskBuffer.deadline} onChange={e => handleBufferChange(phase.key, t.__globalIdx, 'deadline', e.target.value)} />
                                </div>
                              </div>

                              <select value={taskBuffer.status} onChange={e => handleBufferChange(phase.key, t.__globalIdx, 'status', e.target.value)} className="text-[10px] border border-slate-800 rounded-lg p-1.5 font-black bg-slate-950 text-slate-200 text-center cursor-pointer focus:outline-none">
                                <option value="TODO">⏳ CHỜ LÀM</option>
                                <option value="DOING">⚡ ĐANG LÀM</option>
                                <option value="DONE">✓ ĐÃ XONG</option>
                              </select>
                            </div>

                            <div className="w-full space-y-1">
                              <label className="text-[9px] text-slate-500 font-bold block uppercase flex items-center gap-0.5"><MessageSquare className="w-3 h-3 text-purple-400"/>Báo cáo tiến độ / Comment màu sắc sản phẩm:</label>
                              <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 focus:outline-none" value={taskBuffer.note} onChange={e => handleBufferChange(phase.key, t.__globalIdx, 'note', e.target.value)} placeholder="Nhập ghi chú tiến độ ca máy gửi sếp..." />
                            </div>

                            <button type="button" onClick={() => handleSaveSpecificTask(phase, t.__globalIdx)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex justify-center items-center gap-1 shadow transition"><Save size={12}/> Lưu Cập Nhật Ca Việc</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : <div className="text-slate-500 text-center pt-24 italic text-xs">Vui lòng click chọn tên dự án ở bảng bên trái để hiển thị tiến độ việc con.</div>}
        </div>

      </div>

    </div>
  );
}