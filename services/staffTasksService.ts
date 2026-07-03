import { supabase } from '@/lib/supabase';
import type {
  EditableWorkflowTask,
  StaffEmployee,
  WorkflowDescription,
  WorkflowSetting,
} from '@/lib/types/staff';
import { getStaffEmployeeByToken } from '@/services/staffPortalService';

const WORKFLOW_GROUP_NAME = 'PRODUCTION_WORKFLOW';

export function parseWorkflowDescription(description?: string | null): WorkflowDescription {
  try {
    const parsed = JSON.parse(description || '{}') as WorkflowDescription;

    return {
      project_drive_link: parsed.project_drive_link || '',
      project_deadline: parsed.project_deadline || '',
      tasks_list: Array.isArray(parsed.tasks_list) ? parsed.tasks_list : [],
    };
  } catch {
    return {
      project_drive_link: '',
      project_deadline: '',
      tasks_list: [],
    };
  }
}

export async function getStaffTasksData(params: {
  token?: string | null;
  workerData?: StaffEmployee | null;
}): Promise<{
  workerName: string;
  workflowItems: WorkflowSetting[];
}> {
  let employee = params.workerData || null;

  if (!employee && params.token) {
    employee = await getStaffEmployeeByToken(params.token);
  }

  if (!employee) {
    return {
      workerName: '',
      workflowItems: [],
    };
  }

  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('group_name', WORKFLOW_GROUP_NAME);

  if (error) throw error;

  return {
    workerName: employee.full_name,
    workflowItems: (data || []) as WorkflowSetting[],
  };
}

export function buildWorkflowEditMaps(workflowItems: WorkflowSetting[]): {
  driveInputs: Record<string, string>;
  editableTasks: Record<string, EditableWorkflowTask>;
} {
  const driveInputs: Record<string, string> = {};
  const editableTasks: Record<string, EditableWorkflowTask> = {};

  workflowItems.forEach((item) => {
    const parsed = parseWorkflowDescription(item.description);

    driveInputs[item.key] = parsed.project_drive_link || '';

    parsed.tasks_list?.forEach((task, index) => {
      editableTasks[`${item.key}_TASK_${index}`] = {
        status: task.status || 'TODO',
        deadline: task.deadline || '',
        note: task.note || '',
      };
    });
  });

  return {
    driveInputs,
    editableTasks,
  };
}

export function groupWorkflowByProject(
  workflowItems: WorkflowSetting[]
): Record<string, WorkflowSetting[]> {
  const groups: Record<string, WorkflowSetting[]> = {};

  workflowItems.forEach((item) => {
    if (!item.config_name) return;

    const projectName = item.config_name.split(' - ')[0];

    if (!groups[projectName]) {
      groups[projectName] = [];
    }

    groups[projectName].push(item);
  });

  return groups;
}

export function getTaskStats(params: {
  workflowItems: WorkflowSetting[];
  workerName: string;
}): {
  total: number;
  done: number;
  pending: number;
} {
  let total = 0;
  let done = 0;
  let pending = 0;

  params.workflowItems.forEach((item) => {
    const parsed = parseWorkflowDescription(item.description);

    parsed.tasks_list?.forEach((task) => {
      if (task.assignee !== params.workerName) return;

      total += 1;

      if (task.status === 'DONE') {
        done += 1;
      } else {
        pending += 1;
      }
    });
  });

  return {
    total,
    done,
    pending,
  };
}

export async function updateStaffWorkflowTask(params: {
  item: WorkflowSetting;
  taskIndex: number;
  bufferedTask: EditableWorkflowTask;
}): Promise<string> {
  const parsed = parseWorkflowDescription(params.item.description);

  if (!parsed.tasks_list || !parsed.tasks_list[params.taskIndex]) {
    throw new Error('Không tìm thấy đầu việc cần cập nhật.');
  }

  parsed.tasks_list[params.taskIndex] = {
    ...parsed.tasks_list[params.taskIndex],
    status: params.bufferedTask.status,
    deadline: params.bufferedTask.deadline,
    note: params.bufferedTask.note,
  };

  const updatedDescription = JSON.stringify(parsed);

  const { error } = await supabase
    .from('system_settings')
    .update({
      description: updatedDescription,
    })
    .eq('key', params.item.key);

  if (error) throw error;

  return updatedDescription;
}

export async function updateProjectDriveLink(params: {
  projectName: string;
  driveLink: string;
}): Promise<void> {
  const { data, error } = await supabase
    .from('system_settings')
    .select('*')
    .eq('group_name', WORKFLOW_GROUP_NAME)
    .like('config_name', `${params.projectName}%`);

  if (error) throw error;

  const phases = (data || []) as WorkflowSetting[];

  await Promise.all(
    phases.map(async (phase) => {
      const parsed = parseWorkflowDescription(phase.description);
      parsed.project_drive_link = params.driveLink;

      const { error: updateError } = await supabase
        .from('system_settings')
        .update({
          description: JSON.stringify(parsed),
        })
        .eq('key', phase.key);

      if (updateError) throw updateError;
    })
  );
}