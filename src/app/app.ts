import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { DecoyHomeComponent } from './core/privacy/decoy-home.component';
import { PinLockService } from './core/privacy/pin-lock.service';
import { PrivacyOverlayComponent } from './core/privacy/privacy-overlay.component';
import { ShieldService } from './core/privacy/shield.service';
import { ConfirmDialogComponent } from './core/ui/confirm-dialog.component';
import { ThemeService } from './core/ui/theme.service';
import { ToastsComponent } from './core/ui/toasts.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, DecoyHomeComponent, ToastsComponent, ConfirmDialogComponent, PrivacyOverlayComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (pinLock.decoy()) {
      <app-decoy-home />
    } @else {
      <router-outlet />
    }
    <app-toasts />
    <app-privacy-overlay />
    <app-confirm-dialog />
  `,
})
export class App {
  // Applies the saved theme on startup.
  private readonly theme = inject(ThemeService);
  // Screenshot shield and PIN lock listen from the start.
  private readonly shield = inject(ShieldService);
  protected readonly pinLock = inject(PinLockService);
}
