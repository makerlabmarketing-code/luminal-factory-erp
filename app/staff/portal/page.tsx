// app/staff/portal/page.tsx
'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
// 🔥 ĐÃ VÁ LỖI: Import đầy đủ linh hồn cho toàn bộ hệ thống icon bao gồm cả Power
import { User, ClipboardList, Clock, Banknote, Power, Save, ChevronLeft, ChevronRight, Image as ImageIcon, Briefcase, RefreshCcw, Calendar, Link as LinkIcon, MessageSquare } from 'lucide-react';

function StaffPortalContent() {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [worker, setWorker] = useState<any>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('attendance'); // Mặc định vào Tab Ca Làm Việc

  // --- STATE TAB 2: NHẬN VIỆC (DỰ ÁN MA TRẬN JSON TỪ SYSTEM_SETTINGS) ---
  const [rawWorkflowTasks, setRawWorkflowTasks] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [localDriveInputs, setLocalDriveInputs] = useState<{ [key: string]: string }>({});
  const [editableTasks, setEditableTasks] = useState<{ [key: string]: any }>({});

  // --- STATE TAB 3: BÁO CHI TIÊU ---
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expCategory, setExpCategory] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expBillUrl, setExpBillUrl] = useState('');
  const [expenseSearch, setExpenseSearch] = useState('');

  // --- STATE TAB 4: HỒ SƠ CÁ NHÂN ---
  const [profilePhone, setProfilePhone] = useState('');
  const [profileBankName, setProfileBankName] = useState('');
  const [profileBankAcc, setProfileBankAcc] = useState('');

  // --- STATE CHẤM CÔNG GPS ---
  const [isInShift, setIsInShift] = useState(false);
  const [liveTime, setLiveTime] = useState(new Date());
  const [selectedShift, setSelectedShift] = useState('Ca Sáng');
  const [selectedBranchCode, setSelectedBranchCode] = useState<string>('');

  // Đồng hồ hệ thống chạy realtime
  useEffect(() => {
    const timer = setInterval(() => setLiveTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự động nhận diện gợi ý khung ca kíp trực máy ngầm
  useEffect(() => {
    const hour = liveTime.getHours();
    if (hour >= 6 && hour < 12) setSelectedShift('Ca Sáng');
    else if (hour >= 12 && hour < 18) setSelectedShift('Ca Chiều');
    else setSelectedShift('Ca Tối');
  }, [liveTime]);

  const loadPortalData = async () => {
    if (!token) { setLoading(false); return; }
    try {
      // 1. Đọc rào chắn tọa độ định vị GPS cơ sở
      const { data: metaBranch } = await supabase.from('system_metadata').select('data').eq('name', 'Danh sách Chi nhánh').maybeSingle();
      const branchData = metaBranch?.data || [];
      setBranches(branchData);
      if (branchData.length > 0 && !selectedBranchCode) setSelectedBranchCode(branchData[0].code);

      // 2. Định danh nhân sự hỏa tốc qua Token URL
      const { data: emp } = await supabase.from('employees').select('*').eq('qr_token', token).maybeSingle();
      if (!emp) { setLoading(false); return; }
      setWorker(emp);
      setProfilePhone(emp.phone || ''); 
      setProfileBankName(emp.bank_name || ''); 
      setProfileBankAcc(emp.bank_account_number || '');

      // 3. Quét trạng thái ca kíp ngày hôm nay
      const todayStr = new Date().toLocaleDateString('en-CA');
      const { data: checkShift } = await supabase.from('attendance').select('*').eq('employee_id', emp.id).eq('work_date', todayStr).maybeSingle();
      setIsInShift(!!(checkShift && checkShift.check_in && !checkShift.check_out));

      // 4. Tải dữ liệu quy trình xưởng đích thực từ system_settings
      const { data: workflow } = await supabase.from('system_settings').select('*').eq('group_name', 'PRODUCTION_WORKFLOW');
      const filteredWorkflow = (workflow || []).filter(item => (item.description || '').includes(emp.full_name));
      setRawWorkflowTasks(filteredWorkflow);

      // Map dữ liệu đệm và link Drive tổng từ trường JSON description
      const driveMap: { [key: string]: string } = {};
      const editMap: { [key: string]: any } = {};

      filteredWorkflow.forEach(item => {
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

      // Tự động ghim chọn dự án đầu tiên hiển thị lên Split-Screen
      if (filteredWorkflow.length > 0 && !selectedProjectName) {
        const firstProjName = filteredWorkflow[0].config_name.split(' - ')[0];
        setSelectedProjectName(firstProjName);
      }

      // 5. Tải sổ đối soát chi tiêu cá nhân
      const { data: exps } = await supabase.from('financial_ledger').select('*').eq('requested_by', emp.full_name).order('id', { ascending: false });
      setExpenses(exps || []);

    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadPortalData(); }, [token]);

  // Thuật toán đo bán kính GPS Geofencing trực ca
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3; 
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const handleToggleShiftWithGPS = () => {
    if (!navigator.geolocation) return showToast('Lỗi thiết bị', 'Thiết bị không hỗ trợ GPS!', 'error');
    const assignedBranch = branches.find(b => b.code === selectedBranchCode) || branches[0];
    if (!assignedBranch) return showToast('Lỗi', 'Vui lòng chọn cơ sở trực ca!', 'error');

    navigator.geolocation.getCurrentPosition(async (position) => {
      const uLat = position.coords.latitude;
      const uLng = position.coords.longitude;
      const distance = calculateDistance(uLat, uLng, assignedBranch.lat, assignedBranch.lng);

      if (distance > assignedBranch.radius) {
        return showToast('Từ Chối Chấm Công', `Lỗi vị trí! Bạn đang đứng cách cơ sở ${Math.round(distance)} mét (Yêu cầu < ${assignedBranch.radius}m).`, 'error');
      }

      const todayStr = new Date().toLocaleDateString('en-CA');
      const timeNowStr = new Date().toLocaleTimeString('vi-VN', { hour12: false });
      const nextState = !isInShift;

      try {
        if (nextState) {
          await supabase.from('attendance').insert([{ employee_id: worker.id, employee_name: worker.full_name, work_date: todayStr, check_in: timeNowStr, shift_name: selectedShift, status: 'PRESENT' }]);
          showToast('Check-in thành công', `Hệ thống ghi nhận vào ca trực lúc ${timeNowStr}.`, 'success');
        } else {
          await supabase.from('attendance').update({ check_out: timeNowStr }).eq('employee_id', worker.id).eq('work_date', todayStr);
          showToast('Check-out thành công', `Ghi nhận tan ca lúc ${timeNowStr}.`, 'success');
        }
        setIsInShift(nextState); loadPortalData();
      } catch (err: any) { showToast('Lỗi kết nối', err.message, 'error'); }
    }, () => { showToast('Lỗi GPS', 'Vui lòng mở quyền truy cập vị trí trên điện thoại!', 'error'); });
  };

  // Cập nhật hạng mục công việc con
  const handleBufferChange = (itemKey: string, taskIdx: number, field: string, value: string) => {
    const targetKey = `${itemKey}_TASK_${taskIdx}`;
    setEditableTasks(prev => ({ ...prev, [targetKey]: { ...prev[targetKey], [field]: value } }));
  };

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

      const { error } = await supabase.from('system_settings').update({ description: JSON.stringify(currentJSON) }).eq('key', item.key);
      if (error) throw error;
      
      showToast('Đồng bộ thành công', '✓ Tiến độ việc con đã truyền realtime lên Admin sếp!', 'success');
      loadPortalData();
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
        currentJSON.project_drive_link = newLink;
        return supabase.from('system_settings').update({ description: JSON.stringify(currentJSON) }).eq('key', phase.key);
      });

      await Promise.all(updatePromises);
      showToast('Thành công', 'Đã cập nhật link Drive tổng!', 'success');
      loadPortalData();
    } catch (err: any) { showToast('Lỗi', err.message, 'error'); }
  };

  const submitExpense = async () => {
    if (!expCategory.trim() || !expAmount) return showToast('Thiếu thông tin', 'Vui lòng điền đủ tên vật tư và số tiền!', 'error');
    const currentPeriod = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`.split('-').reverse().join('/');

    await supabase.from('financial_ledger').insert([{
      type: 'CHI_TIEU', category: expCategory.trim(), amount: Number(expAmount), bill_url: expBillUrl.trim(), requested_by: worker.full_name, is_paid: false, month_period: currentPeriod
    }]);

    setExpCategory(''); setExpAmount(''); setExpBillUrl(''); loadPortalData(); 
    showToast('Thành công', 'Phiếu chi tiêu hoàn ứng đã được gieo hỏa tốc lên Admin!', 'success');
  };

  const handleSaveProfile = async () => {
    await supabase.from('employees').update({ phone: profilePhone.trim(), bank_name: profileBankName.trim(), bank_account_number: profileBankAcc.trim() }).eq('id', worker.id);
    showToast('Thành công', 'Hồ sơ tài khoản nhận lương thụ hưởng đã lưu cấu hình!', 'success');
    loadPortalData();
  };

  // Trích xuất gom nhóm tên dự án từ system_settings
  const projectGroupsMap: { [key: string]: any[] } = {};
  rawWorkflowTasks.forEach(t => {
    if (!t.config_name) return;
    const pName = t.config_name.split(' - ')[0];
    if (!projectGroupsMap[pName]) projectGroupsMap[pName] = [];
    projectGroupsMap[pName].push(t);
  });

  const uniqueProjectNames = Object.keys(projectGroupsMap);
  const totalPages = Math.ceil(uniqueProjectNames.length / itemsPerPage) || 1;
  const paginatedProjectNames = uniqueProjectNames.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  const filteredExpenses = expenses.filter(e => (e.category || '').toLowerCase().includes(expenseSearch.toLowerCase()));

  if (loading) return <div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-400 text-xs font-mono"><RefreshCcw className="w-4 h-4 animate-spin mr-2 text-purple-500"/> Đang dựng cấu trúc trạm đồng bộ...</div>;

  return (
    <div className="p-4 max-w-6xl mx-auto space-y-5 text-slate-100 bg-slate-950 min-h-screen pb-24 font-sans select-none">
      
      {/* THẺ ĐỊNH DANH */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-600/10 border border-purple-500/20 text-purple-400 rounded-xl"><User className="w-4 h-4" /></div>
          <div>
            <h2 className="text-xs font-black text-slate-100">{worker?.full_name}</h2>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">{worker?.title || 'Kỹ thuật viên'} • Cấp {worker?.level || 'M1'}</p>
          </div>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-[9px] font-black tracking-wider border uppercase ${isInShift ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse' : 'bg-slate-950 border-slate-800 text-slate-500'}`}>{isInShift ? '⚡ Trong Ca' : '💤 Ngoài Ca'}</span>
      </div>

      {/* --- TAB 1: CA LÀM VIỆC GPS --- */}
      {activeTab === 'attendance' && (
        <div className="flex flex-col items-center justify-center p-10 bg-slate-900 border border-slate-800 rounded-3xl space-y-5 shadow-xl max-w-md mx-auto mt-6 animate-fadeIn">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black font-mono text-slate-100">{liveTime.toLocaleTimeString('vi-VN')}</h2>
            <p className="text-[10px] text-slate-400 font-mono uppercase">{liveTime.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>

          <div className="w-full text-left space-y-1">
            <label className="text-[10px] text-slate-400 font-bold block">Địa điểm cơ sở trực ban:</label>
            <select className="w-full bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-sans text-xs text-slate-200 font-semibold focus:outline-none cursor-pointer" value={selectedBranchCode} onChange={e => setSelectedBranchCode(e.target.value)}>
              {branches.map(b => <option key={b.code} value={b.code}>🏛️ {b.name}</option>)}
            </select>
          </div>

          {/* 🔥 ICONT POWER ĐÃ ĐƯỢC GIẢI PHÓNG VÀ HOẠT ĐỘNG CHUẨN XÁC */}
          <button onClick={handleToggleShiftWithGPS} className={`w-36 h-36 rounded-full border-4 font-black text-xs tracking-wider uppercase transition-all duration-300 transform hover:scale-105 shadow-2xl flex flex-col items-center justify-center gap-1.5 active:scale-95 cursor-pointer ${isInShift ? 'bg-red-950/40 border-red-500 text-red-400' : 'bg-emerald-950/40 border-emerald-500 text-emerald-400'}`}>
            <Power className="w-7 h-7" />
            <span>{isInShift ? 'TAN CA VỀ' : 'VÀO CA MÁY'}</span>
          </button>
          <span className="text-[9px] text-purple-400 font-mono text-center bg-slate-950 p-2 rounded-lg border border-slate-850 w-full">Hệ thống nhận ca thông minh: {selectedShift}</span>
        </div>
      )}

      {/* --- TAB 2: NHẬN VIỆC (MÔ HÌNH CHIA ĐÔI MÀN HÌNH ĐÃ GẮN KẾT NỐI CHUẨN REALTIME 100%) --- */}
      {activeTab === 'tasks' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[65vh] animate-fadeIn">
          {/* BẢNG TRÁI: DANH SÁCH TÊN DỰ ÁN */}
          <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl">
            <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 font-bold uppercase text-[10px] text-slate-400 tracking-wider">Danh mục dự án</div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
              {paginatedProjectNames.map(pName => {
                const phases = projectGroupsMap[pName].sort((a, b) => a.key.localeCompare(b.key));
                const totalPhases = phases.length;
                const donePhases = phases.filter(ph => ph.value === 'DONE').length;
                const pct = Math.round((donePhases / totalPhases) * 100) || 0;
                const isSelected = selectedProjectName === pName;

                return (
                  <div key={pName} onClick={() => setSelectedProjectName(pName)} className={`p-4 cursor-pointer transition ${isSelected ? 'bg-purple-950/10 border-l-4 border-purple-500 font-bold' : 'hover:bg-slate-950/20'}`}>
                    <p className="text-slate-200 font-bold text-xs">📦 {pName}</p>
                    <div className="flex items-center gap-2 pt-1.5">
                      <div className="w-full bg-slate-950 rounded-full h-1 border border-slate-850 overflow-hidden">
                        <div className="bg-gradient-to-r from-purple-500 to-blue-500 h-1 rounded-full" style={{ width: `${pct}%` }}></div>
                      </div>
                      <span className="text-[9px] font-mono text-slate-500 font-black">{pct}%</span>
                    </div>
                  </div>
                );
              })}
              {uniqueProjectNames.length === 0 && <div className="p-8 text-center text-slate-600 font-mono italic text-xs">Hiện tại sếp chưa có dự án xưởng nào được gán việc.</div>}
            </div>
            {/* Phân trang cột trái */}
            <div className="p-2 flex justify-between items-center bg-slate-950 border-t border-slate-800 font-mono text-[10px] text-slate-500">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(c => c - 1)} className="p-1 disabled:opacity-20 hover:text-white"><ChevronLeft size={16}/></button>
              <span>Trang {currentPage} / {totalPages}</span>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(c => c + 1)} className="p-1 disabled:opacity-20 hover:text-white"><ChevronRight size={16}/></button>
            </div>
          </div>

          {/* BẢNG PHẢI: PIPELINE GIAI ĐOẠN CHI TIẾT CỦA Nhân sự */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto shadow-xl space-y-4">
            {selectedProjectName ? (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-purple-400 uppercase tracking-wider border-b border-slate-800 pb-2">🎯 Dự án: {selectedProjectName}</h3>
                
                {projectGroupsMap[selectedProjectName]?.sort((a, b) => a.key.localeCompare(b.key)).map((phase, pIdx) => {
                  let currentJSON: any = { project_drive_link: '', project_deadline: '', tasks_list: [] };
                  try { currentJSON = JSON.parse(phase.description || '{}'); } catch {}

                  const myTasksInPhase = currentJSON.tasks_list
                    .map((t: any, i: number) => ({ ...t, __globalIdx: i }))
                    .filter((t: any) => t.assignee === worker?.full_name);

                  if (myTasksInPhase.length === 0) return null;

                  return (
                    <div key={phase.key} className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-3 shadow-inner">
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300 border-b border-slate-900 pb-1.5">
                        <span>⚡ Bước Phase {pIdx + 1}: {phase.config_name.split(' - ')[1]}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-black ${phase.value === 'DONE' ? 'text-emerald-400 bg-emerald-950/20' : 'text-blue-400 bg-blue-950/20'}`}>{phase.value === 'DONE' ? '✓ HOÀN THÀNH' : '⚡ ĐANG CHẠY'}</span>
                      </div>

                      {/* KHU VỰC THƯ MỤC DRIVE DỰ ÁN TỔNG */}
                      {pIdx === 0 && (
                        <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl space-y-2">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1"><LinkIcon className="w-3 h-3 text-blue-400" /> Thư mục Google Drive dự án tổng (Bản vẽ phối cảnh màu sắc):</label>
                          <div className="flex gap-2">
                            <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-blue-400 font-mono focus:outline-none" value={localDriveInputs[phase.key] || ''} onChange={e => setLocalDriveInputs({ ...localDriveInputs, [phase.key]: e.target.value })} placeholder="Dán link Drive thư mục tổng hợp phôi sản phẩm..." />
                            <button onClick={() => handleStaffSaveDriveLink(phase)} className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold shrink-0 shadow-md">Lưu</button>
                            {currentJSON.project_drive_link?.trim() && <a href={currentJSON.project_drive_link} target="_blank" rel="noreferrer" className="text-emerald-400 font-bold text-[10px] bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1 rounded-lg shrink-0">Mở</a>}
                          </div>
                          <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 pt-0.5"><Calendar className="w-3 h-3 text-amber-500"/> Ngày hạn hoàn thiện tổng quan: <span className="text-amber-400 font-bold">{phase.param_type || currentJSON.project_deadline || 'Chưa định hạn'}</span></div>
                        </div>
                      )}

                      {/* CHI TIẾT CÁC VIỆC CON */}
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
            ) : <div className="text-slate-500 text-center pt-24 italic text-xs">Vui lòng click chọn tên dự án ở bảng bên trái để hiển thị Pipeline việc con của mình.</div>}
          </div>
        </div>
      )}

      {/* --- TAB 3: BÁO CHI TIÊU KÊ KHAI VẬT TƯ --- */}
      {activeTab === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs shadow-xl">
            <span className="text-[10px] font-black uppercase text-slate-400 block border-b border-slate-800 pb-2">Tạo phiếu mua đồ vật tư</span>
            <div><label className="text-slate-400">Tên đồ vật tư:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-slate-200" value={expCategory} onChange={(e) => setExpCategory(e.target.value)} /></div>
            <div><label className="text-slate-400">Giá tiền thực chi (VND):</label><input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 font-mono text-amber-400 font-bold" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} /></div>
            <div><label className="text-slate-400">Link ảnh hóa đơn bill (Zalo/Drive):</label><input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 mt-1 focus:outline-none text-blue-400 font-mono" value={expBillUrl} onChange={(e) => setExpBillUrl(e.target.value)} /></div>
            <button onClick={submitExpense} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold p-3 rounded-xl flex justify-center gap-1.5 transition shadow"><Save className="w-4 h-4" /> Nộp Phiếu Về Máy Sếp</button>
          </div>

          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center gap-3">
              <span className="text-[10px] font-bold uppercase text-slate-400">Sổ Đối Soát Chi Tiêu Tiền Mặt Của Tôi</span>
              <input type="text" placeholder="Tìm tên vật tư..." className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[11px] text-slate-200 focus:outline-none max-w-[150px]" value={expenseSearch} onChange={e => setExpenseSearch(e.target.value)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-slate-400 uppercase text-[9px] border-b border-slate-800">
                  <tr><th className="p-3">Nội dung vật tư mua</th><th className="p-3">Số tiền chi</th><th className="p-3 text-center">Trạng thái quỹ</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
                  {filteredExpenses.map(e => (
                    <tr key={e.id} className="hover:bg-slate-950/10">
                      <td className="p-3 font-bold text-slate-200">
                        {e.category} 
                        {e.bill_url && <a href={e.bill_url} target="_blank" rel="noreferrer" className="text-blue-400 flex items-center gap-1 mt-1 text-[9px] hover:underline font-mono"><ImageIcon className="w-3 h-3"/> Mở Xem Bill</a>}
                      </td>
                      <td className="p-3 font-mono text-red-400">{Number(e.amount).toLocaleString()} đ</td>
                      <td className="p-3 text-center"><span className={`px-2 py-0.5 rounded font-black text-[9px] border ${e.is_paid ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}`}>{e.is_paid ? 'ĐÃ TRẢ' : 'TREO NỢ'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- TAB 4: HỒ SƠ CÁ NHÂN NHẬN LƯƠNG --- */}
      {activeTab === 'profile' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl max-w-2xl mx-auto space-y-5 text-xs animate-fadeIn">
          <div className="flex items-center gap-2 border-b border-slate-800 pb-3"><Briefcase className="w-4 h-4 text-blue-400" /><h2 className="font-bold text-slate-200 uppercase tracking-wider text-[12px]">Hồ Sơ Thành Viên Số Hóa</h2></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="text-slate-500 block mb-1">Số điện thoại liên hệ:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:outline-none text-slate-200" value={profilePhone} onChange={e => setProfilePhone(e.target.value)} /></div>
            <div><label className="text-slate-500 block mb-1">Tên Ngân hàng thụ hưởng:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:outline-none text-slate-200" value={profileBankName} onChange={e => setProfileBankName(e.target.value)} /></div>
            <div className="sm:col-span-2"><label className="text-slate-500 block mb-1">Số tài khoản nhận tiền lương quỹ:</label><input type="text" className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl focus:outline-none text-amber-400 font-bold font-mono" value={profileBankAcc} onChange={e => setProfileBankAcc(e.target.value)} /></div>
          </div>
          <button onClick={handleSaveProfile} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black p-3 rounded-xl transition shadow-lg">Lưu cấu hình thông tin cá nhân</button>
          
          <div className="pt-4 border-t border-slate-800 mt-3">
            <label className="text-slate-500 block mb-2 font-bold uppercase text-[9px] tracking-wider font-mono">Bản sao hợp đồng lao động điện tử scan PDF:</label>
            {worker?.drive_contract ? (
              <a href={worker.drive_contract} target="_blank" rel="noreferrer" className="block w-full bg-slate-950 border border-slate-700 hover:border-blue-500 text-blue-400 font-bold p-3 rounded-xl text-center transition hover:bg-slate-900 font-mono">📥 MỞ XEM BẢN SCAN HỢP ĐỒNG LAO ĐỘNG</a>
            ) : (
              <div className="w-full bg-slate-950/40 border border-slate-800 border-dashed p-3 rounded-xl text-slate-600 text-center italic font-mono">Ban quản lý chưa đăng tải bản scan hợp đồng của bạn lên.</div>
            )}
          </div>
        </div>
      )}

      {/* FOOTER BOTTOM TABS MENU LUÔN ĐƯỢC GHIM CỐ ĐỊNH Ở ĐÁY MÀN HÌNH CHỐNG MẤT MENU */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900/95 backdrop-blur-md border-t border-slate-800 px-2 py-3.5 z-50 flex justify-around items-center shadow-2xl text-[10px] font-bold">
        <button onClick={() => setActiveTab('attendance')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none ${activeTab === 'attendance' ? 'text-blue-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-300'}`}>
          <Clock className="w-4 h-4" />
          <span>Ca Làm Việc</span>
        </button>
        <button onClick={() => setActiveTab('tasks')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none ${activeTab === 'tasks' ? 'text-blue-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-300'}`}>
          <ClipboardList className="w-4 h-4" />
          <span>Nhận Việc</span>
        </button>
        <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none ${activeTab === 'expenses' ? 'text-blue-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-300'}`}>
          <Banknote className="w-4 h-4" />
          <span>Báo Chi Tiêu</span>
        </button>
        <button onClick={() => setActiveTab('profile')} className={`flex flex-col items-center gap-1 transition-all duration-200 focus:outline-none ${activeTab === 'profile' ? 'text-blue-400 scale-105 font-black' : 'text-slate-500 hover:text-slate-300'}`}>
          <User className="w-4 h-4" />
          <span>Cá Nhân</span>
        </button>
      </div>

    </div>
  );
}

export default function WorkerPortal() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex justify-center items-center text-slate-500 text-xs font-mono">Đang đồng bộ cổng Portal nguyên khối...</div>}>
      <StaffPortalContent />
    </Suspense>
  );
}