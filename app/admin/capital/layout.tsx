import type { ReactNode } from 'react';
import './finance-workspace.css';

export default function CapitalLayout({ children }: { children: ReactNode }) {
  return <div className="finance-workspace">{children}</div>;
}
