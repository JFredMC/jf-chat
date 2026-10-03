import { Injectable, signal } from '@angular/core';

export type ToastKind = 'info' | 'success' | 'error';

export interface Toast {
  id: number;
  kind: ToastKind;
  text: string;
}

/** Small, accessible notifications (replaces SweetAlert2: ~70 kB less JS). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  public readonly toasts = signal<Toast[]>([]);

  public info(text: string): void {
    this.show('info', text);
  }

  public success(text: string): void {
    this.show('success', text);
  }

  public error(text: string): void {
    this.show('error', text, 6000);
  }

  public dismiss(id: number): void {
    this.toasts.update((list) => list.filter((toast) => toast.id !== id));
  }

  private show(kind: ToastKind, text: string, duration = 4000): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { id, kind, text }]);
    setTimeout(() => this.dismiss(id), duration);
  }
}
