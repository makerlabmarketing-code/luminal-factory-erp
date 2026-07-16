import type {
  WorkflowPhase,
  WorkflowPhaseFormInput,
  WorkflowProject,
  WorkflowProjectInsertInput,
  WorkflowSetting,
} from '@/lib/types/workflow';
import { workflowRepository } from '@/services/repositories/workflowRepository';

export interface WorkflowProjectCreateResult {
  success: true;
  projectCreated: boolean;
  projectId: number;
  phasesCreated: number;
  tasksCreated: number;
  warnings: string[];
}

function toWorkflowSetting(project: WorkflowProject, phase: WorkflowPhase): WorkflowSetting {
  const orderIndex = phase.order_index ?? 0;

  return {
    id: phase.id,
    key: `PROJECT_${project.id}_PHASE_${String(orderIndex).padStart(3, '0')}_${phase.id}`,
    project_id: project.id,
    phase_id: phase.id,
    value: phase.status || (orderIndex === 0 ? 'DOING' : 'TODO'),
    group_name: 'PRODUCTION_WORKFLOW',
    config_name: `${project.name} - ${phase.name}`,
    param_type: project.project_deadline || '',
    description: JSON.stringify({
      project_drive_link: project.drive_link || '',
      project_deadline: project.project_deadline || '',
      colorway_name: phase.colorway_name || '',
      colorway_code: phase.colorway_code || '',
      target_release_date: project.project_deadline || '',
      stage_name: phase.name || '',
      stage_type: phase.stage_type || '',
      stage_owner: phase.stage_owner || '',
      stage_deadline: phase.planned_end_date || '',
      next_action: phase.next_action || '',
      tasks_list: (phase.tasks || []).map((task) => ({
        id: task.id,
        name: task.name || '',
        assignee: task.assignee_name || task.assignee || '',
        assignee_id: null,
        assignee_name: task.assignee_name || task.assignee || '',
        deadline: task.deadline || '',
        note: task.note || '',
        status: task.status || 'TODO',
      })),
    }),
  };
}

function attachTasksToPhases(
  projects: WorkflowProject[],
  phases: WorkflowPhase[]
): WorkflowPhase[] {
  const phasesByProjectId = phases.reduce<Record<number, WorkflowPhase[]>>((groups, phase) => {
    if (!groups[phase.project_id]) groups[phase.project_id] = [];
    groups[phase.project_id].push(phase);
    return groups;
  }, {});

  return projects.flatMap((project) =>
    (phasesByProjectId[project.id] || []).sort(
      (left, right) => (left.order_index ?? 0) - (right.order_index ?? 0)
    )
  );
}

function toLegacyWorkflowSetting(
  task: Awaited<ReturnType<typeof workflowRepository.listLegacyTasks>>[number]
): WorkflowSetting {
  const projectName = task.projectName || task.project_name || 'Dự án legacy';
  const phaseName = task.currentPhaseText || task.current_phase || task.status || 'Legacy';

  return {
    id: `legacy-task-${task.id}`,
    key: `LEGACY_TASK_${task.id}`,
    value: task.status || 'TODO',
    group_name: 'PRODUCTION_WORKFLOW_LEGACY',
    config_name: `${projectName} - ${phaseName}`,
    param_type: task.deadline || '',
    description: JSON.stringify({
      project_drive_link: '',
      project_deadline: task.estimationDate || task.deadline || '',
      stage_name: phaseName,
      stage_type: 'LEGACY_TASK',
      stage_owner: task.assignee_name || task.assignee || '',
      stage_deadline: task.estimationDate || task.deadline || '',
      tasks_list: [{
        id: task.id,
        name: task.projectName || task.name || projectName,
        projectName: task.projectName || projectName,
        assignee: task.assignee_name || task.assignee || '',
        assignee_id: null,
        assignee_name: task.assignee_name || task.assignee || '',
        assignedToText: task.assignedToText || null,
        packerAssignedText: task.packerAssignedText || null,
        currentPhaseText: task.currentPhaseText || null,
        estimationDate: task.estimationDate || null,
        issueNote: task.issueNote || null,
        createdAt: task.createdAt || null,
        deadline: task.estimationDate || task.deadline || '',
        note: task.issueNote || task.note || '',
        status: task.status || 'TODO',
      }],
    }),
  };
}

export async function getWorkflowItems(): Promise<WorkflowSetting[]> {
  const projects = await workflowRepository.listProjects();
  const projectIds = projects.map((project) => project.id);
  const [phases, legacyTasks] = await Promise.all([
    workflowRepository.listPhasesByProjectIds(projectIds),
    workflowRepository.listLegacyTasks(),
  ]);

  if (phases.length === 0) {
    return legacyTasks.map(toLegacyWorkflowSetting);
  }

  const enrichedPhases = phases.map((phase) => ({
    ...phase,
    tasks: [],
  }));

  const sortedPhases = attachTasksToPhases(projects, enrichedPhases);
  const projectMap = new Map(projects.map((project) => [project.id, project]));

  const phaseSettings = sortedPhases
    .map((phase) => {
      const project = projectMap.get(phase.project_id);
      if (!project) return null;
      return toWorkflowSetting(project, phase);
    })
    .filter((item): item is WorkflowSetting => item !== null);

  return [
    ...phaseSettings,
    ...legacyTasks.map(toLegacyWorkflowSetting),
  ];
}

export async function createWorkflowProject(
  params: WorkflowProjectInsertInput
): Promise<WorkflowProjectCreateResult> {
  const projectId = await workflowRepository.insertProject({
    projectName: params.projectName,
    projectDeadline: params.projectDeadline,
  });

  let phasesCreated = 0;
  const warnings: string[] = [];

  for (let index = 0; index < params.phases.length; index += 1) {
    const phase: WorkflowPhaseFormInput = params.phases[index];
    try {
      await workflowRepository.insertPhase({
        projectId,
        phaseName: phase.name?.trim() || `Giai doan ${index + 1}`,
        orderIndex: index,
      });
      phasesCreated += 1;
    } catch {
      warnings.push('Không thể tạo giai đoạn.');
      break;
    }

    if ((phase.tasks || []).some((task) => task.name?.trim())) {
      warnings.push('Không thể tạo công việc.');
    }
  }

  return {
    success: true,
    projectCreated: true,
    projectId,
    phasesCreated,
    tasksCreated: 0,
    warnings: Array.from(new Set(warnings)),
  };
}

export async function updateWorkflowPhaseStatus(phaseId: number, status: string): Promise<void> {
  await workflowRepository.updatePhaseStatus(phaseId, status);
}

export async function updateWorkflowProjectDriveLink(params: {
  projectId: number;
  driveLink: string;
}): Promise<void> {
  await workflowRepository.updateProjectDriveLink(params.projectId, params.driveLink.trim());
}

export async function updateWorkflowTaskField(params: {
  taskId: number;
  field: 'assignee' | 'deadline' | 'note' | 'status' | 'assignee_id' | 'assignee_name';
  value: string | number | null;
}): Promise<void> {
  await workflowRepository.updateTaskField(params);
}

export async function updateWorkflowTask(params: {
  taskId: number;
  status: string;
  deadline: string;
  note: string;
}): Promise<void> {
  await workflowRepository.updateTask(params);
}

export async function deleteWorkflowProject(projectId: number): Promise<void> {
  await workflowRepository.deleteProject(projectId);
}
