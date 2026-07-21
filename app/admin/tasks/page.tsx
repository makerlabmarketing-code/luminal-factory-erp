// app/admin/tasks/page.tsx
'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useNotification } from '@/component/NotificationContext';
import type {
  WorkflowDescription,
  WorkflowSetting,
  WorkflowTask,
} from '@/lib/types/workflow';
import { ClipboardList, Plus, Trash2, Search, ChevronLeft, ChevronRight, X, Layers, Eye, Calendar, Save, ExternalLink, Activity, CheckSquare, RefreshCcw, Archive, Pencil } from 'lucide-react';
import {
  cancelWorkflowProject,
  createWorkflowProject,
  getWorkflowItems,
  updateWorkflowPhase,
  updateWorkflowProjectDriveLink,
} from '@/services/workflowService';

interface WorkflowFormTask extends WorkflowTask {
  assignee_id?: number | string | null;
}

interface WorkflowFormPhase {
  name: string;
  tasks: WorkflowFormTask[];
}

function projectCreateErrorMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : null;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : '';

  if (code === 'project_creation_atomic_rpc_required') return 'Cần duyệt RPC giao dịch trước khi tạo dự án kèm giai đoạn và công việc.';
  if (status === 409) return 'Không thể lưu dự án vì trạng thái dữ liệu chưa phù hợp.';
  if (status === 403) return 'Bạn không có quyền tạo dự án.';
  if (status === 422) return 'Thông tin dự án chưa hợp lệ.';
  if (code === 'phase_mutation_failed' || message.includes('giai đoạn')) return 'Không thể lưu giai đoạn.';

  return 'Không thể tạo dự án.';
}

function parseWorkflowDescription(raw?: string | null): WorkflowDescription {
  try {
    return JSON.parse(raw || '{}') as WorkflowDescription;
  } catch {
    return {};
  }
}

function formatDateTime(value?: string | null): string {
  if (!value) return 'Chưa có dữ liệu';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function AdminTaskWorkflowDashboard() {
  const { showToast, showConfirm } = useNotification();
  const router = useRouter();
  const [tasks, setTasks] = useState<WorkflowSetting[]>([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;

  const [showAddModal, setShowAddModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [projectDeadline, setProjectDeadline] = useState('');
  const [formPhases, setFormPhases] = useState<WorkflowFormPhase[]>([]);
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [creationStage, setCreationStage] = useState('');

  const [showDetailModal, setShowDetailModal] = useState(false);
  const [activeProjectName, setActiveProjectName] = useState('');
  const [activeProjectPhases, setActiveProjectPhases] = useState<WorkflowSetting[]>([]);
  const [driveLinkInput, setDriveLinkInput] = useState(''); 
  const [editingPhaseId, setEditingPhaseId] = useState<number | null>(null);
  const [editingPhaseName, setEditingPhaseName] = useState('');
  const [editingPhaseOrder, setEditingPhaseOrder] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const tList = await getWorkflowItems({ includeClosedProjects: false });
      setTasks(tList || []);
    } catch {
      showToast('Lỗi tải dữ liệu', 'Không thể tải dữ liệu công việc.', 'error');
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
    setFormPhases([{ name: 'Giai đoạn 1', tasks: [{ name: '', assignee_id: '', deadline: '', note: '', status: 'TODO' }] }]);
    setShowAddModal(true);
  };

  const handleAddPhaseInForm = () => {
    setFormPhases([...formPhases, { name: `Giai đoạn ${formPhases.length + 1}`, tasks: [{ name: '', assignee_id: '', deadline: '', note: '', status: 'TODO' }] }]);
  };

  const handleRemovePhaseInForm = (pIdx: number) => {
    const updated = [...formPhases];
    updated.splice(pIdx, 1);
    setFormPhases(updated);
  };

  const handleAddTaskInForm = (pIdx: number) => {
    const updated = [...formPhases];
    updated[pIdx].tasks.push({ name: '', assignee_id: '', deadline: '', note: '', status: 'TODO' });
    setFormPhases(updated);
  };

  const handleRemoveTaskInForm = (pIdx: number, tIdx: number) => {
    const updated = [...formPhases];
    updated[pIdx].tasks.splice(tIdx, 1);
    setFormPhases(updated);
  };

  const handleCreateProject = async () => {
    if (isCreatingProject) return;
    if (!newProjectName.trim()) return showToast('Thiếu dữ liệu', 'Vui lòng nhập tên dự án tổng!', 'error');
    if (!projectDeadline) return showToast('Thiếu thời hạn', 'Vui lòng chọn ngày hạn dự án!', 'error');

    setIsCreatingProject(true);
    setCreationStage('Đang tạo dự án...');
    try {
      setCreationStage('Đang tạo các giai đoạn...');
      const result = await createWorkflowProject({
        projectName: newProjectName,
        projectDeadline,
        createTemplateTasks: true,
        phases: formPhases.map((phase) => {
          const validTasks = phase.tasks
            .filter((task) => task.name?.trim() !== '')
            .map((task) => ({
              name: task.name?.trim(),
              deadline: task.deadline,
              note: task.note?.trim() || '',
              status: task.status || 'TODO',
            }));

          return {
            name: phase.name,
            tasks: validTasks,
          };
        }),
      });

      setCreationStage('Đang hoàn tất...');
      setShowAddModal(false);
      await loadData();
      showToast('Tạo dự án thành công.', `Đã tạo ${result.phasesCreated} giai đoạn.`, 'success', {
        actionLabel: 'Xem chi tiết',
        onAction: () => router.push(`/admin/projects/${result.project.id}`),
      });
    } catch (error) {
      showToast('Không thể tạo dự án.', projectCreateErrorMessage(error), 'error');
    } finally {
      setIsCreatingProject(false);
      setCreationStage('');
    }
  };

  const handleStartEditPhase = (phase: WorkflowSetting) => {
    const description = parseWorkflowDescription(phase.description);
    const phaseName = description.stage_name || phase.config_name?.split(' - ')[1] || '';
    setEditingPhaseId(typeof phase.phase_id === 'number' ? phase.phase_id : null);
    setEditingPhaseName(phaseName);
    setEditingPhaseOrder(String(description.phase_order_index ?? ''));
  };

  const handleSavePhaseEdit = async (phase: WorkflowSetting) => {
    try {
      if (!phase.project_id || !phase.phase_id) throw new Error('Không tìm thấy giai đoạn cần lưu.');
      const orderIndex = Number(editingPhaseOrder);

      await updateWorkflowPhase({
        projectId: phase.project_id,
        phaseId: phase.phase_id,
        phaseName: editingPhaseName,
        orderIndex: Number.isInteger(orderIndex) && orderIndex >= 0 ? orderIndex : undefined,
      });

      setEditingPhaseId(null);
      showToast('Đã lưu giai đoạn.', 'Tên hoặc thứ tự giai đoạn đã được cập nhật.', 'success');
      const tList = await getWorkflowItems({ includeClosedProjects: false });
      setTasks(tList);
      if (activeProjectName) {
        const refreshed = tList.filter((item) => item.config_name?.split(' - ')[0] === activeProjectName);
        setActiveProjectPhases(refreshed);
      }
    } catch {
      showToast('Không thể lưu giai đoạn.', 'Vui lòng thử lại sau.', 'error');
    }
  };

  const handleSaveDriveLinkToDB = async () => {
    if (activeProjectPhases.length === 0) return;
    try {
      const cleanedLink = driveLinkInput.trim();
      const projectId = activeProjectPhases[0]?.project_id;
      if (!projectId) throw new Error('Khong tim thay du an can cap nhat.');

      await updateWorkflowProjectDriveLink({
        projectId,
        driveLink: cleanedLink,
      });
      showToast('Thành công', 'Đã lưu link Google Drive tổng!', 'success');
      loadData();
      setShowDetailModal(false);
    } catch { showToast('Không thể cập nhật dự án.', 'Vui lòng thử lại sau.', 'error'); }
  };

  const handleCancelProjectGroup = (configNamePrefix?: string | null) => {
    if (!configNamePrefix) return;
    const shortName = configNamePrefix.split(' - ')[0]; 
    showConfirm('Hủy dự án', `Dự án [${shortName}] sẽ được đánh dấu hủy và giữ lại lịch sử.`, async () => {
      try {
        const targetProjectId = tasks.find(t => t.config_name?.split(' - ')[0] === shortName)?.project_id;
        if (!targetProjectId) throw new Error('Không tìm thấy dự án cần hủy.');

        await cancelWorkflowProject(targetProjectId);
        setTasks((currentTasks) => currentTasks.filter((item) => item.project_id !== targetProjectId));
        showToast('Đã hủy dự án.', 'Dự án không bị xóa khỏi dữ liệu.', 'info');
        loadData();
      } catch { showToast('Không thể hủy dự án.', 'Vui lòng thử lại sau.', 'error'); }
    });
  };

  const projectGroupsMap: Record<string, WorkflowSetting[]> = {};
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
                      {projectPhases[0]?.project_id ? (
                        <Link href={`/admin/projects/${projectPhases[0].project_id}`} className="font-black text-slate-100 text-sm hover:text-purple-300">
                          📦 {pName}
                        </Link>
                      ) : (
                        <p className="font-black text-slate-100 text-sm">📦 {pName}</p>
                      )}
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
                      <Link href={projectPhases[0]?.project_id ? `/admin/projects/${projectPhases[0].project_id}` : '#'} className="bg-slate-950 border border-slate-800 hover:border-blue-500 text-blue-400 font-bold text-[10px] px-2.5 py-1.5 rounded-xl transition inline-flex items-center gap-1 cursor-pointer">
                        <Eye className="w-3.5 h-3.5" /> Quản lý chi tiết
                      </Link>
                    </td>
                    <td className="p-4 text-center">
                      <button aria-label="Hủy dự án" onClick={() => handleCancelProjectGroup(projectPhases[0]?.config_name || '')} className="text-slate-600 hover:text-amber-400 transition cursor-pointer"><Archive className="w-3.5 h-3.5"/></button>
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

      {isCreatingProject && (
        <div
          className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          aria-busy="true"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 text-center shadow-2xl">
            <RefreshCcw className="mx-auto h-6 w-6 animate-spin text-purple-300" />
            <h3 className="mt-3 text-sm font-black text-slate-100">Đang khởi tạo dự án</h3>
            <p className="mt-1 text-xs text-slate-400">{creationStage || 'Đang hoàn tất...'}</p>
          </div>
        </div>
      )}

      {/* POPUP CHI TIẾT DỮ LIỆU THẬT CỦA DỰ ÁN */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 w-full max-w-4xl space-y-4 my-auto relative shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <div>
                <h3 className="font-black text-sm text-slate-100 uppercase">Dự án: {activeProjectName}</h3>
              </div>
              <button onClick={() => setShowDetailModal(false)} className="text-slate-500 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <p className="text-slate-500 font-bold">Mã dự án</p>
                <p className="text-slate-200 font-mono">{activeProjectPhases[0]?.project_id || 'Chưa có dữ liệu'}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <p className="text-slate-500 font-bold">Ngày tạo</p>
                <p className="text-slate-200">{formatDateTime(parseWorkflowDescription(activeProjectPhases[0]?.description).project_created_at)}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <p className="text-slate-500 font-bold">Trạng thái DB</p>
                <p className="text-slate-200">{parseWorkflowDescription(activeProjectPhases[0]?.description).project_status || 'Chưa có dữ liệu'}</p>
              </div>
              <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                <p className="text-slate-500 font-bold">Số giai đoạn</p>
                <p className="text-slate-200 font-mono">{activeProjectPhases.length}</p>
              </div>
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
                const currentJSON = parseWorkflowDescription(phase.description);
                const isEditing = editingPhaseId === phase.phase_id;
                const phaseName = currentJSON.stage_name || phase.config_name?.split(' - ')[1] || `Giai đoạn ${pIdx + 1}`;

                return (
                  <div key={phase.key} className="bg-slate-950 p-3 border border-slate-850 rounded-xl space-y-2.5">
                    <div className="flex flex-col gap-3 border-b border-slate-850 pb-2 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <span className="font-bold text-xs text-purple-400">Giai đoạn {pIdx + 1}: {phaseName}</span>
                        <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                          <span>Mã: {phase.phase_id}</span>
                          <span>Thứ tự: {currentJSON.phase_order_index ?? pIdx}</span>
                          <span>Ngày tạo: {formatDateTime(currentJSON.phase_created_at)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded border border-slate-700 px-2 py-1 text-[10px] text-slate-400">Trạng thái: Chưa hỗ trợ lưu</span>
                        <button type="button" onClick={() => handleStartEditPhase(phase)} className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1 text-[10px] font-bold text-slate-300 hover:text-white">
                          <Pencil className="h-3 w-3" /> Sửa
                        </button>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="grid grid-cols-1 gap-2 rounded-xl border border-slate-800 bg-slate-900 p-3 sm:grid-cols-[1fr_120px_auto]">
                        <input
                          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none"
                          value={editingPhaseName}
                          onChange={(event) => setEditingPhaseName(event.target.value)}
                          placeholder="Tên giai đoạn"
                        />
                        <input
                          type="number"
                          min={0}
                          className="rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-100 outline-none"
                          value={editingPhaseOrder}
                          onChange={(event) => setEditingPhaseOrder(event.target.value)}
                          placeholder="Thứ tự"
                        />
                        <div className="flex gap-2">
                          <button type="button" onClick={() => handleSavePhaseEdit(phase)} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Lưu</button>
                          <button type="button" onClick={() => setEditingPhaseId(null)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-bold text-slate-300">Hủy</button>
                        </div>
                      </div>
                    )}

                    <p className="text-[11px] text-slate-500">Công việc mẫu: Chưa hỗ trợ khởi tạo trong schema hiện tại.</p>
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
              <button disabled={isCreatingProject} onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"><X className="w-5 h-5" /></button>
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
                    {p.tasks?.map((t: WorkflowFormTask, tIdx: number) => (
                      <div key={tIdx} className="flex flex-col sm:flex-row gap-2 p-2 bg-slate-950 rounded-lg border border-slate-850 items-center">
                        <input type="text" className="flex-1 bg-slate-900 border border-slate-800 p-1.5 rounded text-slate-200 focus:outline-none text-xs" placeholder="Tên công việc con..." value={t.name} onChange={(e) => { const n = [...formPhases]; n[pIdx].tasks[tIdx].name = e.target.value; setFormPhases(n); }} />
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
              <button type="button" disabled={isCreatingProject} onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-950 border border-slate-800 p-2.5 rounded-xl font-bold text-slate-400 disabled:cursor-not-allowed disabled:opacity-40">Hủy</button>
              <button type="button" disabled={isCreatingProject} onClick={handleCreateProject} className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-black p-2.5 rounded-xl uppercase text-xs cursor-pointer">{isCreatingProject ? 'Đang lưu...' : '🚀 Phát lệnh sản xuất'}</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
