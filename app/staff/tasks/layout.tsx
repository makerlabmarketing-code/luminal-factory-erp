import type { ReactNode } from 'react';
import './task-workspace.css';

export default function StaffTasksLayout({ children }: { children: ReactNode }) {
  return <div className="task-workspace">{children}</div>;
}
