import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { ToastService } from '../ui/toast.service';

/** Keys that usually mean "take a screenshot" on Windows, macOS and Linux. */
export function isScreenshotShortcut(event: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'shiftKey'>): boolean {
  if (event.key === 'PrintScreen' || event.code === 'PrintScreen') return true;
  const key = event.key.toLowerCase();
  // macOS: ⌘⇧3 / ⌘⇧4 / ⌘⇧5; Windows: Win+Shift+S.
  return event.metaKey && event.shiftKey && ['3', '4', '5', 's', '#', '$', '%'].includes(key);
}

export const isPrintShortcut = (event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey'>): boolean =>
  (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'p';

/**
 * Screenshot deterrence. A web page cannot block captures made by the OS or
 * another camera, but it can hide the chat whenever the window loses focus,
 * goes to the background, a screenshot shortcut is pressed or someone tries
 * to print.
 */
@Injectable({ providedIn: 'root' })
export class ShieldService {
  private readonly document = inject(DOCUMENT);
  private readonly toast = inject(ToastService);
  public readonly hidden = signal(false);
  private flashTimer: ReturnType<typeof setTimeout> | null = null;

  public constructor() {
    const view = this.document.defaultView;
    if (!view) return;
    const hide = () => this.hidden.set(true);
    const show = () => {
      if (this.flashTimer === null) this.hidden.set(false);
    };
    const onVisibility = () => (this.document.visibilityState === 'hidden' ? hide() : show());
    const onKey = (event: KeyboardEvent) => {
      if (isPrintShortcut(event)) {
        event.preventDefault();
        this.toast.info('Imprimir está desactivado en Velo');
        return;
      }
      if (isScreenshotShortcut(event)) this.flash();
    };
    view.addEventListener('blur', hide);
    view.addEventListener('focus', show);
    view.addEventListener('beforeprint', hide);
    view.addEventListener('afterprint', show);
    view.addEventListener('keydown', onKey, true);
    view.addEventListener('keyup', onKey, true);
    this.document.addEventListener('visibilitychange', onVisibility);
    inject(DestroyRef).onDestroy(() => {
      view.removeEventListener('blur', hide);
      view.removeEventListener('focus', show);
      view.removeEventListener('beforeprint', hide);
      view.removeEventListener('afterprint', show);
      view.removeEventListener('keydown', onKey, true);
      view.removeEventListener('keyup', onKey, true);
      this.document.removeEventListener('visibilitychange', onVisibility);
    });
  }

  /** Hides the chat for a moment and empties the clipboard (best effort). */
  public flash(): void {
    this.hidden.set(true);
    void navigator.clipboard?.writeText('').catch(() => undefined);
    if (this.flashTimer !== null) clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.flashTimer = null;
      if (this.document.hasFocus() && this.document.visibilityState === 'visible') this.hidden.set(false);
    }, 2500);
  }

  /** The user taps the shield to come back. */
  public reveal(): void {
    if (this.flashTimer !== null) return;
    this.hidden.set(false);
  }
}
