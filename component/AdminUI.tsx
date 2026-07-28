import type { ElementType, ReactNode } from "react";

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
