import type { ReactNode } from 'react';
import { PeopleOperationsLayout } from '@/component/PeopleOperationsLayout';

export default function EmployeesLayout({ children }: { children: ReactNode }) {
  return <PeopleOperationsLayout>{children}</PeopleOperationsLayout>;
}
