import type { WorkflowPhaseFormInput } from '@/lib/types/workflow';

export interface ChecklistTaskOverride { employeeId?: string; deadline?: string; note?: string }
export interface ProjectChecklistStage {
  name: string;
  type: string;
  weight: number;
  requiresReview?: boolean;
  taskNames: string[];
  employeeId?: string;
  deadline?: string;
  taskOverrides?: Record<number, ChecklistTaskOverride>;
}

/** Overrides travel with their stage; removing a row cannot reassign the next task. */
export function removeChecklistTask(stage: ProjectChecklistStage, index: number): ProjectChecklistStage {
  const overrides: Record<number, ChecklistTaskOverride> = {};
  Object.entries(stage.taskOverrides || {}).forEach(([key, value]) => {
    const position = Number(key);
    if (position !== index) overrides[position > index ? position - 1 : position] = value;
  });
  return { ...stage, taskNames: stage.taskNames.filter((_, position) => position !== index), taskOverrides: overrides };
}

export function buildChecklistPhases(params: {
  stages: ProjectChecklistStage[];
  managerEmployeeId: string;
  colorwayName: string;
  employees: Array<{ employeeId: number; fullName: string }>;
  defaultDeadline: (index: number, count: number) => string;
}): WorkflowPhaseFormInput[] {
  return params.stages.map((stage, index, stages) => {
    const employeeId = stage.employeeId || params.managerEmployeeId;
    const deadline = stage.deadline || params.defaultDeadline(index, stages.length);
    return {
      name: stage.name.trim(), colorway_name: params.colorwayName.trim(), stage_type: stage.type,
      stage_owner: params.employees.find((employee) => String(employee.employeeId) === employeeId)?.fullName || '',
      planned_end_date: deadline, progress: 0, next_action: stage.taskNames[0] || stage.name,
      required_review: Boolean(stage.requiresReview),
      tasks: stage.taskNames.map((name, taskIndex) => {
        const override = stage.taskOverrides?.[taskIndex];
        const assigneeId = Number(override?.employeeId || employeeId);
        return { name: name.trim(), assignee_id: assigneeId,
          assignee_name: params.employees.find((employee) => employee.employeeId === assigneeId)?.fullName || '',
          deadline: override?.deadline || deadline, note: override?.note || '', status: 'TODO' };
      }),
    };
  });
}

/** Copy structure only. No old people, dates, results, notes or status. */
export function projectTemplateStructure(phases: Array<{ id: number; name: string; required_review?: boolean | null }>, tasks: Array<{ phase_id: number | null; title: string; is_required?: boolean | null; requires_review?: boolean | null }>) {
  return phases.map((phase, index) => ({
    name: phase.name, orderIndex: index + 1, startOffsetDays: null, durationDays: null,
    requiresReview: phase.required_review === true,
    tasks: tasks.filter((task) => task.phase_id === phase.id).map((task, taskIndex) => ({
      name: task.title, orderIndex: taskIndex + 1, startOffsetDays: null,
      isRequired: task.is_required !== false, requiresReview: task.requires_review === true,
      assigneeRoleCode: 'PROJECT_MANAGER',
    })),
  }));
}

/** The atomic RPC consumes camelCase fields and stable client-side phase links. */
export function serializeProjectChecklist(phases: WorkflowPhaseFormInput[]) {
  return {
    phases: phases.map((phase, index) => ({
      clientId: `stage-${index}`, name: phase.name, orderIndex: index + 1,
      colorwayName: phase.colorway_name, stageType: phase.stage_type, stageOwner: phase.stage_owner,
      plannedStartDate: phase.planned_start_date || null, plannedEndDate: phase.planned_end_date || null,
      requiresReview: phase.required_review === true,
    })),
    tasks: phases.flatMap((phase, index) => (phase.tasks || []).map((task, taskIndex) => ({
      clientId: `stage-${index}-task-${taskIndex}`, phaseClientId: `stage-${index}`,
      title: task.name, assigneeEmployeeId: task.assignee_id ? Number(task.assignee_id) : null,
      deadline: task.deadline || null, description: task.note || null,
      status: 'BACKLOG', isRequired: true, requiresReview: phase.required_review === true,
    }))),
    memberEmployeeIds: Array.from(new Set(phases.flatMap((phase) => (phase.tasks || []).flatMap((task) => task.assignee_id ? [Number(task.assignee_id)] : [])))),
  };
}
