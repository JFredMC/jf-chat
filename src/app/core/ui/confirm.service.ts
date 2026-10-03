import { Injectable, signal } from '@angular/core';

export interface ConfirmRequest {
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  resolve: (value: boolean) => void;
}

/** Promise-based confirmation dialog rendered by <app-confirm-dialog>. */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  public readonly request = signal<ConfirmRequest | null>(null);

  public ask(options: Omit<ConfirmRequest, 'resolve'>): Promise<boolean> {
    this.request()?.resolve(false);
    return new Promise((resolve) => this.request.set({ ...options, resolve }));
  }

  public answer(value: boolean): void {
    this.request()?.resolve(value);
    this.request.set(null);
  }
}
