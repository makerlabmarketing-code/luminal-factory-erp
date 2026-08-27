import type { ReactNode } from 'react';
import styles from './PeopleOperationsLayout.module.css';

export function PeopleOperationsLayout({ children }: { children: ReactNode }) {
  return <div className={styles.surface}>{children}</div>;
}
