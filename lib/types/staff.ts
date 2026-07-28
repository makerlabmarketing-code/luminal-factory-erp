import type { Employee } from '@/lib/types/employee';
import type { Facility } from '@/lib/types/facility';
import type { FinancialLedgerEntry } from '@/lib/types/finance';

export interface StaffPortalState {}

export interface StaffSession {}

export interface StaffNavigationItem {}
export type StaffPortalTab = 'attendance' | 'tasks' | 'expenses' | 'payroll' | 'profile';

export type StaffEmployee = Employee;
export type StaffBranch = Facility;
export type StaffExpense = FinancialLedgerEntry;
export type StaffFacility = Facility;
export type { FinancialLedgerEntry };
