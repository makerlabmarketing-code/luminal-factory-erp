/** Only the foremost registered modal owns keyboard focus (including confirmations). */
const scopes: object[] = [];

export function containModalFocus(root: HTMLElement, options: {
  initialFocus?: string;
  onEscape: () => void;
}) {
  const document = root.ownerDocument;
  const previous = document.activeElement as HTMLElement | null;
  const scope = {};
  scopes.push(scope);
  const isActive = () => scopes.at(-1) === scope;
  const targets = () => Array.from(root.querySelectorAll<HTMLElement>('a[href], button, input, select, textarea, [tabindex]'))
    .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0 && !element.closest('[inert]'));
  const focusFirst = () => (targets()[0] ?? root).focus();
  const initial = options.initialFocus ? root.querySelector<HTMLElement>(options.initialFocus) : null;
  (initial ?? targets()[0] ?? root).focus();

  const onFocus = (event: FocusEvent) => {
    if (isActive() && !root.contains(event.target as Node)) focusFirst();
  };
  const onKey = (event: KeyboardEvent) => {
    if (!isActive()) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      options.onEscape();
      return;
    }
    if (event.key !== 'Tab') return;
    const items = targets();
    const first = items[0];
    const last = items.at(-1);
    const outside = !root.contains(document.activeElement);
    if (!first) { event.preventDefault(); root.focus(); }
    else if (event.shiftKey && (document.activeElement === first || document.activeElement === root || outside)) {
      event.preventDefault(); last?.focus();
    } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === root || outside)) {
      event.preventDefault(); first.focus();
    }
  };
  document.addEventListener('keydown', onKey, true);
  document.addEventListener('focusin', onFocus, true);
  return () => {
    const wasActive = isActive();
    const index = scopes.indexOf(scope);
    if (index !== -1) scopes.splice(index, 1);
    document.removeEventListener('keydown', onKey, true);
    document.removeEventListener('focusin', onFocus, true);
    if (wasActive && previous?.isConnected) previous.focus();
  };
}
