import type { ReactNode } from 'react';

export function ProjectPageHeader({
  icon,
  eyebrow,
  title,
  description,
  actions,
}: {
  icon?: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
  description: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="project-page-header">
      <div className="min-w-0">
        {eyebrow && <div className="mb-3">{eyebrow}</div>}
        <div className="flex items-start gap-3">
          {icon && <div className="project-page-header__icon">{icon}</div>}
          <div className="min-w-0">
            <h1 className="project-page-title">{title}</h1>
            <p className="project-page-description">{description}</p>
          </div>
        </div>
      </div>
      {actions && <div className="project-page-actions">{actions}</div>}
    </header>
  );
}

export function ProjectMetricCard({
  label,
  value,
  icon,
  valueClassName = 'text-slate-100',
}: {
  label: ReactNode;
  value: ReactNode;
  icon?: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="project-metric-card">
      <div className="min-w-0">
        <p className="project-metric-card__label">{label}</p>
        <p className={`project-metric-card__value ${valueClassName}`}>{value}</p>
      </div>
      {icon && <div className="project-metric-card__icon">{icon}</div>}
    </div>
  );
}

export function ProjectPanel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return <section className={`project-panel ${className}`}>{children}</section>;
}
