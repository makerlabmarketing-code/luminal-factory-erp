export type WorkflowTaskStatus = 'TODO' | 'DOING' | 'DONE' | string;

export interface WorkflowTask {
  id?: number;
  phase_id?: number | null;
  name?: string;
  projectName?: string | null;
  assignee?: string;
  assignee_id?: number | string | null;
  assignee_name?: string;
  assignedToText?: string | null;
  packerAssignedText?: string | null;
  currentPhaseText?: string | null;
  estimationDate?: string | null;
  issueNote?: string | null;
  createdAt?: string | null;
  status?: WorkflowTaskStatus;
  deadline?: string;
  note?: string;
}

export interface WorkflowDescription {
  project_drive_link?: string;
  project_deadline?: string;
  project_created_at?: string | null;
  project_status?: string | null;
  phase_created_at?: string | null;
  phase_order_index?: number | null;
  colorway_name?: string;
  colorway_code?: string;
  target_release_date?: string;
  stage_name?: string;
  stage_type?: string;
  stage_owner?: string;
  stage_deadline?: string;
  next_action?: string;
  tasks_list?: WorkflowTask[];
}

export interface WorkflowSetting {
  id?: number | string;
  key: string;
  project_id?: number;
  phase_id?: number;
  value?: string | null;
  group_name?: string | null;
  config_name?: string | null;
  param_type?: string | null;
  description?: string | null;
}

export interface EditableWorkflowTask {
  status: string;
  deadline: string;
  note: string;
}

export interface WorkflowProject {
  id: number;
  name: string;
  status?: string | null;
  created_at?: string | null;
  project_deadline?: string | null;
  drive_link?: string | null;
  phases?: WorkflowPhase[];
}

export interface WorkflowPhase {
  id: number;
  project_id: number;
  name: string;
  order_index?: number | null;
  created_at?: string | null;
  status?: string | null;
  colorway_name?: string | null;
  colorway_code?: string | null;
  stage_type?: string | null;
  stage_owner?: string | null;
  planned_start_date?: string | null;
  planned_end_date?: string | null;
  actual_start_date?: string | null;
  actual_end_date?: string | null;
  progress?: number | null;
  next_action?: string | null;
  required_review?: boolean | null;
  tasks?: WorkflowTask[];
}

export type WorkflowProjectRow = WorkflowProject;
export type WorkflowPhaseRow = WorkflowPhase;
export type WorkflowTaskRow = WorkflowTask;

export interface WorkflowProjectInsertInput {
  projectName: string;
  projectDeadline: string;
  phases: WorkflowPhaseFormInput[];
  createTemplateTasks?: boolean;
}

export interface WorkflowPhaseFormInput {
  name?: string;
  colorway_name?: string;
  colorway_code?: string;
  stage_type?: string;
  stage_owner?: string;
  planned_start_date?: string;
  planned_end_date?: string;
  progress?: number;
  next_action?: string;
  required_review?: boolean;
  tasks?: WorkflowTask[];
}
