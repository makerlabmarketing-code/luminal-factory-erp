import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

export interface StaffProfileDatabaseUpdate {
  phone?: string;
  bank_name?: string;
  bank_account_number?: string;
}

export interface MutationTrace {
  clientCreationCompleted: boolean;
  updateBuilderCreated: boolean;
  networkExecutionBegan: boolean;
  resultErrorReturned: boolean;
  readbackBegan: boolean;
}

export function buildStaffProfileDatabaseUpdate(body: Record<string, unknown>, clean: (value: unknown) => string): StaffProfileDatabaseUpdate {
  const payload: StaffProfileDatabaseUpdate = {};
  if (Object.prototype.hasOwnProperty.call(body, 'phone')) payload.phone = clean(body.phone);
  if (Object.prototype.hasOwnProperty.call(body, 'bankName')) payload.bank_name = clean(body.bankName);
  if (Object.prototype.hasOwnProperty.call(body, 'bankAccountNumber')) payload.bank_account_number = clean(body.bankAccountNumber);
  return payload;
}

type ErrorRecord = Record<string, unknown>;
const asRecord = (value: unknown): ErrorRecord | null => typeof value === 'object' && value !== null ? value as ErrorRecord : null;
const safeToken = (value: unknown, fallback: string | null = null) =>
  typeof value === 'string' && /^[A-Za-z0-9_.-]{1,80}$/.test(value) ? value : fallback;

function messageCategory(value: unknown): string {
  const message = (value instanceof Error ? value.message : typeof value === 'string' ? value : String(asRecord(value)?.message || '')).toLowerCase();
  if (/fetch|network|socket|connect|timeout|econn|enotfound/.test(message)) return 'network';
  if (/url|invalid url/.test(message)) return 'invalid_url';
  if (/key|credential|jwt|secret|unauthorized|forbidden/.test(message)) return 'credential_or_authorization';
  if (/serializ|json|circular/.test(message)) return 'serialization';
  if (/column|schema|relation/.test(message)) return 'schema_contract';
  if (/null|constraint|duplicate/.test(message)) return 'database_constraint';
  return message ? 'other' : 'unavailable';
}

export function sanitizePersistenceFailure(error: unknown) {
  const record = asRecord(error);
  const constructorName = record?.constructor && typeof record.constructor === 'function' ? record.constructor.name : null;
  const status = typeof record?.status === 'number' ? record.status : typeof record?.statusCode === 'number' ? record.statusCode : null;
  return {
    exceptionType: error === null ? 'null' : Array.isArray(error) ? 'array' : typeof error,
    exceptionName: error instanceof Error ? error.name : safeToken(record?.name, constructorName || (typeof error === 'string' ? 'StringException' : 'PlainObjectException')),
    messageCategory: messageCategory(error),
    supabaseErrorCode: safeToken(record?.code),
    supabaseDetailsCategory: messageCategory(record?.details),
    supabaseHintCategory: messageCategory(record?.hint),
    httpStatus: status,
  };
}

export async function persistStaffProfile(
  supabase: Pick<SupabaseClient, 'from'>,
  employeeId: string | number,
  payload: StaffProfileDatabaseUpdate,
  trace: MutationTrace
) {
  let query: unknown;
  try {
    query = supabase.from('employees').update(payload).eq('id', employeeId);
    trace.updateBuilderCreated = true;
  } catch (error) {
    throw Object.assign(new Error('employee_core_mutation_failed', { cause: error }), { code: 'employee_core_mutation_failed', diagnosticCause: error });
  }

  trace.networkExecutionBegan = true;
  let mutationResult: { error: unknown };
  try {
    mutationResult = await query as { error: unknown };
  } catch (error) {
    throw Object.assign(new Error('employee_core_mutation_failed', { cause: error }), { code: 'employee_core_mutation_failed', diagnosticCause: error });
  }
  if (mutationResult.error) {
    trace.resultErrorReturned = true;
    throw Object.assign(new Error('employee_core_mutation_failed', { cause: mutationResult.error }), { code: 'employee_core_mutation_failed', diagnosticCause: mutationResult.error, resultErrorReturned: true });
  }

  trace.readbackBegan = true;
  try {
    const readback = await supabase.from('employees').select('phone, bank_name, bank_account_number').eq('id', employeeId).maybeSingle();
    return { data: readback.data, readbackError: readback.error };
  } catch (error) {
    return { data: null, readbackError: error };
  }
}
