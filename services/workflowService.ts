import type {
  WorkflowPhase,
  WorkflowPhaseFormInput,
  WorkflowProject,
  WorkflowProjectInsertInput,
  WorkflowSetting,
} from '@/lib/types/workflow';
import { WorkflowRequestError, workflowRepository } from '@/services/repositories/workflowRepository';

export interface WorkflowWarning {
  code: 'phase_create_failed' | 'task_template_partial_failed';
  message: string;
  stage: 'phase_create' | 'task_template';
}

export interface WorkflowProjectCreateResult {
  success: true;
  project: {
    id: number;
    name: string;
  };
  projectCreated: true;
  projectId: number;
  phasesCreated: number;
  tasksCreated: number;
  expectedPhases: number;
  expectedTasks: number;
  warnings: WorkflowWarning[];
}

interface WorkflowItemsOptions {
  includeClosedProjects?: boolean;
}

const CLOSED_PROJECT_STATUSES = new Set(['CANCELLED', 'ARCHIVED']);

function isClosedProjectStatus(status?: string | null): boolean {
  return CLOSED_PROJECT_STATUSES.has(String(status || '').trim().toUpperCase());
}


function toProjectPlaceholderSetting(project: WorkflowProject, warning?: WorkflowRequestError): WorkflowSetting {
  return {
    id: `project-${project.id}-phase-load-placeholder`,
    key: `PROJECT_${project.id}_PHASE_LOAD_PLACEHOLDER`,
    project_id: project.id,
    value: project.status || null,
    group_name: 'PRODUCTION_WORKFLOW_PROJECT_PLACEHOLDER',
    config_name: `${project.name} - Chưa tải được giai đoạn`,
    param_type: project.project_deadline || '',
    description: JSON.stringify({
      project_drive_link: project.drive_link || '',
      project_deadline: project.project_deadline || '',
      project_created_at: project.created_at || null,
      project_status: project.status || null,
      stage_name: 'Chưa tải được giai đoạn',
      stage_type: 'PHASE_LOAD_FAILED',
      phase_load_error_code: warning?.code || 'phase_load_failed',
      phase_load_failure_stage: warning?.failureStage || 'unknown',
      phase_load_message: 'Không thể tải giai đoạn.',
      tasks_list: [],
    }),
  };
}

function toWorkflowSetting(project: WorkflowProject, phase: WorkflowPhase): WorkflowSetting {
  const orderIndex = phase.order_index ?? 0;

  return {
    id: phase.id,
    key: `PROJECT_${project.id}_PHASE_${String(orderIndex).padStart(3, '0')}_${phase.id}`,
    project_id: project.id,
    phase_id: phase.id,
    value: phase.status || null,
    group_name: 'PRODUCTION_WORKFLOW',
    config_name: `${project.name} - ${phase.name}`,
    param_type: project.project_deadline || '',
    description: JSON.stringify({
      project_drive_link: project.drive_link || '',
      project_deadline: project.project_deadline || '',
      project_created_at: project.created_at || null,
      project_status: project.status || null,
      phase_created_at: phase.created_at || null,
      phase_order_index: phase.order_index ?? null,
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

export async function getWorkflowItems(options: WorkflowItemsOptions = {}): Promise<WorkflowSetting[]> {
  const includeClosedProjects = options.includeClosedProjects ?? true;
  const allProjects = await workflowRepository.listProjects();
  const projects = includeClosedProjects
    ? allProjects
    : allProjects.filter((project) => !isClosedProjectStatus(project.status));
  const projectIds = projects.map((project) => project.id);
  const [phaseResult, legacyTasks] = await Promise.all([
    workflowRepository.listPhasesByProjectIds(projectIds)
      .then((phases) => ({ phases, warning: null as WorkflowRequestError | null }))
      .catch((error: unknown) => ({
        phases: [] as WorkflowPhase[],
        warning: error instanceof WorkflowRequestError
          ? error
          : new WorkflowRequestError('Không thể tải giai đoạn.', 500, 'phase_load_failed', 'unknown'),
      })),
    workflowRepository.listLegacyTasks(),
  ]);
  const { phases, warning: phaseLoadWarning } = phaseResult;
  const projectNames = new Set(projects.map((project) => project.name));
  const visibleLegacyTasks = includeClosedProjects
    ? legacyTasks
    : legacyTasks.filter((task) => projectNames.has(task.projectName || task.project_name || ''));

  if (phaseLoadWarning) {
    return [
      ...projects.map((project) => toProjectPlaceholderSetting(project, phaseLoadWarning)),
      ...visibleLegacyTasks.map(toLegacyWorkflowSetting),
    ];
  }

  if (phases.length === 0) {
    return visibleLegacyTasks.map(toLegacyWorkflowSetting);
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
    ...visibleLegacyTasks.map(toLegacyWorkflowSetting),
  ];
}

export async function createWorkflowProject(
  params: WorkflowProjectInsertInput
): Promise<WorkflowProjectCreateResult> {
  const expectedPhases = params.phases.length;
  const expectedTasks = params.createTemplateTasks
    ? params.phases.reduce((sum, phase) => (
      sum + (phase.tasks || []).filter((task) => task.name?.trim()).length
    ), 0)
    : 0;

  const projectId = await workflowRepository.insertProject({
    projectName: params.projectName,
    projectDeadline: params.projectDeadline,
  });

  let phasesCreated = 0;
  let tasksCreated = 0;
  const warnings: WorkflowWarning[] = [];

  for (let index = 0; index < params.phases.length; index += 1) {
    const phase: WorkflowPhaseFormInput = params.phases[index];
    try {
      await workflowRepository.insertPhase({
        projectId,
        phaseName: phase.name?.trim() || `Giai đoạn ${index + 1}`,
        orderIndex: index,
        colorwayName: phase.colorway_name,
        colorwayCode: phase.colorway_code,
        stageType: phase.stage_type,
        stageOwner: phase.stage_owner,
        plannedStartDate: phase.planned_start_date,
        plannedEndDate: phase.planned_end_date,
        progress: phase.progress,
        nextAction: phase.next_action,
        requiredReview: phase.required_review,
      });
      phasesCreated += 1;
    } catch {
      warnings.push({
        code: 'phase_create_failed',
        message: 'Không thể tạo giai đoạn.',
        stage: 'phase_create',
      });
      break;
    }

    if (params.createTemplateTasks && (phase.tasks || []).some((task) => task.name?.trim())) {
      warnings.push({
        code: 'task_template_partial_failed',
        message: 'Dự án đã được tạo, nhưng một số công việc mẫu chưa được khởi tạo.',
        stage: 'task_template',
      });
    }
  }

  return {
    success: true,
    project: {
      id: projectId,
      name: params.projectName.trim(),
    },
    projectCreated: true,
    projectId,
    phasesCreated,
    tasksCreated,
    expectedPhases,
    expectedTasks,
    warnings,
  };
}

export async function updateWorkflowPhaseStatus(phaseId: number, status: string): Promise<void> {
  await workflowRepository.updatePhaseStatus(phaseId, status);
}

export async function updateWorkflowPhase(params: {
  projectId: number;
  phaseId: number;
  phaseName?: string;
  orderIndex?: number;
}): Promise<void> {
  await workflowRepository.updatePhase(params);
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

export async function cancelWorkflowProject(projectId: number): Promise<void> {
  await workflowRepository.deleteProject(projectId);
}
