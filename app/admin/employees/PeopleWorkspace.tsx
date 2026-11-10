'use client';

import { useSearchParams } from 'next/navigation';
import { AdminPage } from '@/component/AdminUI';
import { EmployeeAdminTabs, type PeopleTab } from '@/component/admin/EmployeeAdminTabs';
import CompetencyWorkspace from '@/component/competency-reviews/CompetencyWorkspace';
import { AdminListRequestError, useAdminListData } from '@/hooks/useAdminListData';
import type { AdminAccountManagementData } from '@/services/server/adminAccountManagement';
import type { AdminEmployeeListData } from '@/services/server/adminEmployeeData';
import AdminAccountsClient from '../accounts/AdminAccountsClient';
import AdminEmployeesClient from './AdminEmployeesClient';

async function requestEmployees(signal: AbortSignal): Promise<AdminEmployeeListData> {
  const response = await fetch('/api/admin/employees', { cache: 'no-store', credentials: 'include', signal });
  if (!response.ok) throw new AdminListRequestError(response.status === 403 ? 'forbidden' : 'employee_list_load_failed');
  return response.json();
}

async function requestAccounts(signal: AbortSignal): Promise<AdminAccountManagementData> {
  const response = await fetch('/api/admin/accounts', { cache: 'no-store', credentials: 'include', signal });
  if (!response.ok) throw new AdminListRequestError(response.status === 403 ? 'forbidden' : 'account_list_load_failed');
  return response.json();
}

export default function PeopleWorkspace({ initialData, initialError, showReviews }: {
  initialData?: AdminEmployeeListData;
  initialError?: 'forbidden' | 'employee_list_load_failed';
  showReviews: boolean;
}) {
  const params = useSearchParams();
  const requestedTab = params.get('tab');
  const active: PeopleTab = requestedTab === 'permissions' || (requestedTab === 'reviews' && showReviews)
    ? requestedTab
    : 'employees';
  const employee = params.get('employee') ?? '';
  const reviewEmployeeId = /^[1-9]\d*$/.test(employee) ? employee : '';

  const directory = useAdminListData({
    cacheKey: 'admin:employees', initialData, initialError, request: requestEmployees,
  });
  const accounts = useAdminListData({
    cacheKey: 'admin:accounts', request: requestAccounts,
  });
  const reviewEmployees = directory.data?.employees
    .filter(person => person.reviewEligible)
    .map(person => ({ id: person.employeeId, full_name: person.fullName }))
    .sort((first, second) => first.full_name.localeCompare(second.full_name, 'vi'));

  return (
    <AdminPage>
      <EmployeeAdminTabs active={active} showReviews={showReviews} />
      <div hidden={active !== 'employees'}>
        <AdminEmployeesClient directory={directory} onEmployeeChange={accounts.refresh} />
      </div>
      <div hidden={active !== 'permissions'}>
        <AdminAccountsClient
          accounts={accounts}
          employees={directory.error === 'forbidden' ? undefined : directory.data?.employees}
          onAccountChange={() => {
            if (directory.error !== 'forbidden') void directory.refresh();
          }}
        />
      </div>
      {active === 'reviews' && (
        <CompetencyWorkspace
          key={reviewEmployeeId}
          admin
          initialEmployeeId={reviewEmployeeId}
          reviewEmployees={reviewEmployees}
          rosterError={directory.error}
          onRetryRoster={directory.refresh}
        />
      )}
    </AdminPage>
  );
}
