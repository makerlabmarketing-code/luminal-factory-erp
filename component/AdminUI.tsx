import type { ElementType, ReactNode } from "react";

const metricToneClasses = {
  neutral: "text-slate-100",
  cyan: "text-cyan-300",
  emerald: "text-emerald-300",
  amber: "text-amber-300",
  red: "text-red-300",
} as const;

export function AdminPage({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`admin-page ${className}`}>{children}</div>;
}

export function AdminPageHeader({
  title, description, icon: Icon, actions,
}: { title: string; description?: string; icon?: ElementType; actions?: ReactNode }) {
  return <header className="admin-page-header">
    <div className="min-w-0">
      <div className="flex items-center gap-2.5">{Icon && <Icon className="h-5 w-5 text-blue-400" aria-hidden="true" />}<h1 className="admin-page-title">{title}</h1></div>
      {description && <p className="admin-page-description">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
  </header>;
}

export function AdminSkeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`admin-skeleton ${className}`} aria-hidden="true" />;
}

export function AdminMetricCard({
  label,
  value,
  supportingText,
  icon,
  tone = "neutral",
  featured = false,
}: {
  label: string;
  value: ReactNode;
  supportingText?: string;
  icon?: ReactNode;
  tone?: keyof typeof metricToneClasses;
  featured?: boolean;
}) {
  return (
    <article className={`admin-metric-card ${featured ? "admin-metric-card-featured" : ""}`}>
      <div className="min-w-0">
        <p className="admin-metric-card-label">{label}</p>
        <p className={`admin-metric-card-value ${metricToneClasses[tone]}`}>{value}</p>
        {supportingText ? <p className="admin-metric-card-supporting">{supportingText}</p> : null}
      </div>
      {icon ? <div className="admin-metric-card-icon">{icon}</div> : null}
    </article>
  );
}

export function AdminPanel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`admin-panel ${className}`}>{children}</section>;
}

export function AdminPanelHeader({ title, description }: { title: string; description?: string }) {
  return (
    <header className="admin-panel-header">
      <h2 className="text-sm font-bold text-slate-100">{title}</h2>
      {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
    </header>
  );
}
