'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Layers,
  Plus,
  RefreshCcw,
  Search,
  ShieldAlert,
  Archive,
  User,
  X,
} from 'lucide-react';
import { useNotification } from '@/component/NotificationContext';
import type { WorkflowDescription, WorkflowSetting, WorkflowTask } from '@/lib/types/workflow';
import {
  cancelWorkflowProject,
  createWorkflowProject,
  getWorkflowItems,
} from '@/services/workflowService';

type StageStatus =
  | 'NOT_READY'
  | 'READY'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'WAITING_REVIEW'
  | 'COMPLETED'
  | 'SKIPPED';

type HealthState =
  | 'PLANNING'
  | 'ACTIVE'
  | 'AT_RISK'
  | 'BLOCKED'
  | 'WAITING'
  | 'IN_REVIEW'
  | 'COMPLETED';

interface StageTemplate {
  name: string;
  type: string;
  weight: number;
  requiresReview?: boolean;
  taskNames: string[];
}

interface StageRecord {
  item: WorkflowSetting;
  description: WorkflowDescription;
  status: StageStatus;
  tasks: WorkflowTask[];
  weight: number;
}

interface ColorwayRecord {
  name: string;
  code: string;
  stages: StageRecord[];
  health: HealthState;
  progress: number;
  currentStage?: StageRecord;
  nextStage?: StageRecord;
  activeTasks: number;
  blockedTasks: number;
  targetDate: string;
  owner: string;
  nextAction: string;
  lastActivity: string;
}

interface ProjectRecord {
  id?: number;
  name: string;
  colorways: ColorwayRecord[];
  progress: number;
  targetDate: string;
  nextAction: string;
  owner: string;
}

function projectCreateErrorMessage(error: unknown): string {
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? Number((error as { status?: unknown }).status)
    : null;
  const code = typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code?: unknown }).code || '')
    : '';
  const message = error instanceof Error ? error.message : '';

  if (status === 409 || code === 'project_already_exists') return 'Dự án này đã tồn tại.';
  if (status === 403) return 'Bạn không có quyền tạo dự án.';
  if (status === 422) return 'Thông tin dự án chưa hợp lệ.';
  if (code === 'phase_mutation_failed' || message.includes('giai đoạn')) return 'Không thể lưu giai đoạn.';

  return 'Không thể tạo dự án.';
}

const PIPELINE_TEMPLATES: Record<string, StageTemplate[]> = {
  STANDARD_ARTISAN_KEYCAP: [
    { name: 'Concept', type: 'CONCEPT', weight: 8, taskNames: ['Define story and palette', 'Collect references'] },
    { name: '2D Design', type: '2D_DESIGN', weight: 8, requiresReview: true, taskNames: ['Sketch front view', 'Approve color direction'] },
    { name: '3D Sculpt', type: '3D_SCULPT', weight: 12, requiresReview: true, taskNames: ['Block sculpt', 'Detail sculpt'] },
    { name: 'Sculpt Review', type: 'SCULPT_REVIEW', weight: 5, requiresReview: true, taskNames: ['Technical fit review'] },
    { name: 'Master Production', type: 'MASTER_PRINT', weight: 10, taskNames: ['Print master', 'Prepare master surface'] },
    { name: 'Mold Making', type: 'MOLD_MAKING', weight: 12, taskNames: ['Plan mold', 'Pour mold', 'Cure mold'] },
    { name: 'Mold Test', type: 'MOLD_TEST', weight: 8, requiresReview: true, taskNames: ['Test cast', 'Check deformation and fit'] },
    { name: 'Color Test', type: 'COLOR_FORMULATION', weight: 7, taskNames: ['Mix resin colors', 'Record formula'] },
    { name: 'Production Casting', type: 'PRODUCTION_CASTING', weight: 12, taskNames: ['Prepare resin', 'Cast production units'] },
    { name: 'Finishing', type: 'FINISHING', weight: 8, taskNames: ['Demold', 'Clean', 'Sand'] },
    { name: 'QC', type: 'QC', weight: 5, requiresReview: true, taskNames: ['Inspect units', 'Separate rework units'] },
    { name: 'Product Photo', type: 'PRODUCT_PHOTO', weight: 2, taskNames: ['Shoot product photos'] },
    { name: 'Content', type: 'CONTENT_READY', weight: 1, taskNames: ['Prepare listing copy'] },
    { name: 'Packaging', type: 'PACKAGING', weight: 1, taskNames: ['Prepare packaging'] },
    { name: 'Ready For Sale', type: 'READY_FOR_SALE', weight: 1, requiresReview: true, taskNames: ['Final release approval'] },
  ],
};

const healthStyles: Record<HealthState, string> = {
  BLOCKED: 'bg-red-950/60 text-red-300 border-red-800',
  AT_RISK: 'bg-amber-950/60 text-amber-300 border-amber-800',
  IN_REVIEW: 'bg-violet-950/60 text-violet-300 border-violet-800',
  ACTIVE: 'bg-blue-950/60 text-blue-300 border-blue-800',
  WAITING: 'bg-slate-800 text-slate-300 border-slate-700',
  PLANNING: 'bg-cyan-950/50 text-cyan-300 border-cyan-800',
  COMPLETED: 'bg-emerald-950/60 text-emerald-300 border-emerald-800',
};

function parseDescription(raw?: string | null): WorkflowDescription {
  try {
    return JSON.parse(raw || '{}') as WorkflowDescription;
  } catch {
    return {};
  }
}

function isDone(status?: string | null) {
  return ['DONE', 'COMPLETED'].includes((status || '').toUpperCase());
}

function isDoing(status?: string | null) {
  return ['DOING', 'IN_PROGRESS'].includes((status || '').toUpperCase());
}

function isBlocked(status?: string | null) {
  return ['BLOCKED', 'WAITING_BLOCKER'].includes((status || '').toUpperCase());
}

function isOverdue(dateText?: string) {
  if (!dateText) return false;
  const date = new Date(dateText);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

function deriveStageStatus(item: WorkflowSetting, description: WorkflowDescription, tasks: WorkflowTask[]): StageStatus {
  if (tasks.some((task) => isBlocked(task.status))) return 'BLOCKED';
  if (isDone(item.value)) return 'COMPLETED';
  if (tasks.length > 0 && tasks.every((task) => isDone(task.status))) {
    return description.stage_type?.includes('REVIEW') || description.stage_type === 'QC' ? 'WAITING_REVIEW' : 'COMPLETED';
  }
  if (isDoing(item.value) || tasks.some((task) => isDoing(task.status))) return 'IN_PROGRESS';
  return 'READY';
}

function stageWeight(description: WorkflowDescription) {
  const templateStage = PIPELINE_TEMPLATES.STANDARD_ARTISAN_KEYCAP.find((stage) => stage.type === description.stage_type);
  return templateStage?.weight || 1;
}

function deriveHealth(stages: StageRecord[], progress: number): HealthState {
  if (stages.length > 0 && stages.every((stage) => stage.status === 'COMPLETED' || stage.status === 'SKIPPED')) return 'COMPLETED';
  if (stages.some((stage) => stage.status === 'BLOCKED')) return 'BLOCKED';
  if (stages.some((stage) => stage.status === 'IN_PROGRESS' && isOverdue(stage.description.stage_deadline))) return 'AT_RISK';
  if (stages.some((stage) => stage.status === 'WAITING_REVIEW')) return 'IN_REVIEW';
  if (stages.some((stage) => stage.status === 'IN_PROGRESS')) return 'ACTIVE';
  if (progress === 0) return 'PLANNING';
  return 'WAITING';
}

function calculateProgress(stages: StageRecord[]) {
  const totalWeight = stages.reduce((sum, stage) => sum + stage.weight, 0) || 1;
  const doneWeight = stages.reduce((sum, stage) => {
    if (stage.status === 'COMPLETED' || stage.status === 'SKIPPED') return sum + stage.weight;
    if (stage.status === 'IN_PROGRESS' || stage.status === 'WAITING_REVIEW') return sum + stage.weight * 0.5;
    return sum;
  }, 0);

  return Math.round((doneWeight / totalWeight) * 100);
}

function buildProjectRecords(items: WorkflowSetting[]): ProjectRecord[] {
  const byProject = new Map<string, WorkflowSetting[]>();

  items.forEach((item) => {
    const projectName = item.config_name?.split(' - ')[0] || 'Untitled project';
    if (!byProject.has(projectName)) byProject.set(projectName, []);
    byProject.get(projectName)?.push(item);
  });

  return Array.from(byProject.entries()).map(([projectName, projectItems]) => {
    const byColorway = new Map<string, StageRecord[]>();

    projectItems.forEach((item) => {
      const description = parseDescription(item.description);
      const tasks = description.tasks_list || [];
      const colorwayName = description.colorway_name || 'Default colorway';
      const record: StageRecord = {
        item,
        description,
        status: deriveStageStatus(item, description, tasks),
        tasks,
        weight: stageWeight(description),
      };

      if (!byColorway.has(colorwayName)) byColorway.set(colorwayName, []);
      byColorway.get(colorwayName)?.push(record);
    });

    const colorways: ColorwayRecord[] = Array.from(byColorway.entries()).map(([colorwayName, stages]) => {
      const sortedStages = stages.sort((left, right) => String(left.item.key).localeCompare(String(right.item.key)));
      const progress = calculateProgress(sortedStages);
      const health = deriveHealth(sortedStages, progress);
      const currentStage = sortedStages.find((stage) => !['COMPLETED', 'SKIPPED'].includes(stage.status));
      const nextStage = currentStage
        ? sortedStages.slice(sortedStages.indexOf(currentStage) + 1).find((stage) => stage.status !== 'SKIPPED')
        : undefined;
      const activeTasks = sortedStages.reduce((sum, stage) => sum + stage.tasks.filter((task) => isDoing(task.status)).length, 0);
      const blockedTasks = sortedStages.reduce((sum, stage) => sum + stage.tasks.filter((task) => isBlocked(task.status)).length, 0);
      const firstDescription = sortedStages[0]?.description || {};

      return {
        name: colorwayName,
        code: firstDescription.colorway_code || '',
        stages: sortedStages,
        health,
        progress,
        currentStage,
        nextStage,
        activeTasks,
        blockedTasks,
        targetDate: firstDescription.target_release_date || firstDescription.project_deadline || '',
        owner: currentStage?.description.stage_owner || firstDescription.stage_owner || '',
        nextAction: currentStage?.description.next_action || currentStage?.description.stage_name || 'Review pipeline',
        lastActivity: 'Updated in workflow',
      };
    });

    const progress = colorways.length
      ? Math.round(colorways.reduce((sum, colorway) => sum + colorway.progress, 0) / colorways.length)
      : 0;
    const firstColorway = colorways[0];

    return {
      id: projectItems[0]?.project_id,
      name: projectName,
      colorways,
      progress,
      targetDate: firstColorway?.targetDate || '',
      nextAction: colorways.find((colorway) => colorway.health !== 'COMPLETED')?.nextAction || 'All colorways completed',
      owner: firstColorway?.owner || '',
    };
  });
}

function initialDeadline(baseDate: string, index: number, total: number) {
  if (!baseDate) return '';
  const target = new Date(baseDate);
  if (Number.isNaN(target.getTime())) return '';
  const daysBack = Math.max(total - index - 1, 0) * 2;
  target.setDate(target.getDate() - daysBack);
  return target.toISOString().slice(0, 10);
}

export default function AdminProjectManagement() {
  const { showToast, showConfirm } = useNotification();
  const router = useRouter();
  const [items, setItems] = useState<WorkflowSetting[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [colorwayName, setColorwayName] = useState('');
  const [colorwayCode, setColorwayCode] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [stageOwner, setStageOwner] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [creationStage, setCreationStage] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const workflowItems = await getWorkflowItems();
      setItems(workflowItems);
    } catch (error: any) {
      showToast('Load failed', error.message || 'Cannot load project workflow.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const projects = useMemo(() => buildProjectRecords(items), [items]);
  const filteredProjects = projects.filter((project) => project.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const activeProject = filteredProjects.find((project) => project.name === selectedProject) || filteredProjects[0];

  const metrics = useMemo(() => {
    const colorways = projects.flatMap((project) => project.colorways);
    return {
      projects: projects.length,
      colorways: colorways.length,
      blocked: colorways.filter((colorway) => colorway.health === 'BLOCKED').length,
      atRisk: colorways.filter((colorway) => colorway.health === 'AT_RISK').length,
    };
  }, [projects]);

  const metricCards = [
    { label: 'Projects', value: metrics.projects, Icon: Layers, color: 'text-cyan-300' },
    { label: 'Colorways', value: metrics.colorways, Icon: Activity, color: 'text-blue-300' },
    { label: 'Blocked', value: metrics.blocked, Icon: ShieldAlert, color: 'text-red-300' },
    { label: 'At risk', value: metrics.atRisk, Icon: AlertTriangle, color: 'text-amber-300' },
  ];

  const handleCreateProject = async () => {
    if (isCreatingProject) return;
    if (!projectName.trim()) return showToast('Missing data', 'Please enter project/product line name.', 'error');
    if (!colorwayName.trim()) return showToast('Missing data', 'Please enter colorway name.', 'error');
    if (!targetDate) return showToast('Missing data', 'Please choose target release date.', 'error');

    setIsCreatingProject(true);
    setCreationStage('Đang tạo dự án...');
    try {
      const stages = PIPELINE_TEMPLATES.STANDARD_ARTISAN_KEYCAP.map((stage, index, allStages) => ({
        name: stage.name,
        colorway_name: colorwayName.trim(),
        colorway_code: colorwayCode.trim(),
        stage_type: stage.type,
        stage_owner: stageOwner,
        planned_end_date: initialDeadline(targetDate, index, allStages.length),
        progress: 0,
        next_action: stage.taskNames[0] || stage.name,
        required_review: Boolean(stage.requiresReview),
        tasks: stage.taskNames.map((taskName) => ({
          name: taskName,
          assignee_name: stageOwner,
          assignee: stageOwner,
          status: 'TODO',
        })),
      }));

      setCreationStage('Đang tạo các giai đoạn...');
      const result = await createWorkflowProject({
        projectName: projectName.trim(),
        projectDeadline: targetDate,
        phases: stages,
      });

      setCreationStage('Đang hoàn tất...');
      setShowAddModal(false);
      setProjectName('');
      setColorwayName('');
      setColorwayCode('');
      setTargetDate('');
      setStageOwner('');
      await loadData();
      if (result.warnings.length > 0) {
        showToast('Dự án đã được tạo.', 'Một số công việc mẫu chưa thể khởi tạo.', 'info', {
          actionLabel: 'Xem chi tiết',
          onAction: () => router.push(`/admin/projects/${result.project.id}`),
        });
      } else {
        showToast('Tạo dự án thành công.', `Đã tạo ${result.phasesCreated} giai đoạn.`, 'success', {
          actionLabel: 'Xem chi tiết',
          onAction: () => router.push(`/admin/projects/${result.project.id}`),
        });
      }
    } catch (error) {
      showToast('Không thể tạo dự án.', projectCreateErrorMessage(error), 'error');
    } finally {
      setIsCreatingProject(false);
      setCreationStage('');
    }
  };

  const handleCancelProject = (project: ProjectRecord) => {
    if (!project.id) return;
    showConfirm('Hủy dự án', `Dự án ${project.name} sẽ được đánh dấu hủy và giữ lại lịch sử.`, async () => {
      try {
        await cancelWorkflowProject(project.id as number);
        await loadData();
        showToast('Đã hủy dự án.', 'Dự án không bị xóa khỏi dữ liệu.', 'info');
      } catch (error: any) {
        showToast('Không thể hủy dự án.', error.message || 'Vui lòng thử lại sau.', 'error');
      }
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center text-xs font-mono gap-2">
        <RefreshCcw className="w-4 h-4 animate-spin" /> Syncing project workflow...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Layers className="w-5 h-5 text-cyan-400" />
          <div>
            <h1 className="text-base font-bold">Project Colorway Control</h1>
            <p className="text-[11px] text-slate-400">Project - Colorway - Production Stage - Task</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={loadData} className="bg-slate-900 border border-slate-800 text-slate-300 px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
            <RefreshCcw className="w-4 h-4" /> Refresh
          </button>
          <button onClick={() => setShowAddModal(true)} className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-2">
            <Plus className="w-4 h-4" /> New Project
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {metricCards.map(({ label, value, Icon, color }) => (
          <div key={label} className="bg-slate-900 border border-slate-800 rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-slate-400 font-bold">{label}</p>
              <p className={`text-2xl font-black font-mono ${color}`}>{value}</p>
            </div>
            <Icon className="w-5 h-5 text-slate-500" />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5 items-start">
        <div className="xl:col-span-3 bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-800 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <h2 className="text-xs font-black uppercase text-slate-300">Project overview</h2>
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-200 outline-none w-full sm:w-64"
                placeholder="Search project..."
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-950 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="p-4">Project / Product line</th>
                  <th className="p-4 text-center">Colorways</th>
                  <th className="p-4 text-center">Blocked</th>
                  <th className="p-4 text-center">Progress</th>
                  <th className="p-4">Target</th>
                  <th className="p-4">Next action</th>
                  <th className="p-4 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {filteredProjects.map((project) => {
                  const blockedCount = project.colorways.filter((colorway) => colorway.health === 'BLOCKED').length;
                  return (
                    <tr
                      key={project.name}
                      onClick={() => setSelectedProject(project.name)}
                      className={`cursor-pointer hover:bg-slate-950/50 ${activeProject?.name === project.name ? 'bg-cyan-950/20' : ''}`}
                    >
                      <td className="p-4 font-bold text-slate-100">{project.name}</td>
                      <td className="p-4 text-center font-mono text-cyan-300">{project.colorways.length}</td>
                      <td className="p-4 text-center font-mono text-red-300">{blockedCount}</td>
                      <td className="p-4">
                        <div className="h-2 bg-slate-800 rounded overflow-hidden">
                          <div className="h-full bg-cyan-500" style={{ width: `${project.progress}%` }} />
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{project.progress}%</span>
                      </td>
                      <td className="p-4 text-amber-300 font-mono">{project.targetDate || '-'}</td>
                      <td className="p-4 text-slate-300 max-w-xs truncate">{project.nextAction}</td>
                      <td className="p-4 text-center" onClick={(event) => event.stopPropagation()}>
                        <button onClick={() => handleCancelProject(project)} className="text-slate-500 hover:text-red-300">
                          <Archive className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredProjects.length === 0 && (
                  <tr>
                    <td colSpan={7} className="p-8 text-center text-slate-500">No project workflow yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="xl:col-span-2 bg-slate-900 border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-black text-slate-100">{activeProject?.name || 'Select a project'}</h2>
              <p className="text-[11px] text-slate-400">Colorway board</p>
            </div>
            <span className="text-[10px] border border-slate-700 rounded px-2 py-1 text-slate-400">
              {activeProject?.progress || 0}%
            </span>
          </div>

          <div className="space-y-3">
            {activeProject?.colorways.map((colorway) => (
              <div key={colorway.name} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-100">{colorway.name}</h3>
                      {colorway.code && <span className="text-[10px] text-slate-500 font-mono">{colorway.code}</span>}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Current: {colorway.currentStage?.description.stage_name || 'Completed'}
                    </p>
                  </div>
                  <span className={`text-[10px] font-black border rounded px-2 py-1 ${healthStyles[colorway.health]}`}>
                    {colorway.health}
                  </span>
                </div>

                <div className="h-2 bg-slate-800 rounded overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${colorway.progress}%` }} />
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                  <span className="flex items-center gap-1"><User className="w-3 h-3" /> {colorway.owner || 'No owner'}</span>
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {colorway.targetDate || 'No target'}</span>
                  <span className="flex items-center gap-1"><Activity className="w-3 h-3" /> {colorway.activeTasks} active task</span>
                  <span className="flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> {colorway.blockedTasks} blocker</span>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {colorway.stages.map((stage) => (
                    <span
                      key={String(stage.item.key)}
                      title={stage.description.stage_name}
                      className={`h-6 w-6 rounded-full border flex items-center justify-center ${
                        stage.status === 'COMPLETED'
                          ? 'bg-emerald-950 border-emerald-700 text-emerald-300'
                          : stage.status === 'BLOCKED'
                            ? 'bg-red-950 border-red-700 text-red-300'
                            : stage.status === 'IN_PROGRESS'
                              ? 'bg-blue-950 border-blue-700 text-blue-300'
                              : 'bg-slate-900 border-slate-700 text-slate-500'
                      }`}
                    >
                      {stage.status === 'COMPLETED' ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Circle className="w-3 h-3" />}
                    </span>
                  ))}
                </div>

                <div className="border-t border-slate-800 pt-3 text-[11px] text-slate-300 flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="truncate">Next: {colorway.nextAction}</span>
                </div>
              </div>
            ))}

            {!activeProject && <div className="text-sm text-slate-500 text-center py-12">Create a project to start tracking colorways.</div>}
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-lg p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-100">Create colorway pipeline</h3>
                <p className="text-[11px] text-slate-400">Uses Standard Artisan Keycap Pipeline.</p>
              </div>
              <button disabled={isCreatingProject} onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-40">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400 font-bold">Project / product line</span>
                <input value={projectName} onChange={(event) => setProjectName(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm outline-none text-slate-100" placeholder="Meowhe" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400 font-bold">Colorway</span>
                <input value={colorwayName} onChange={(event) => setColorwayName(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm outline-none text-slate-100" placeholder="Sakura" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400 font-bold">Internal code</span>
                <input value={colorwayCode} onChange={(event) => setColorwayCode(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm outline-none text-slate-100" placeholder="MEW-SAK-01" />
              </label>
              <label className="space-y-1">
                <span className="text-[11px] text-slate-400 font-bold">Target release</span>
                <input type="date" value={targetDate} onChange={(event) => setTargetDate(event.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm outline-none text-amber-300" />
              </label>
              <label className="space-y-1 md:col-span-2">
                <span className="text-[11px] text-slate-400 font-bold">Default stage owner</span>
                <input
                  value={stageOwner}
                  onChange={(event) => setStageOwner(event.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-sm outline-none text-slate-100"
                  placeholder="Nhập tên người phụ trách nếu cần"
                />
              </label>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <p className="text-[11px] text-slate-400 font-bold mb-2">Stages to create</p>
              <div className="flex flex-wrap gap-1.5">
                {PIPELINE_TEMPLATES.STANDARD_ARTISAN_KEYCAP.map((stage) => (
                  <span key={stage.type} className="text-[10px] border border-slate-800 rounded px-2 py-1 text-slate-300">{stage.name}</span>
                ))}
              </div>
            </div>

            <div className="flex gap-2 border-t border-slate-800 pt-3">
              <button disabled={isCreatingProject} onClick={() => setShowAddModal(false)} className="flex-1 bg-slate-950 border border-slate-800 text-slate-300 rounded-lg p-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-40">Cancel</button>
              <button disabled={isCreatingProject} onClick={handleCreateProject} className="flex-1 bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg p-2 text-xs font-black">{isCreatingProject ? 'Đang lưu...' : 'Create Pipeline'}</button>
            </div>
          </div>
        </div>
      )}
      {isCreatingProject && (
        <div
          className="fixed inset-0 z-[99998] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          aria-busy="true"
          aria-modal="true"
          role="dialog"
        >
          <div className="w-full max-w-sm rounded-xl border border-slate-700 bg-slate-900 p-5 text-center shadow-2xl">
            <RefreshCcw className="mx-auto h-6 w-6 animate-spin text-cyan-300" />
            <h3 className="mt-3 text-sm font-black text-slate-100">Đang khởi tạo dự án</h3>
            <p className="mt-1 text-xs text-slate-400">{creationStage || 'Đang hoàn tất...'}</p>
          </div>
        </div>
      )}
    </div>
  );
}
