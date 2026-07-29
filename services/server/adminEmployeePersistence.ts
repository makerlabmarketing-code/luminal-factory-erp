import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export type AdminEmployeeDatabaseUpdate = Partial<{
  full_name: string;
  email: string;
  title: string | null;
  phone: string | null;
  branch_code: string | null;
  status: string;
}>;

export interface AdminMutationTrace {
  requestReachedSupabase: boolean;
  rowUpdated: boolean;
}

type ErrorRecord = Record<string, unknown>;
const asRecord = (value: unknown): ErrorRecord | null => typeof value === 'object' && value !== null ? value as ErrorRecord : null;
const safeToken = (value: unknown, fallback: string | null = null) =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : fallback;

function category(error: unknown): string {
  const record = asRecord(error);
  const message = (error instanceof Error ? error.message : typeof error === 'string' ? error : String(record?.message || '')).toLowerCase();
  if (/fetch|network|socket|connect|timeout|econn|enotfound/.test(message)) return 'network';
  if (/column|schema|relation|cache/.test(message)) return 'schema_contract';
  if (/constraint|null|duplicate|foreign key|unique/.test(message)) return 'database_constraint';
  if (/permission|unauthorized|forbidden|jwt|credential|key/.test(message)) return 'permission_or_credential';
  if (/json|decode|serializ/.test(message)) return 'result_decode';
  return message ? 'other' : 'unavailable';
}

export function sanitizeAdminMutationFailure(error: unknown) {
  const record = asRecord(error);
  const status = typeof record?.status === 'number' ? record.status : typeof record?.statusCode === 'number' ? record.statusCode : null;
  return {
    exceptionType: error === null ? 'null' : Array.isArray(error) ? 'array' : typeof error,
    exceptionName: error instanceof Error ? error.name : safeToken(record?.name, typeof error === 'string' ? 'StringException' : 'PlainObjectException'),
    errorCategory: category(error),
    supabaseErrorCode: safeToken(record?.code),
    httpStatus: status,
  };
}

export async function persistAdminEmployee(
  supabase: Pick<SupabaseClient, 'from'>,
  employeeId: string,
  payload: AdminEmployeeDatabaseUpdate,
  trace: AdminMutationTrace
) {
  let mutationQuery: unknown;
  try {
    mutationQuery = supabase.from('employees').update(payload).eq('id', employeeId);
  } catch (error) {
    throw Object.assign(new Error('employee_query_construction_failed', { cause: error }), { failureStage: 'query_construction', diagnosticCause: error });
  }

  trace.requestReachedSupabase = true;
  let mutationResult: { error: unknown };
  try {
    mutationResult = await mutationQuery as { error: unknown };
  } catch (error) {
    throw Object.assign(new Error('employee_core_mutation_failed', { cause: error }), { failureStage: 'core_mutation', diagnosticCause: error });
  }
  if (mutationResult.error) {
    throw Object.assign(new Error('employee_core_mutation_failed', { cause: mutationResult.error }), { failureStage: 'core_mutation', diagnosticCause: mutationResult.error });
  }
  trace.rowUpdated = true;

  try {
    const readback = await supabase.from('employees')
      .select('id, full_name, email, title, phone, status, is_active, auth_user_id, branch_code')
      .eq('id', employeeId)
      .maybeSingle();
    return { data: readback.data, readbackError: readback.error };
  } catch (error) {
    return { data: null, readbackError: error };
  }
}
