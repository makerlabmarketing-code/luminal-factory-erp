import { describe, expect, it, vi } from 'vitest';
import { containModalFocus } from '../lib/modal-focus';

class TestDocument extends EventTarget {
  activeElement: TestElement | null = null;
}
class TestElement {
  tabIndex = 0;
  disabled = false;
  visible = true;
  isConnected = true;
  children: TestElement[] = [];
  constructor(readonly ownerDocument: TestDocument) {}
  focus() {
    this.ownerDocument.activeElement = this;
    const event = new Event('focusin');
    Object.defineProperty(event, 'target', { value: this });
    this.ownerDocument.dispatchEvent(event);
  }
  querySelectorAll() { return this.children; }
  querySelector() { return this.children[1] ?? null; }
  contains(element: unknown) { return element === this || this.children.includes(element as TestElement); }
  matches() { return this.disabled; }
  getClientRects() { return this.visible ? [{}] : []; }
  closest() { return null; }
}
const mount = (root: TestElement, onEscape = vi.fn(), initialFocus?: string) => containModalFocus(root as unknown as HTMLElement, { onEscape, initialFocus });
function key(document: TestDocument, value: string, shiftKey = false) {
  const event = new Event('keydown', { cancelable: true });
  Object.assign(event, { key: value, shiftKey });
  document.dispatchEvent(event);
  return event;
}
function fixture() {
  const document = new TestDocument();
  const trigger = new TestElement(document);
  const root = new TestElement(document);
  root.children = Array.from({ length: 4 }, () => new TestElement(document));
  root.children[2].disabled = true;
  root.children[3].visible = false;
  trigger.focus();
  return { document, trigger, root, first: root.children[0], last: root.children[1] };
}

describe('modal keyboard focus', () => {
  it('focuses the requested field, wraps both directions, excludes unavailable controls and restores the trigger', () => {
    const { document, root, trigger, first, last } = fixture();
    const close = vi.fn();
    const dispose = mount(root, close, '#project-name');
    try {
      expect(document.activeElement).toBe(last);
      expect(key(document, 'Tab').defaultPrevented).toBe(true);
      expect(document.activeElement).toBe(first);
      key(document, 'Tab', true);
      expect(document.activeElement).toBe(last);
      trigger.focus();
      expect(document.activeElement).toBe(first);
      key(document, 'Escape');
      expect(close).toHaveBeenCalledOnce();
    } finally { dispose(); }
    expect(document.activeElement).toBe(trigger);
  });

  it('gives a nested confirmation exclusive focus/Escape and returns to the underlying form', () => {
    const { document, root, first, last } = fixture();
    const parentClose = vi.fn();
    const parentDispose = mount(root, parentClose);
    last.focus();
    const confirmation = new TestElement(document);
    const cancel = new TestElement(document);
    confirmation.children = [cancel, new TestElement(document)];
    const childClose = vi.fn();
    const childDispose = mount(confirmation, childClose);
    try {
      expect(document.activeElement).toBe(cancel);
      key(document, 'Tab', true);
      expect(document.activeElement).toBe(confirmation.children[1]);
      key(document, 'Escape');
      expect(childClose).toHaveBeenCalledOnce();
      expect(parentClose).not.toHaveBeenCalled();
    } finally { childDispose(); }
    expect(document.activeElement).toBe(last);
    last.focus();
    key(document, 'Tab');
    expect(document.activeElement).toBe(first);
    parentDispose();
  });

  it('keeps focus on the panel when all controls are disabled and removes listeners on cleanup', () => {
    const { document, root, trigger } = fixture();
    root.children.forEach(element => { element.disabled = true; });
    const close = vi.fn();
    const dispose = mount(root, close);
    expect(document.activeElement).toBe(root);
    expect(key(document, 'Tab').defaultPrevented).toBe(true);
    dispose();
    trigger.focus();
    expect(key(document, 'Tab').defaultPrevented).toBe(false);
    key(document, 'Escape');
    expect(close).not.toHaveBeenCalled();
  });
});
