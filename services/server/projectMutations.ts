import 'server-only';

import { createSupabaseAdminClient } from '@/utils/supabase/admin';
import { createClient as createSupabaseServerClient } from '@/utils/supabase/server';
import {
  AuthContext,
  AuthFlowError,
  hasPermission,
  requireWorkspaceAccess,
} from '@/services/server/auth';
import { requireProjectMembershipAction } from '@/services/server/projectMembershipAuthorization';
import { nextProjectCode, projectCodePrefix } from '@/lib/project-code';
import {
  getPublishedPhaseTemplateOptions,
  phaseTemplatesEnabled,
} from '@/services/server/phaseTemplates';

type ProjectMutationBody = Record<string, unknown>;
type ProjectRoleCode = 'PROJECT_OWNER' | 'PROJECT_MANAGER' | 'CREATIVE_LEAD' | 'CONTRIBUTOR';

interface ProjectRow {
  id: number;
  project_name?: string | null;
  status?: string | null;
  drive_url?: string | null;
  project_deadline?: string | null;
  created_at?: string | null;
}

export interface ProjectDetailCore {
  id: number;
  projectCode: string;
  name: string;
  colorway: string | null;
  projectDeadline: string | null;
  status: string | null;
  driveLink: string | null;
  createdAt: string | null;
}

interface ProjectMembershipRow {
  role_code?: ProjectRoleCode | string | null;
  status?: string | null;
}

export interface ProjectMutationResult {
  success: true;
  project?: Pick<ProjectDetailCore, 'id' | 'projectCode' | 'name' | 'colorway' | 'projectDeadline' | 'status'>;
  projectId: number;
  projectCode?: string;
  projectCreated?: boolean;
  managerMembershipCreated?: boolean;
  workflowCreated?: boolean;
  phasesCreated?: number;
  tasksCreated?: number;
  warnings?: string[];
  archived?: boolean;
  deadlinePersisted?: boolean;
}

const CREATE_PROJECT_KEYS = new Set([
  'projectName',
  'colorwayName',
  'description',
  'status',
  'startDate',
  'projectDeadline',
  'metadata',
  'phases',
  'tasks',
  'memberEmployeeIds',
  'managerEmployeeId',
  'templateVersionId',
]);

export function projectWorkflowCreationAvailable(): boolean {
  return process.env.PROJECT_WORKFLOW_ATOMIC_CREATE_ENABLED === 'true';
}

export async function getProjectCreationOptions() {
  await requireProjectManage();
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('employees')
    .select('id, full_name, title, status, is_active')
    .order('full_name', { ascending: true });
  if (error) {
    throw mutationError({ status: 500, message: 'Không thể tải danh sách nhân sự.', failureStage: 'employee_lookup', safeDetails: { supabase_error_code: error.code ?? 'unknown' } });
  }
  const employees = (data || []).filter((employee) => {
    const status = String(employee.status || '').trim().toUpperCase();
    return employee.is_active !== false && !['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED'].includes(status);
  }).map((employee) => ({ employeeId: Number(employee.id), fullName: employee.full_name || `Nhân sự #${employee.id}`, title: employee.title ?? null }));
  const phaseTemplateCreationAvailable = projectWorkflowCreationAvailable() && phaseTemplatesEnabled();
  const phaseTemplateOptions = phaseTemplateCreationAvailable
    ? await getPublishedPhaseTemplateOptions()
    : [];
  return {
    success: true,
    workflowCreationAvailable: projectWorkflowCreationAvailable(),
    phaseTemplatesEnabled: phaseTemplateCreationAvailable,
    phaseTemplateOptions,
    employees,
  };
}

const UPDATE_PROJECT_KEYS = new Set([
  'projectName',
  'description',
  'status',
  'startDate',
  'projectDeadline',
  'progress',
  'driveLink',
  'expectedUpdatedAt',
]);

const PROJECT_OWNER_FIELDS = new Set([
  'projectName',
  'description',
  'status',
  'startDate',
  'projectDeadline',
  'driveLink',
  'expectedUpdatedAt',
]);

const PROJECT_MANAGER_FIELDS = new Set([
  'status',
  'startDate',
  'projectDeadline',
  'progress',
  'driveLink',
  'expectedUpdatedAt',
]);

const VALID_PROJECT_STATUSES = new Set([
  'DRAFT',
  'PLANNING',
  'PROCESSING',
  'IN_PROGRESS',
  'BLOCKED',
  'ON_HOLD',
  'COMPLETED',
  'ARCHIVED',
  'CANCELLED',
]);

function mutationError({
  status,
  message,
  failureStage,
  code,
  safeDetails,
}: {
  status: number;
  message: string;
  failureStage: 'auth_get_user' | 'employee_lookup' | 'employee_status' | 'workspace_access' | 'permission_check' | 'payload_validation' | 'admin_client_creation' | 'project_insert' | 'unknown';
  code?: 'session_not_verified' | 'permission_forbidden' | 'admin_verification_failed' | 'payload_validation_failed' | 'project_insert_failed';
  safeDetails?: Record<string, boolean | number | string | null>;
}) {
  return new AuthFlowError({
    status,
    code: code || (
      status === 401
        ? 'session_not_verified'
        : status === 403
          ? 'permission_forbidden'
          : status === 422
            ? 'payload_validation_failed'
            : 'admin_verification_failed'
    ),
    message,
    failureStage,
    safeDetails,
  });
}

function assertKnownFields(body: ProjectMutationBody, allowedKeys: Set<string>) {
  const unknownKeys = Object.keys(body).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw mutationError({
      status: 422,
      message: 'Dữ liệu dự án có trường không được hỗ trợ.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
      safeDetails: {
        rejected_field_count: unknownKeys.length,
      },
    });
  }
}

function optionalText(value: unknown, fieldName: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    throw mutationError({
      status: 422,
      message: 'Dữ liệu dự án không hợp lệ.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
      safeDetails: {
        field: fieldName,
      },
    });
  }

  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function isIsoDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function optionalIsoDate(value: unknown, fieldName: string): string | null {
  const text = optionalText(value, fieldName);
  if (text === null) return null;

  if (!isIsoDateOnly(text)) {
    throw mutationError({
      status: 422,
      message: 'Ngày dự án không hợp lệ.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
      safeDetails: {
        field: fieldName,
      },
    });
  }

  return text;
}

function isMissingProjectDeadlineColumn(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const details = error as { code?: unknown; message?: unknown; details?: unknown; hint?: unknown };
  const code = typeof details.code === 'string' ? details.code : '';
  const errorText = [
    details.message,
    details.details,
    details.hint,
  ]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('en-US');

  return (code === '42703' || code === 'PGRST204') && errorText.includes('project_deadline');
}

function requiredProjectName(body: ProjectMutationBody): string {
  const projectName = optionalText(body.projectName, 'projectName');
  if (!projectName) {
    throw mutationError({
      status: 422,
      message: 'Vui lòng nhập tên dự án.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
      safeDetails: {
        field: 'projectName',
      },
    });
  }

  return projectName;
}

function validateStatus(value: unknown): string | null {
  const status = optionalText(value, 'status');
  if (!status) return null;

  const normalized = status.toUpperCase();
  if (!VALID_PROJECT_STATUSES.has(normalized)) {
    throw mutationError({
      status: 422,
      message: 'Trạng thái dự án không hợp lệ.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
      safeDetails: {
        field: 'status',
      },
    });
  }

  return normalized;
}

function validateDateOrder(body: ProjectMutationBody) {
  const startDate = optionalIsoDate(body.startDate, 'startDate');
  const projectDeadline = optionalIsoDate(body.projectDeadline, 'projectDeadline');

  if (!startDate || !projectDeadline) return;

  const start = new Date(startDate);
  const target = new Date(projectDeadline);

  if (target < start) {
    throw mutationError({
      status: 422,
      message: 'Ngày mục tiêu không được trước ngày bắt đầu.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
    });
  }
}

async function requireProjectManage() {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const canManage = await hasPermission(authContext, 'PROJECT_MANAGE');

  if (!canManage) {
    throw mutationError({
      status: 403,
      message: 'Bạn không có quyền quản lý dự án.',
      failureStage: 'permission_check',
      safeDetails: {
        permission: 'PROJECT_MANAGE',
      },
    });
  }

  return authContext;
}

function authEmployeeId(authContext: AuthContext): number {
  const id = Number(authContext.employee.id);
  if (!Number.isFinite(id)) {
    throw mutationError({
      status: 403,
      message: 'Không thể xác định nhân sự thao tác.',
      failureStage: 'employee_lookup',
    });
  }

  return id;
}

async function loadProject(projectId: number): Promise<ProjectRow> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('projects')
    .select('id, project_name, status, drive_url, project_deadline, created_at')
    .eq('id', projectId)
    .maybeSingle();

  if (error) {
    if (isMissingProjectDeadlineColumn(error)) {
      const fallback = await supabase
        .from('projects')
        .select('id, project_name, status, drive_url, created_at')
        .eq('id', projectId)
        .maybeSingle();

      if (!fallback.error && fallback.data) return fallback.data as ProjectRow;
    }

    throw mutationError({
      status: 500,
      message: 'Không thể tải dự án.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  if (!data) {
    throw mutationError({
      status: 404,
      message: 'Không tìm thấy dự án.',
      failureStage: 'unknown',
    });
  }

  return data as ProjectRow;
}

export async function getProjectDetail(rawProjectId: string): Promise<{ success: true; project: ProjectDetailCore }> {
  const projectId = numericProjectId(rawProjectId);
  await requireProjectMembershipAction(projectId, 'PROJECT_VIEW');
  const supabase = createSupabaseAdminClient();
  const primary = await supabase
    .from('projects')
    .select('id, project_code, project_name, status, drive_url, project_deadline, created_at')
    .eq('id', projectId)
    .maybeSingle();
  const fallback = primary.error && isMissingProjectDeadlineColumn(primary.error)
    ? await supabase.from('projects').select('id, project_code, project_name, status, drive_url, created_at').eq('id', projectId).maybeSingle()
    : null;
  const data = fallback ? fallback.data : primary.data;
  const error = fallback ? fallback.error : primary.error;
  if (error) {
    throw mutationError({ status: 500, message: 'Không thể tải thông tin dự án.', failureStage: 'unknown', safeDetails: { supabase_error_code: error.code ?? 'unknown' } });
  }
  if (!data) throw mutationError({ status: 404, message: 'Không tìm thấy dự án.', failureStage: 'unknown' });
  return {
    success: true,
    project: {
      id: Number(data.id), projectCode: String(data.project_code || ''), name: String(data.project_name || ''),
      colorway: null, projectDeadline: 'project_deadline' in data ? (data.project_deadline as string | null) ?? null : null, status: data.status ?? null,
      driveLink: data.drive_url ?? null, createdAt: data.created_at ?? null,
    },
  };
}

async function loadProjectRole(projectId: number, employeeId: number): Promise<ProjectRoleCode | null> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from('project_members')
    .select('role_code, status')
    .eq('project_id', projectId)
    .eq('employee_id', employeeId)
    .eq('status', 'ACTIVE');

  if (error) {
    throw mutationError({
      status: 500,
      message: 'Không thể kiểm tra vai trò dự án.',
      failureStage: 'permission_check',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  const roles = ((data || []) as ProjectMembershipRow[])
    .map((row) => row.role_code)
    .filter((role): role is ProjectRoleCode =>
      role === 'PROJECT_OWNER' ||
      role === 'PROJECT_MANAGER' ||
      role === 'CREATIVE_LEAD' ||
      role === 'CONTRIBUTOR'
    );

  if (roles.includes('PROJECT_OWNER')) return 'PROJECT_OWNER';
  if (roles.includes('PROJECT_MANAGER')) return 'PROJECT_MANAGER';
  if (roles.includes('CREATIVE_LEAD')) return 'CREATIVE_LEAD';
  if (roles.includes('CONTRIBUTOR')) return 'CONTRIBUTOR';

  return null;
}

async function canManageAnyProject(authContext: AuthContext): Promise<boolean> {
  return hasPermission(authContext, 'PROJECT_MANAGE');
}

function changedKeys(body: ProjectMutationBody, allowedKeys: Set<string>): string[] {
  return Object.keys(body).filter((key) => allowedKeys.has(key));
}

function assertRoleCanUpdateFields(role: ProjectRoleCode | null, body: ProjectMutationBody) {
  if (role === 'PROJECT_OWNER') {
    const blocked = changedKeys(body, UPDATE_PROJECT_KEYS).filter((key) => !PROJECT_OWNER_FIELDS.has(key));
    if (blocked.length === 0) return;
  }

  if (role === 'PROJECT_MANAGER') {
    const blocked = changedKeys(body, UPDATE_PROJECT_KEYS).filter((key) => !PROJECT_MANAGER_FIELDS.has(key));
    if (blocked.length === 0) return;
  }

  throw mutationError({
    status: 403,
    message: 'Bạn không có quyền cập nhật trường dự án này.',
    failureStage: 'permission_check',
    safeDetails: {
      project_role: role ?? 'none',
    },
  });
}

function projectUpdatePayload(body: ProjectMutationBody) {
  const payload: Record<string, string | null> = {};
  const projectName = optionalText(body.projectName, 'projectName');
  const driveLink = optionalText(body.driveLink, 'driveLink');
  const projectDeadline = optionalIsoDate(body.projectDeadline, 'projectDeadline');
  const status = validateStatus(body.status);

  if (projectName) payload.project_name = projectName;
  if (driveLink !== null) payload.drive_url = driveLink;
  if (Object.prototype.hasOwnProperty.call(body, 'projectDeadline')) {
    payload.project_deadline = projectDeadline;
  }
  if (status) payload.status = status;

  return payload;
}

async function insertProjectRow(params: {
  projectName: string;
  status: string;
  projectDeadline: string | null;
}): Promise<{ id: number; projectCode: string; deadlinePersisted: boolean }> {
  const supabase = createSupabaseAdminClient();
  const prefix = projectCodePrefix(new Date());

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await supabase
      .from('projects')
      .select('project_code')
      .like('project_code', `${prefix}%`);
    if (existing.error) {
      throw mutationError({ status: 500, message: 'Không thể tạo mã dự án.', failureStage: 'project_insert', code: 'project_insert_failed', safeDetails: { supabase_error_code: existing.error.code ?? 'unknown' } });
    }
    const projectCode = nextProjectCode(prefix, (existing.data || []).map((row) => String(row.project_code || '')));
    const basePayload = { project_name: params.projectName, project_code: projectCode, status: params.status, drive_url: '' };
    const payload = params.projectDeadline ? { ...basePayload, project_deadline: params.projectDeadline } : basePayload;
    const { data, error } = await supabase.from('projects').insert([payload]).select('id').single();

    if (!error && data) return { id: Number(data.id), projectCode, deadlinePersisted: Boolean(params.projectDeadline) };
    if (error?.code === '23505') continue;

    if (params.projectDeadline && isMissingProjectDeadlineColumn(error)) {
      const fallback = await supabase.from('projects').insert([basePayload]).select('id').single();
      if (!fallback.error && fallback.data) return { id: Number(fallback.data.id), projectCode, deadlinePersisted: false };
      if (fallback.error?.code === '23505') continue;

      throw mutationError({ status: 500, message: 'Không thể tạo dự án.', failureStage: 'project_insert', code: 'project_insert_failed', safeDetails: { supabase_error_code: fallback.error?.code ?? 'unknown' } });
    }

    throw mutationError({
      status: 500, message: 'Không thể tạo dự án.',
      failureStage: 'project_insert',
      code: 'project_insert_failed',
      safeDetails: { supabase_error_code: error?.code ?? 'unknown' },
    });
  }

  throw mutationError({
    status: 409,
    message: 'Không thể cấp mã dự án duy nhất. Vui lòng thử lại.',
    failureStage: 'project_insert',
    code: 'project_insert_failed',
  });
}

async function assertProjectMutationAccess(projectId: number, body: ProjectMutationBody) {
  const authContext = await requireWorkspaceAccess('ADMIN_WORKSPACE');
  const employeeId = authEmployeeId(authContext);
  const [canManage, role] = await Promise.all([
    canManageAnyProject(authContext),
    loadProjectRole(projectId, employeeId),
  ]);

  if (canManage) return authContext;

  assertRoleCanUpdateFields(role, body);
  return authContext;
}

function numericProjectId(rawProjectId: string): number {
  const projectId = Number(rawProjectId);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw mutationError({
      status: 422,
      message: 'Mã dự án không hợp lệ.',
      failureStage: 'payload_validation',
      code: 'payload_validation_failed',
    });
  }

  return projectId;
}


async function createProjectViaAtomicRpc(body: ProjectMutationBody): Promise<ProjectMutationResult> {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const prefix = projectCodePrefix(new Date());
  let data: unknown = null;
  let error: { code?: string } | null = null;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const existing = await admin.from('projects').select('project_code').like('project_code', `${prefix}%`);
    if (existing.error) throw mutationError({ status: 500, message: 'Không thể tạo mã dự án.', failureStage: 'project_insert', code: 'project_insert_failed' });
    const projectCode = nextProjectCode(prefix, (existing.data || []).map((row) => String(row.project_code || '')));
    const rpcResult = await supabase.rpc('create_project_atomic', { p_payload: { ...body, projectCode } });
    data = rpcResult.data;
    error = rpcResult.error;
    const rpcCode = data && typeof data === 'object' && 'code' in data ? String((data as { code?: unknown }).code || '') : '';
    if (!error && rpcCode !== 'duplicate_project_code') break;
    if (rpcCode !== 'duplicate_project_code' && error?.code !== '23505') break;
  }

  if (error) {
    throw mutationError({
      status: 500,
      message: 'Không thể tạo dự án đầy đủ.',
      failureStage: 'project_insert',
      code: 'project_insert_failed',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  const result = data as { success?: unknown; projectId?: unknown; projectCode?: unknown; deadlinePersisted?: unknown; managerMembershipCreated?: unknown; workflowCreated?: unknown; phasesCreated?: unknown; tasksCreated?: unknown; warnings?: unknown; code?: unknown; message?: unknown } | null;
  if (!result?.success) {
    const code = typeof result?.code === 'string' ? result.code : 'project_insert_failed';
    const message = typeof result?.message === 'string' ? result.message : 'Không thể tạo dự án đầy đủ.';
    throw mutationError({
      status: code === 'permission_forbidden' ? 403 : code === 'session_not_verified' ? 401 : code === 'duplicate_project_code' ? 409 : 422,
      message,
      failureStage: code === 'permission_forbidden' ? 'permission_check' : code === 'session_not_verified' ? 'auth_get_user' : 'project_insert',
      code: code === 'permission_forbidden' ? 'permission_forbidden' : code === 'session_not_verified' ? 'session_not_verified' : code === 'duplicate_project_code' ? 'project_insert_failed' : 'payload_validation_failed',
    });
  }

  const projectId = Number(result.projectId);
  if (!Number.isInteger(projectId) || projectId <= 0) {
    throw mutationError({
      status: 500,
      message: 'Không thể xác nhận dự án đã tạo.',
      failureStage: 'project_insert',
      code: 'project_insert_failed',
    });
  }

  return {
    success: true,
    project: { id: projectId, projectCode: String(result.projectCode || ''), name: requiredProjectName(body), colorway: optionalText(body.colorwayName, 'colorwayName'), projectDeadline: optionalIsoDate(body.projectDeadline, 'projectDeadline'), status: validateStatus(body.status) || 'PROCESSING' },
    projectId,
    projectCode: String(result.projectCode || ''),
    projectCreated: true,
    managerMembershipCreated: result.managerMembershipCreated !== false,
    workflowCreated: result.workflowCreated !== false,
    phasesCreated: Number(result.phasesCreated) || 0,
    tasksCreated: Number(result.tasksCreated) || 0,
    warnings: Array.isArray(result.warnings) ? result.warnings.filter((warning): warning is string => typeof warning === 'string') : [],
    deadlinePersisted: Boolean(result.deadlinePersisted),
  };
}

export async function createProject(body: ProjectMutationBody): Promise<ProjectMutationResult> {
  assertKnownFields(body, CREATE_PROJECT_KEYS);
  validateDateOrder(body);
  const authContext = await requireProjectManage();

  requiredProjectName(body);
  validateStatus(body.status);
  optionalIsoDate(body.projectDeadline, 'projectDeadline');
  const projectName = requiredProjectName(body);
  const templateVersionId = body.templateVersionId == null || body.templateVersionId === ''
    ? null
    : Number(body.templateVersionId);

  if (templateVersionId !== null && (!Number.isInteger(templateVersionId) || templateVersionId <= 0)) {
    throw mutationError({ status: 422, message: 'Mẫu giai đoạn không hợp lệ.', failureStage: 'payload_validation', code: 'payload_validation_failed' });
  }
  if (templateVersionId !== null && (!phaseTemplatesEnabled() || !projectWorkflowCreationAvailable())) {
    throw mutationError({ status: 422, message: 'Mẫu giai đoạn đang chờ kích hoạt.', failureStage: 'payload_validation', code: 'payload_validation_failed' });
  }
  if (templateVersionId !== null && !optionalIsoDate(body.startDate, 'startDate')) {
    throw mutationError({ status: 422, message: 'Vui lòng chọn ngày bắt đầu khi dùng mẫu giai đoạn.', failureStage: 'payload_validation', code: 'payload_validation_failed' });
  }
  if (templateVersionId !== null && (
    (Array.isArray(body.phases) && body.phases.length > 0)
    || (Array.isArray(body.tasks) && body.tasks.length > 0)
  )) {
    throw mutationError({ status: 422, message: 'Không thể dùng đồng thời mẫu giai đoạn và dữ liệu quy trình tùy chỉnh.', failureStage: 'payload_validation', code: 'payload_validation_failed' });
  }

  // Duplicate project names are allowed; stable project IDs remain the project identity.
  if (projectWorkflowCreationAvailable() && (
    templateVersionId !== null
    || (Array.isArray(body.phases) && body.phases.length > 0)
    || (Array.isArray(body.tasks) && body.tasks.length > 0)
  )) {
    return createProjectViaAtomicRpc(body);
  }

  const managerEmployeeId = Number(body.managerEmployeeId);
  if (!Number.isInteger(managerEmployeeId) || managerEmployeeId <= 0) {
    throw mutationError({ status: 422, message: 'Vui lòng chọn người phụ trách.', failureStage: 'payload_validation', code: 'payload_validation_failed' });
  }
  const supabase = createSupabaseAdminClient();
  const employeeResult = await supabase.from('employees').select('id, status, is_active').eq('id', managerEmployeeId).maybeSingle();
  const employeeStatus = String(employeeResult.data?.status || '').trim().toUpperCase();
  if (employeeResult.error || !employeeResult.data || employeeResult.data.is_active === false || ['INACTIVE', 'LOCKED', 'DISABLED', 'DELETED'].includes(employeeStatus)) {
    throw mutationError({ status: 422, message: 'Người phụ trách không còn hoạt động.', failureStage: 'employee_status', code: 'payload_validation_failed' });
  }
  const inserted = await insertProjectRow({ projectName, status: validateStatus(body.status) || 'PROCESSING', projectDeadline: optionalIsoDate(body.projectDeadline, 'projectDeadline') });
  const membership = await supabase.from('project_members').insert([{ project_id: inserted.id, employee_id: managerEmployeeId, role_code: 'PROJECT_MANAGER', status: 'ACTIVE', granted_by_employee_id: authEmployeeId(authContext) }]);
  const managerMembershipCreated = !membership.error;
  return {
    success: true,
    project: { id: inserted.id, projectCode: inserted.projectCode, name: projectName, colorway: optionalText(body.colorwayName, 'colorwayName'), projectDeadline: optionalIsoDate(body.projectDeadline, 'projectDeadline'), status: validateStatus(body.status) || 'PROCESSING' },
    projectId: inserted.id,
    projectCode: inserted.projectCode,
    projectCreated: true,
    managerMembershipCreated,
    workflowCreated: false,
    phasesCreated: 0,
    tasksCreated: 0,
    warnings: managerMembershipCreated ? [] : ['Dự án đã được tạo nhưng chưa thể thêm người phụ trách.'],
    deadlinePersisted: inserted.deadlinePersisted,
  };
}

export async function updateProject(
  rawProjectId: string,
  body: ProjectMutationBody
): Promise<ProjectMutationResult> {
  assertKnownFields(body, UPDATE_PROJECT_KEYS);
  validateDateOrder(body);

  const projectId = numericProjectId(rawProjectId);
  const project = await loadProject(projectId);
  if (project.status === 'ARCHIVED' || project.status === 'CANCELLED') {
    throw mutationError({
      status: 409,
      message: 'Dự án đã đóng, không thể cập nhật trực tiếp.',
      failureStage: 'unknown',
    });
  }

  if (body.expectedUpdatedAt !== undefined) {
    throw mutationError({
      status: 409,
      message: 'Dự án chưa có trường updated_at để kiểm tra cập nhật đồng thời.',
      failureStage: 'unknown',
      safeDetails: {
        concurrency_supported: false,
      },
    });
  }

  await assertProjectMutationAccess(projectId, body);

  const payload = projectUpdatePayload(body);
  if (Object.keys(payload).length === 0) {
    return { success: true, projectId };
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from('projects').update(payload).eq('id', projectId);
  if (error) {
    if (payload.project_deadline !== undefined && isMissingProjectDeadlineColumn(error)) {
      throw mutationError({
        status: 409,
        message: 'Dự án chưa có trường deadline tổng. Cần chạy migration project_deadline trước khi lưu deadline.',
        failureStage: 'unknown',
        safeDetails: {
          project_deadline_supported: false,
        },
      });
    }

    throw mutationError({
      status: 500,
      message: 'Không thể cập nhật dự án.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  return { success: true, projectId };
}

export async function cancelProject(rawProjectId: string): Promise<ProjectMutationResult> {
  const projectId = numericProjectId(rawProjectId);
  const project = await loadProject(projectId);
  if (project.status === 'CANCELLED') {
    return {
      success: true,
      projectId,
      archived: true,
    };
  }

  await assertProjectMutationAccess(projectId, { status: 'CANCELLED' });

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from('projects')
    .update({ status: 'CANCELLED' })
    .eq('id', projectId);

  if (error) {
    throw mutationError({
      status: 500,
      message: 'Không thể lưu trữ dự án.',
      failureStage: 'unknown',
      safeDetails: {
        supabase_error_code: error.code ?? 'unknown',
      },
    });
  }

  return {
    success: true,
    projectId,
    archived: true,
  };
}
