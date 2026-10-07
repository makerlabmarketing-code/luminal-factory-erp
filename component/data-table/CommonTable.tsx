'use client';

import { Children, Fragment, cloneElement, isValidElement, useLayoutEffect, useId, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

/** Shared semantic table; screens keep their data, filtering and pagination. */
export function CommonTable({ className = '', children, ...props }: ComponentPropsWithoutRef<'table'>) {
  return <table {...props} className={`erp-common-table ${className}`}>{children}</table>;
}

/** Flatten layout containers/fragments, preserving the screen's actual buttons. */
export function collectRowActions(children: ReactNode): ReactNode[] {
  return Children.toArray(children).flatMap(child => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return typeof child === 'string' && !child.trim() ? [] : [child];
    if (child.type === Fragment || child.type === 'div') return collectRowActions(child.props.children);
    return [child];
  });
}

function hasText(children: ReactNode): boolean {
  return Children.toArray(children).some(child => typeof child === 'string' ? Boolean(child.trim()) :
    isValidElement<{ children?: ReactNode }>(child) && hasText(child.props.children));
}

function overflowAction(action: ReactNode): ReactNode {
  if (!isValidElement<{ children?: ReactNode; title?: string; 'aria-label'?: string }>(action)) return action;
  const label = action.props['aria-label'] || action.props.title;
  return label && !hasText(action.props.children)
    ? cloneElement(action, {}, <>{action.props.children}<span>{label}</span></>)
    : action;
}

export function TableRowActions({ renderActions, inlineLimit = 2 }: { renderActions: () => ReactNode; inlineLimit?: number }) {
  const actions = collectRowActions(renderActions());
  const limit = Math.max(1, inlineLimit);
  const primary = actions.length > limit ? actions.slice(0, 1) : actions;
  const overflow = actions.length > limit ? actions.slice(1) : [];
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();

  useLayoutEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    const focus = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.current?.contains(event.target) && !trigger.current?.contains(event.target)) setOpen(false);
    };
    const reposition = () => {
      const bounds = trigger.current?.getBoundingClientRect();
      if (bounds) setPosition({ top: Math.max(8, Math.min(bounds.bottom + 6, window.innerHeight - (panel.current?.offsetHeight ?? 200) - 8)), left: Math.max(8, Math.min(bounds.right - 224, window.innerWidth - 232)) });
    };
    reposition();
    panel.current?.querySelector<HTMLElement>('button:not(:disabled),a[href]')?.focus();
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', key);
    document.addEventListener('focusin', focus);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', key); document.removeEventListener('focusin', focus); window.removeEventListener('resize', reposition); window.removeEventListener('scroll', reposition, true); };
  }, [open]);

  return <div className="erp-row-actions">
    {primary.map((action, index) => <Fragment key={index}>{action}</Fragment>)}
    {overflow.length > 0 && <button ref={trigger} type="button" aria-label="Thao tác khác" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)} className="erp-row-actions-more"><MoreHorizontal className="h-4 w-4" /></button>}
    {open && overflow.length > 0 && createPortal(<div ref={panel} id={id} aria-label="Thao tác khác" className="erp-row-actions-panel" style={position} onClick={event => {
      const target = event.target instanceof Element ? event.target.closest('button,a') : null;
      if (target && !target.hasAttribute('disabled')) setOpen(false);
    }}>{overflow.map((action, index) => <Fragment key={index}>{overflowAction(action)}</Fragment>)}</div>, document.body)}
  </div>;
}
