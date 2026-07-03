'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Activity,
  Calendar,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Link as LinkIcon,
  ListTodo,
  RefreshCcw,
  Save,
} from 'lucide-react';
import { useNotification } from '@/component/NotificationContext';
import type {
  EditableWorkflowTask,
  StaffEmployee,
  WorkflowSetting,
  WorkflowTask,
} from '@/lib/types/staff';
import {
  buildWorkflowEditMaps,
  getStaffTasksData,
  getTaskStats,
  groupWorkflowByProject,
  parseWorkflowDescription,
  updateProjectDriveLink,
  updateStaffWorkflowTask,
} from '@/services/staffTasksService';

interface StaffTasksContentProps {
  token?: string | null;
  workerData?: StaffEmployee | null;
}

interface RenderableWorkflowTask extends WorkflowTask {
  __globalIdx: number;
}

const ITEMS_PER_PAGE = 5;

export function StaffTasksContent({
  token: propsToken,
  workerData,
}: StaffTasksContentProps) {
  const { showToast } = useNotification();
  const searchParams = useSearchParams();
  const token = propsToken || searchParams.get('token');

  const [workerName, setWorkerName] = useState(workerData?.full_name || '');
  const [loading, setLoading] = useState(true);
  const [allWorkflowTasks, setAllWorkflowTasks] = useState<WorkflowSetting[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedProjectName, setSelectedProjectName] = useState<string | null>(null);
  const [localDriveInputs, setLocalDriveInputs] = useState<Record<string, string>>({});
  const [editableTasks, setEditableTasks] = useState<Record<string, EditableWorkflowTask>>({});

  const loadTasksData = async () => {
    if (!token && !workerData) {
      setLoading(false);
      return;
    }

    try {
      const tasksData = await getStaffTasksData({
        token,
        workerData,
      });

      setWorkerName(tasksData.workerName);
      setAllWorkflowTasks(tasksData.workflowItems);

      const maps = buildWorkflowEditMaps(tasksData.workflowItems);
      setLocalDriveInputs(maps.driveInputs);
      setEditableTasks(maps.editableTasks);

      if (!selectedProjectName && tasksData.workflowItems.length > 0) {
        const groupedProjects = groupWorkflowByProject(tasksData.workflowItems);
        const firstProject = Object.keys(groupedProjects)[0];

        if (firstProject) {
          setSelectedProjectName(firstProject);
        }
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasksData();
  }, [token, workerData]);

  const handleStaffRefresh = async () => {
    await loadTasksData();
    showToast('Hệ thống', 'Cập nhật thành công', 'success');
  };

  const handleBufferChange = (
    itemKey: string,
    taskIdx: number,
    field: keyof EditableWorkflowTask,
    value: string
  ) => {
    const targetKey = `${itemKey}_TASK_${taskIdx}`;

    setEditableTasks((prev) => ({
      ...prev,
      [targetKey]: {
        ...prev[targetKey],
        [field]: value,
      },
    }));
  };

  const handleSaveSpecificTask = async (item: WorkflowSetting, taskIdx: number) => {
    try {
      const targetKey = `${item.key}_TASK_${taskIdx}`;
      const bufferedData = editableTasks[targetKey];

      if (!bufferedData) return;

      const updatedDescription = await updateStaffWorkflowTask({
        item,
        taskIndex: taskIdx,
        bufferedTask: bufferedData,
      });

      setAllWorkflowTasks((prev) =>
        prev.map((task) =>
          task.key === item.key
            ? {
                ...task,
                description: updatedDescription,
              }
            : task
        )
      );

      showToast('Đồng bộ thành công', '✓ Đã cập nhật tiến độ việc con trực tiếp lên hệ thống!', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể cập nhật đầu việc.';
      showToast('Thất bại', message, 'error');
    }
  };

  const handleStaffSaveDriveLink = async (currentProjectItem: WorkflowSetting) => {
    try {
      const newLink = (localDriveInputs[currentProjectItem.key] || '').trim();
      const currentProjectPrefix = currentProjectItem.config_name?.split(' - ')[0] || '';

      if (!currentProjectPrefix) return;

      await updateProjectDriveLink({
        projectName: currentProjectPrefix,
        driveLink: newLink,
      });

      showToast('Thành công', 'Đã ghim link Drive tổng cho toàn dự án!', 'success');
      loadTasksData();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Không thể lưu link Drive.';
      showToast('Lỗi', message, 'error');
    }
  };

  const globalProjectGroupsMap = useMemo(() => {
    return groupWorkflowByProject(allWorkflowTasks);
  }, [allWorkflowTasks]);

  const allProjectNames = Object.keys(globalProjectGroupsMap);
  const totalPages = Math.ceil(allProjectNames.length / ITEMS_PER_PAGE) || 1;

  const paginatedProjectNames = allProjectNames.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const taskStats = useMemo(() => {
    return getTaskStats({
      workflowItems: allWorkflowTasks,
      workerName,
    });
  }, [allWorkflowTasks, workerName]);

  if (loading) {
    return (
      <div className="text-center p-6 text-xs text-slate-500 font-mono">
        <RefreshCcw className="w-4 h-4 animate-spin text-purple-500 mx-auto mb-2" /> Đang tải ma trận đầu việc...
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fadeIn w-full text-slate-100 font-sans">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-purple-500" />
          <div>
            <h1 className="text-base font-bold">Trạm Nhận Việc & Nghiệm Thu Tiến Độ</h1>
            <p className="text-[10px] text-slate-500 font-mono">
              Nhân sự vận hành: {workerName}
            </p>
          </div>
        </div>

        <button
          onClick={handleStaffRefresh}
          className="bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 p-2 rounded-xl transition flex items-center gap-1 text-[11px] font-bold cursor-pointer"
        >
          <RefreshCcw className="w-3.5 h-3.5" /> Làm mới dữ liệu
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs font-bold tracking-wide">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <p className="text-slate-400 text-[10px] uppercase">Việc sếp giao cho bạn</p>
            <p className="text-xl font-black font-mono text-purple-400 mt-0.5">
              {taskStats.total} Đầu việc
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-purple-950/40 text-purple-400">
            <ListTodo className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <p className="text-slate-400 text-[10px] uppercase">Hạng mục chưa xong</p>
            <p className="text-xl font-black font-mono text-blue-400 mt-0.5">
              {taskStats.pending} Ca trực
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-blue-950/40 text-blue-400">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-2xl flex items-center justify-between shadow-md">
          <div>
            <p className="text-slate-400 text-[10px] uppercase">Hạng mục bạn đã xong</p>
            <p className="text-xl font-black font-mono text-emerald-400 mt-0.5">
              {taskStats.done} Nghiệm thu
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-950/40 text-emerald-400">
            <CheckSquare className="w-4 h-4" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 h-[65vh] items-start pt-2">
        <div className="lg:col-span-4 bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-xl h-full">
          <div className="px-4 py-3 bg-slate-950/40 border-b border-slate-800 font-bold uppercase text-[10px] text-slate-400 tracking-wider">
            Danh mục toàn bộ dự án
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60">
            {paginatedProjectNames.map((projectName) => {
              const isSelected = selectedProjectName === projectName;

              return (
                <div
                  key={projectName}
                  onClick={() => setSelectedProjectName(projectName)}
                  className={`p-4 cursor-pointer transition flex items-center justify-between ${
                    isSelected
                      ? 'bg-purple-950/10 border-l-4 border-purple-500 font-bold'
                      : 'hover:bg-slate-950/20'
                  }`}
                >
                  <p className="text-slate-200 font-bold text-xs">📦 {projectName}</p>
                </div>
              );
            })}

            {allProjectNames.length === 0 && (
              <div className="p-8 text-center text-slate-600 font-mono italic text-xs">
                Không tìm thấy dữ liệu tiến độ nhà máy.
              </div>
            )}
          </div>

          <div className="p-2.5 flex justify-between items-center bg-slate-950 border-t border-slate-800 font-mono text-[10px] text-slate-500">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((page) => page - 1)}
              className="p-1 disabled:opacity-20 hover:text-white"
            >
              <ChevronLeft size={16} />
            </button>

            <span>
              Trang {currentPage} / {totalPages}
            </span>

            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage((page) => page + 1)}
              className="p-1 disabled:opacity-20 hover:text-white"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-4 overflow-y-auto shadow-xl space-y-4 h-full">
          {selectedProjectName ? (
            <div className="space-y-4">
              <h3 className="text-sm font-black text-purple-400 uppercase tracking-wider border-b border-slate-800 pb-2">
                🎯 Dự án hiển thị: {selectedProjectName}
              </h3>

              {globalProjectGroupsMap[selectedProjectName]
                ?.sort((a, b) => a.key.localeCompare(b.key))
                .map((phase, phaseIndex) => {
                  const currentJSON = parseWorkflowDescription(phase.description);

                  const allTasksInPhase: RenderableWorkflowTask[] =
                    currentJSON.tasks_list?.map((task, index) => ({
                      ...task,
                      __globalIdx: index,
                    })) || [];

                  return (
                    <div
                      key={phase.key}
                      className="bg-slate-950 border border-slate-850 rounded-xl p-3.5 space-y-3 shadow-inner"
                    >
                      <div className="flex justify-between items-center text-xs font-bold text-slate-300 border-b border-slate-900 pb-1.5">
                        <span>
                          ⚡ Giai đoạn {phaseIndex + 1}:{' '}
                          {phase.config_name?.split(' - ')[1]}
                        </span>

                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-black ${
                            phase.value === 'DONE'
                              ? 'text-emerald-400 bg-emerald-950/20'
                              : 'text-blue-400 bg-blue-950/20'
                          }`}
                        >
                          {phase.value === 'DONE' ? '✓ HOÀN THÀNH PHASE' : '⚡ ĐANG TRIỂN KHAI'}
                        </span>
                      </div>

                      {phaseIndex === 0 && (
                        <div className="bg-slate-900 border border-slate-850 p-2.5 rounded-xl space-y-2">
                          <label className="text-[9px] text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1">
                            <LinkIcon className="w-3 h-3 text-blue-400" /> Thư mục Google Drive dự án tổng:
                          </label>

                          <div className="flex gap-2">
                            <input
                              type="text"
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-[10px] text-blue-400 font-mono focus:outline-none"
                              value={localDriveInputs[phase.key] || ''}
                              onChange={(event) =>
                                setLocalDriveInputs({
                                  ...localDriveInputs,
                                  [phase.key]: event.target.value,
                                })
                              }
                              placeholder="Dán link Drive..."
                            />

                            <button
                              onClick={() => handleStaffSaveDriveLink(phase)}
                              className="bg-blue-600 text-white px-3 py-1 rounded-lg text-[10px] font-bold shrink-0 cursor-pointer"
                            >
                              Lưu
                            </button>

                            {currentJSON.project_drive_link?.trim() && (
                              <a
                                href={currentJSON.project_drive_link}
                                target="_blank"
                                rel="noreferrer"
                                className="text-emerald-400 font-bold text-[10px] bg-emerald-950/30 border border-emerald-900/40 px-2.5 py-1 rounded-lg shrink-0"
                              >
                                Mở
                              </a>
                            )}
                          </div>

                          <div className="text-[9px] text-slate-500 font-mono flex items-center gap-1 pt-0.5">
                            <Calendar className="w-3 h-3 text-amber-500" /> Ngày hạn tổng quan:{' '}
                            <span className="text-amber-400 font-bold">
                              {phase.param_type || currentJSON.project_deadline || 'Chưa định hạn'}
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 pt-1">
                        {allTasksInPhase.map((task) => {
                          const targetKey = `${phase.key}_TASK_${task.__globalIdx}`;
                          const taskBuffer = editableTasks[targetKey] || {
                            status: task.status || 'TODO',
                            deadline: task.deadline || '',
                            note: task.note || '',
                          };

                          const isAssignedToMe = task.assignee === workerName;

                          return (
                            <div
                              key={task.__globalIdx}
                              className={`bg-slate-900 border p-3 rounded-xl flex flex-col gap-2.5 ${
                                isAssignedToMe
                                  ? 'border-purple-900/40'
                                  : 'border-slate-850 opacity-65'
                              }`}
                            >
                              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-2 border-b border-slate-950 pb-1.5">
                                <div>
                                  <p className="font-bold text-slate-200 text-xs flex items-center gap-1.5">
                                    ⚙️ {task.name}
                                  </p>

                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    👤 Phụ trách:{' '}
                                    <span
                                      className={
                                        isAssignedToMe
                                          ? 'text-purple-400 font-bold'
                                          : 'text-slate-300'
                                      }
                                    >
                                      {task.assignee} {isAssignedToMe && '(Bạn)'}
                                    </span>
                                  </p>
                                </div>

                                <select
                                  disabled={!isAssignedToMe}
                                  value={taskBuffer.status}
                                  onChange={(event) =>
                                    handleBufferChange(
                                      phase.key,
                                      task.__globalIdx,
                                      'status',
                                      event.target.value
                                    )
                                  }
                                  className="text-[10px] border border-slate-800 rounded-lg p-1.5 font-black bg-slate-950 text-slate-200 focus:outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                  <option value="TODO">⏳ CHỜ LÀM</option>
                                  <option value="DOING">⚡ ĐANG LÀM</option>
                                  <option value="DONE">✓ ĐÃ XONG</option>
                                </select>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                                <div className="md:col-span-1">
                                  <label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">
                                    Hạn chót:
                                  </label>

                                  <input
                                    type="date"
                                    disabled={!isAssignedToMe}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-300 font-mono focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    style={{ colorScheme: 'dark' }}
                                    value={taskBuffer.deadline || ''}
                                    onChange={(event) =>
                                      handleBufferChange(
                                        phase.key,
                                        task.__globalIdx,
                                        'deadline',
                                        event.target.value
                                      )
                                    }
                                  />
                                </div>

                                <div className="md:col-span-3">
                                  <label className="text-[9px] text-slate-500 font-bold block mb-1 uppercase">
                                    Tiến độ báo cáo sếp:
                                  </label>

                                  <input
                                    type="text"
                                    disabled={!isAssignedToMe}
                                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[10px] text-slate-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                                    value={taskBuffer.note}
                                    onChange={(event) =>
                                      handleBufferChange(
                                        phase.key,
                                        task.__globalIdx,
                                        'note',
                                        event.target.value
                                      )
                                    }
                                    placeholder={
                                      isAssignedToMe
                                        ? 'Nhập báo cáo tiến độ gửi sếp...'
                                        : 'Chỉ xem - Không có quyền cập nhật tiến độ'
                                    }
                                  />
                                </div>
                              </div>

                              {isAssignedToMe && (
                                <button
                                  type="button"
                                  onClick={() => handleSaveSpecificTask(phase, task.__globalIdx)}
                                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider flex justify-center items-center gap-1 shadow transition cursor-pointer mt-1"
                                >
                                  <Save size={12} /> Lưu Cập Nhật
                                </button>
                              )}
                            </div>
                          );
                        })}

                        {allTasksInPhase.length === 0 && (
                          <div className="text-center text-[10px] text-slate-600 font-mono py-2">
                            Giai đoạn này chưa thiết lập đầu việc con.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="text-slate-500 text-center pt-24 italic text-xs">
              Vui lòng click chọn tên dự án ở bảng bên trái.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}