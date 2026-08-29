import type { ReactNode } from 'react';
import './payroll-workspace.css';

export default function PayrollLayout({ children }: { children: ReactNode }) {
  return <div className="payroll-workspace">{children}</div>;
}
