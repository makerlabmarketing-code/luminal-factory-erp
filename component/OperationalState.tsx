import type { ReactNode } from 'react';
import { AlertTriangle, Inbox } from 'lucide-react';

type OperationalStateTone = 'neutral' | 'warning' | 'danger';

type OperationalStateProps = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: OperationalStateTone;
  className?: string;
};

const toneClasses: Record<OperationalStateTone, string> = {
  neutral: 'border-slate-700 bg-slate-950/70 text-slate-400',
  warning: 'border-amber-900 bg-amber-950/25 text-amber-100',
  danger: 'border-red-900 bg-red-950/25 text-red-100',
};

const iconClasses: Record<OperationalStateTone, string> = {
  neutral: 'text-slate-500',
  warning: 'text-amber-300',
  danger: 'text-red-300',
};

export function OperationalState({
  title,
  description,
  action,
  icon,
  tone = 'neutral',
  className = '',
}: OperationalStateProps) {
  const defaultIcon = tone === 'neutral' ? <Inbox className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />;

  return (
    <div className={`rounded-lg border border-dashed p-6 text-center text-xs ${toneClasses[tone]} ${className}`} role="status">
      <div className={`mx-auto mb-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 ${iconClasses[tone]}`} aria-hidden="true">
        {icon || defaultIcon}
      </div>
      <p className="font-black text-slate-100">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-md leading-5">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
