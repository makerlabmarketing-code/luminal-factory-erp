// app/admin/projects/page.tsx
'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { useNotification } from '@/component/NotificationContext';
import { Layers, Plus, Trash2, CheckCircle2, Circle, X, User, RefreshCcw, Search, ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminProjectManagement() {
  const { showToast, showConfirm } = useNotification();
  const [projects, setProjects] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Điều khiển hiển thị danh sách & Popup
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewDetailId, setViewDetailId] = useState<number | null>(null);

  // States Dynamic Form lồng nhau khi tạo mới sản xuất
  const [projectName, setProjectName] = useState('');
  const [phases, setPhases] = useState<any[]>([{ name: 'Giai đoạn 1', tasks: [{ name: '', assignee: '' }] }]);

  // Phân trang bảng danh sách dự án phía trái màn hình
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: projs } = await supabase.from('projects').select('*, phases(*, tasks(*))').order('id', { ascending: false });
      const { data: emps } = await supabase.from('employees').select('full_name');
      
      if (projs) projs.forEach(p => p.phases.sort((a: any, b: any) => a.order_index - b.order_index));
      setProjects(projs || []);
      setEmployees(emps || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // XỬ LÝ FORM DỮ LIỆU ĐỆ QUY DỰ ÁN -> PHASE -> TASK CON
  const addPhase = () => setPhases([...phases, { name: `Giai đoạn ${phases.length + 1}`, tasks: [{ name: '', assignee: '' }] }]);
  const addTask = (pIdx: number) => {
    const newPhases = [...phases]; newPhases[pIdx].tasks.push({ name: '', assignee: '' }); setPhases(newPhases);
  };

  const handleCreateProject = async () => {
    if (!projectName.trim()) return showToast('Thiếu dữ liệu', 'Sếp vui lòng nhập tên dự án tổng hàng hóa!', 'error');
    
    try {
      const { data: newProj, error: pErr } = await supabase.from('projects').insert([{ name: projectName.trim() }]).select().single();
      if (pErr || !newProj) throw new Error('Không lưu được tên dự án tổng lên Cloud database!');

      for (let i = 0; i < phases.length; i++) {
        const { data: newPhase } = await supabase.from('phases').insert([{ project_id: newProj.id, name: phases[i].name, order_index: i }]).select().single();
        if (newPhase) {
          const tasksToInsert = phases[i].tasks.filter((t: any) => t.name.trim()).map((t: any) => ({
            phase_id: newPhase.id, name: t.name.trim(), assignee: t.assignee, status: 'TODO' // Mặc định trạng thái là chờ
          }));
          if (tasksToInsert.length > 0) await supabase.from('tasks').insert(tasksToInsert);
        }
      }
      setShowAddModal(false); setProjectName(''); setPhases([{ name: 'Giai đoạn 1', tasks: [{ name: '', assignee: '' }] }]);
      loadData();
      showToast('Thành công', '✨ Đã kích hoạt chuỗi dự án và phân việc thành công sang máy Nhân sự!', 'success');
    } catch (err: any) { showToast('Lỗi DB', err.message, 'error'); }
  };

  const handleDeleteProject = (id: number) => {
    showConfirm('Xác nhận xóa dự án', 'Sếp có chắc chắn muốn hủy bỏ vĩnh viễn dây chuyền dự án này không?', async () => {
      await supabase.from('projects').delete().eq('id', id);
      if (viewDetailId === id) setViewDetailId(null);
      loadData();
      showToast('Đã xóa', 'Hồ sơ dự án đã được gỡ bỏ.', 'info');
    });
  };

  // 🔥 THUẬT TOÁN ĐIỀU PHỐI ĐỘNG DROP-DOWN BOX THEO LỆNH SẾP
  const getPhaseStatus = (phase: any, allPhases: any[]) => {
    const hasTasks = phase.tasks && phase.tasks.length > 0;
    const isAllTasksDone = hasTasks && phase.tasks.every((t: any) => t.status === 'DONE');
    
    if (isAllTasksDone) return 'COMPLETED'; // Xong hết -> Màu xanh lục, tự động thu gọn

    // Tìm giai đoạn đầu tiên có việc chưa xong -> Đặt làm Active (Màu ghi, mở bung ra)
    const firstUnfinishedPhase = allPhases.find(p => !p.tasks || p.tasks.length === 0 || p.tasks.some((t: any) => t.status !== 'DONE'));
    if (phase.id === firstUnfinishedPhase?.id) return 'ACTIVE';
    
    return 'PENDING'; // Các giai đoạn sau -> Ẩn màu xám chưa bắt đầu
  };

  const filteredProjects = projects.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage) || 1;
  const currentProjectData = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  if (loading) return <div className="p-6 text-center text-xs font-mono text-slate-500 bg-slate-950 min-h-screen flex items-center justify-center gap-2"><RefreshCcw className="w-4 h-4 animate-spin" />Đang đồng bộ ma trận dây chuyền...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 text-slate-100 bg-slate-950 min-h-screen font-sans">
      
      {/* HEADER CHỨC NĂNG CÓ NÚT THÊM MỚI DỰ ÁN THEO YÊU CẦU */}
      <div className="flex justify-between items-center border-b border-slate-800 pb-4">
        <h1 className="text-base font-bold flex items-center gap-2"><Layers className="w-5 h-5 text-blue-500" /> Ma Trận Quy Trình Sản Xuất & Điều Phối Dự Án</h1>
        {/* NÚT THÊM MỚI DỰ ÁN CHUẨN ĐÉT TRÊN HEADER */}
        <button 
          onClick={() => setShowAddModal(true)} 
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition shadow-lg"
        >
          <Plus className="w-4 h-4" /> Thêm Mới Dự Án
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* CỘT TRÁI: TABLE HIỂN THỊ PHAN TRANG DANH SÁCH DỰ ÁN */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between">
          <div className="px-4 py-3 border-b border-slate-800 bg-slate-950/40 flex justify-between items-center gap-2">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Danh Sách Lệnh Dây Chuyền</span>
            <input type="text" placeholder="Lọc dự án..." className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[10px] w-36 text-slate-200 focus:outline-none" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} />
          </div>
          
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-slate-400 uppercase text-[9px]">
              <tr><th className="p-4">Tên Sản Phẩm / Dự Án</th><th className="p-4 text-center w-16">Gỡ</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium text-[11px]">
              {currentProjectData.map(p => (
                <tr key={p.id} onClick={() => setViewDetailId(p.id)} className={`cursor-pointer transition ${viewDetailId === p.id ? 'bg-blue-950/30 border-l-4 border-blue-500 font-bold text-blue-400' : 'hover:bg-slate-950/10'}`}>
                  <td className="p-4">{p.name}</td>
                  <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}><button onClick={() => handleDeleteProject(p.id)} className="text-slate-500 hover:text-red-400 transition"><Trash2 className="w-4 h-4"/></button></td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="p-2.5 bg-slate-950/40 border-t border-slate-800 flex justify-end gap-1">
              <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} className="p-1 bg-slate-900 border rounded disabled:opacity-20"><ChevronLeft className="w-3.5 h-3.5"/></button>
              <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} className="p-1 bg-slate-900 border rounded disabled:opacity-20"><ChevronRight className="w-3.5 h-3.5"/></button>
            </div>
          )}
        </div>

        {/* CỘT PHẢI: XEM CHI TIẾT DROPDOWN BOX PHASE ĐỘNG THEO LỆNH CỦA SẾP */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl min-h-[50vh]">
          {!viewDetailId ? (
            <div className="h-full flex items-center justify-center text-slate-500 text-xs italic py-16 font-mono text-center">Sếp click chọn một hàng dự án ở bảng bên trái để bung sơ đồ quản lý chi tiết.</div>
          ) : (
            <div className="space-y-4">
              <h2 className="text-sm font-black text-blue-400 uppercase tracking-wider border-b border-slate-800 pb-3">Sơ Đồ Chuỗi: {projects.find(p => p.id === viewDetailId)?.name}</h2>
              <div className="space-y-3">
                {projects.find(p => p.id === viewDetailId)?.phases.map((phase: any, index: number, allPhases: any[]) => {
                  const status = getPhaseStatus(phase, allPhases);
                  
                  return (
                    <details key={phase.id} className="group bg-slate-950 border border-slate-800 rounded-xl overflow-hidden shadow-inner" open={status === 'ACTIVE'}>
                      <summary className={`px-4 py-3 cursor-pointer flex justify-between items-center text-xs font-bold transition select-none ${status === 'COMPLETED' ? 'bg-emerald-950/20 text-emerald-400' : status === 'ACTIVE' ? 'bg-slate-800/50 text-slate-100 border-b border-slate-800' : 'text-slate-600 bg-slate-900/20 opacity-30 pointer-events-none'}`}>
                        <div className="flex items-center gap-2">
                          {status === 'COMPLETED' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Circle className="w-4 h-4" />}
                          Giai đoạn {index + 1}: {phase.name}
                        </div>
                        <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded border border-current">{status === 'COMPLETED' ? 'Hoàn thành (Gập)' : status === 'ACTIVE' ? 'Đang triển khai' : 'Khóa'}</span>
                      </summary>
                      
                      <div className="p-4 bg-slate-950 space-y-2.5">
                        {phase.tasks && phase.tasks.map((task: any) => (
                          <div key={task.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl flex flex-col sm:flex-row justify-between gap-3 text-[11px]">
                            <div className="space-y-1 w-full">
                              <p className={`font-bold ${task.status === 'DONE' ? 'line-through text-slate-500' : 'text-slate-200'}`}>• {task.name}</p>
                              <div className="flex items-center gap-4 text-slate-500 font-mono text-[10px]">
                                <span className="text-slate-400">👤 Nhân sự: {task.assignee || 'Chưa gán'}</span>
                                {task.deadline && <span className="text-amber-500 font-bold">⏱️ Estimate: {task.deadline}</span>}
                              </div>
                              {task.note && <div className="p-2 mt-1 bg-slate-950 border border-slate-850 text-slate-400 italic rounded text-[10px] truncate">Link/Ghi chú: {task.note}</div>}
                            </div>
                            <span className={`px-2 py-1 rounded font-black tracking-wide text-[9px] h-fit block text-center w-24 ${task.status === 'DONE' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : task.status === 'DOING' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' : 'bg-slate-950 text-slate-500 border border-slate-800'}`}>
                              {task.status === 'DONE' ? '✓ HOÀN THÀNH' : task.status === 'DOING' ? '⚡ ĐANG LÀM' : '⏳ CHỜ LÀM'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </details>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* MODAL THÊM MỚI DỰ ÁN ĐỆ QUY CHUẨN SẾP CHỈ ĐẠO */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-2xl space-y-4 text-xs text-slate-200 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="font-bold text-blue-500 uppercase tracking-wider text-[11px]">Khởi tạo cấu trúc dự án mới</h3>
              <button onClick={() => setShowAddModal(false)}><X className="w-5 h-5 text-slate-500 hover:text-white" /></button>
            </div>
            
            <input type="text" placeholder="Nhập tên sản phẩm đơn hàng lớn..." className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-sm font-bold text-blue-400 focus:outline-none" value={projectName} onChange={(e) => setProjectName(e.target.value)} />

            <div className="space-y-4">
              {phases.map((p, pIdx) => (
                <div key={pIdx} className="bg-slate-950/40 p-4 border border-slate-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-slate-500">Giai đoạn {pIdx + 1}:</span>
                    <input type="text" className="bg-slate-950 border border-slate-800 p-2 rounded-lg font-bold text-slate-200 w-1/2 focus:outline-none" placeholder="Tên Phase sản xuất..." value={p.name} onChange={(e) => { const n = [...phases]; n[pIdx].name = e.target.value; setPhases(n); }} />
                  </div>
                  
                  <div className="pl-4 border-l-2 border-slate-800 space-y-2">
                    {p.tasks.map((t: any, tIdx: number) => (
                      <div key={tIdx} className="flex flex-col sm:flex-row gap-2">
                        <input type="text" className="flex-1 bg-slate-950 border border-slate-800 p-2 rounded-lg text-slate-200 focus:outline-none" placeholder="Nội dung công việc con (Deadline bỏ trống Nhân sự tự điền)..." value={t.name} onChange={(e) => { const n = [...phases]; n[pIdx].tasks[tIdx].name = e.target.value; setPhases(n); }} />
                        <select className="w-full sm:w-48 bg-slate-950 border border-slate-800 p-2 rounded-lg text-slate-400 focus:outline-none cursor-pointer" value={t.assignee} onChange={(e) => { const n = [...phases]; n[pIdx].tasks[tIdx].assignee = e.target.value; setPhases(n); }}><option value="">Gán người phụ trách...</option>{employees.map(e => <option key={e.id} value={e.full_name}>{e.full_name}</option>)}</select>
                      </div>
                    ))}
                    <button onClick={() => addTask(pIdx)} className="text-[10px] text-blue-400 font-bold hover:text-blue-300 flex items-center gap-1">+ Bổ sung công việc con</button>
                  </div>
                </div>
              ))}
              <button onClick={addPhase} className="w-full border border-dashed border-slate-700 text-slate-500 hover:text-slate-300 p-3 rounded-xl font-bold transition flex justify-center items-center gap-1">+ Thêm Giai đoạn nhỏ mới</button>
            </div>

            <div className="pt-3 border-t border-slate-800 flex gap-2 font-sans">
              <button onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-3 rounded-xl font-bold text-slate-400 hover:bg-slate-850">Hủy</button>
              <button onClick={handleCreateProject} className="flex-1 bg-blue-600 text-white font-bold p-3 rounded-xl hover:bg-blue-700 shadow-lg">Khởi Tạo Quy Trình</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}