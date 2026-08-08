import type { Employee } from '@/lib/types/employee';
import type {
  EditableWorkflowTask,
  WorkflowDescription,
  WorkflowSetting,
} from '@/lib/types/workflow';

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
  workerData?: Employee | null;
}): Promise<{
  workerId: number | string | null;
  workerName: string;
  workflowItems: WorkflowSetting[];
}> {
  const employee = params.workerData || null;

  if (!employee) {
    return {
      workerId: null,
      workerName: '',
      workflowItems: [],
    };
  }

  const response = await fetch('/api/staff/tasks', { cache: 'no-store' });
  const payload = await response.json().catch(() => null) as {
    workerId?: number;
    workerName?: string;
    workflowItems?: WorkflowSetting[];
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể tải công việc được giao.');
  }

  return {
    workerId: payload?.workerId ?? employee.employee_id ?? employee.id ?? null,
    workerName: payload?.workerName || employee.full_name,
    workflowItems: payload?.workflowItems || [],
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
        note: '',
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
  workerId?: number | string | null;
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
      const matchesById =
        params.workerId !== null &&
        params.workerId !== undefined &&
        task.assignee_id !== null &&
        task.assignee_id !== undefined &&
        String(task.assignee_id) === String(params.workerId);

      if (!matchesById) return;

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

  const task = parsed.tasks_list[params.taskIndex];
  if (!task.id) {
    throw new Error('Không tìm thấy ID đầu việc cần cập nhật.');
  }

  const note = params.bufferedTask.note.trim();
  if (!note) {
    throw new Error('Vui lòng nhập nội dung báo cáo tiến độ.');
  }

  const response = await fetch('/api/staff/tasks', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      taskId: task.id,
      status: params.bufferedTask.status,
      deadline: params.bufferedTask.deadline || null,
      note,
    }),
  });
  const payload = await response.json().catch(() => null) as {
    task?: { status?: string; deadline?: string };
    message?: string;
  } | null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Không thể cập nhật đầu việc.');
  }

  parsed.tasks_list[params.taskIndex] = {
    ...task,
    status: payload?.task?.status || params.bufferedTask.status,
    deadline: payload?.task?.deadline ?? params.bufferedTask.deadline,
    note: '',
  };

  return JSON.stringify(parsed);
}

export async function updateProjectDriveLink(): Promise<void> {
  throw new Error('Nhân viên chỉ được cập nhật công việc được giao. Link Drive dự án do quản lý dự án cập nhật.');
}
