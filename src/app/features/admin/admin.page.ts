import { DatePipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminApi, AdminStats, AdminUser } from '../../core/admin/admin.api';
import { errorMessage } from '../../core/api-error';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';

@Component({
  selector: 'app-admin-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe, NgTemplateOutlet, RouterLink],
  template: `
    <main class="mx-auto max-w-5xl space-y-6 p-4 sm:p-6" data-testid="admin-page">
      <header class="flex items-center justify-between gap-3">
        <div>
          <h1 class="text-xl font-semibold">Administración</h1>
          <p class="text-sm text-gray-500">Solo cuentas y cifras. Desde aquí no se pueden leer mensajes ni archivos.</p>
        </div>
        <a routerLink="/chat" class="btn-secondary px-3 py-1.5 text-sm">Volver</a>
      </header>

      @if (stats(); as s) {
        <section class="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="admin-stats">
          @for (card of [
            { label: 'Usuarios', value: s.users },
            { label: 'Activos 24 h', value: s.active24h },
            { label: 'Activos 7 días', value: s.active7d },
            { label: 'Mensajes 24 h', value: s.messages24h },
          ]; track card.label) {
            <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div class="text-2xl font-semibold">{{ card.value }}</div>
              <div class="text-xs text-gray-500">{{ card.label }}</div>
            </div>
          }
        </section>
      }

      <section class="hidden overflow-x-auto rounded-xl sm:block border border-gray-200 dark:border-gray-800">
        <table class="w-full text-left text-sm" data-testid="admin-users">
          <thead class="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-900">
            <tr>
              <th class="p-3">Usuario</th><th class="p-3">Creado</th><th class="p-3">Última vez</th>
              <th class="p-3">Estado</th><th class="p-3">Acciones</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr class="border-t border-gray-100 align-top dark:border-gray-800" [attr.data-testid]="'admin-user-' + u.username">
                <td class="p-3 font-medium">
                  {{ u.username }}
                  @if (u.role === 'admin') { <span class="ml-1 rounded bg-gray-200 px-1.5 text-xs dark:bg-gray-700">admin</span> }
                  @if (codes()[u.id]; as code) {
                    <div class="mt-1 font-mono text-xs text-emerald-600" data-testid="admin-invite-code">{{ code }}</div>
                  }
                </td>
                <td class="p-3 whitespace-nowrap">{{ u.created_at | date: 'dd/MM/yy' }}</td>
                <td class="p-3 whitespace-nowrap">{{ u.last_seen ? (u.last_seen | date: 'dd/MM/yy HH:mm') : 'oculta' }}</td>
                <td class="p-3">
                  <span [class]="u.status === 'active' ? 'text-emerald-600' : 'text-rose-600'">
                    {{ u.status === 'active' ? 'Activo' : 'Bloqueado' }}
                  </span>
                </td>
                <td class="p-3">
                  <ng-container *ngTemplateOutlet="acts; context: { $implicit: u }" />
                </td>
              </tr>
            } @empty {
              <tr><td colspan="5" class="p-4 text-center text-gray-500">{{ loading() ? 'Cargando…' : 'Sin usuarios' }}</td></tr>
            }
          </tbody>
        </table>
      </section>
      <ul class="space-y-3 sm:hidden" data-testid="admin-user-cards">
        @for (u of users(); track u.id) {
          <li class="space-y-2 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ u.username }}
                @if (u.role === 'admin') { <span class="ml-1 rounded bg-gray-200 px-1.5 text-xs dark:bg-gray-700">admin</span> }
              </span>
              <span [class]="u.status === 'active' ? 'text-emerald-600' : 'text-rose-600'">{{ u.status === 'active' ? 'Activo' : 'Bloqueado' }}</span>
            </div>
            <div class="text-xs text-gray-500">
              Creado {{ u.created_at | date: 'dd/MM/yy' }} · Última vez {{ u.last_seen ? (u.last_seen | date: 'dd/MM/yy HH:mm') : 'oculta' }}
            </div>
            @if (codes()[u.id]; as code) { <div class="font-mono text-xs text-emerald-600">{{ code }}</div> }
            <ng-container *ngTemplateOutlet="acts; context: { $implicit: u }" />
          </li>
        } @empty {
          <li class="p-4 text-center text-gray-500">{{ loading() ? 'Cargando…' : 'Sin usuarios' }}</li>
        }
      </ul>

      <ng-template #acts let-u>
                  @if (u.role !== 'admin') {
                    <div class="flex flex-wrap gap-1.5">
                      <button type="button" class="btn-secondary px-2 py-1 text-xs" [disabled]="busy()" (click)="toggleBlock(asUser(u))">
                        {{ u.status === 'active' ? 'Bloquear' : 'Desbloquear' }}
                      </button>
                      <button type="button" class="btn-secondary px-2 py-1 text-xs" [disabled]="busy()" (click)="logout(asUser(u))">Cerrar sesiones</button>
                      <button type="button" class="btn-secondary px-2 py-1 text-xs" [disabled]="busy()" (click)="invite(asUser(u))">Nueva invitación</button>
                      @if (u.has_invite) {
                        <button type="button" class="btn-secondary px-2 py-1 text-xs" [disabled]="busy()" (click)="revokeInvite(asUser(u))">Revocar invitación</button>
                      }
                      <button type="button" class="rounded-lg bg-rose-600 px-2 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                        [disabled]="busy()" (click)="remove(asUser(u))">Eliminar</button>
                    </div>
                  }
      </ng-template>
    </main>
  `,
})
export class AdminPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);

  protected readonly stats = signal<AdminStats | null>(null);
  protected readonly users = signal<AdminUser[]>([]);
  protected readonly codes = signal<Record<number, string>>({});
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  protected asUser(u: unknown): AdminUser {
    return u as AdminUser;
  }

  public constructor() {
    void this.reload();
  }

  protected async reload(): Promise<void> {
    try {
      const [stats, users] = await Promise.all([firstValueFrom(this.api.stats()), firstValueFrom(this.api.users())]);
      this.stats.set(stats);
      this.users.set(users);
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected toggleBlock(u: AdminUser): Promise<void> {
    const block = u.status === 'active';
    return this.run(this.api.action(u.id, block ? 'block' : 'unblock'), block ? `${u.username} bloqueado` : `${u.username} desbloqueado`);
  }

  protected logout(u: AdminUser): Promise<void> {
    return this.run(this.api.action(u.id, 'logout'), `Sesiones de ${u.username} cerradas`);
  }

  protected async invite(u: AdminUser): Promise<void> {
    this.busy.set(true);
    try {
      const { code } = await firstValueFrom(this.api.newInvite(u.id));
      this.codes.update((all) => ({ ...all, [u.id]: code }));
      this.users.update((all) => all.map((x) => (x.id === u.id ? { ...x, has_invite: true } : x)));
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  protected revokeInvite(u: AdminUser): Promise<void> {
    this.codes.update((all) => ({ ...all, [u.id]: '' }));
    return this.run(this.api.revokeInvite(u.id), `Invitación de ${u.username} revocada`);
  }

  protected async remove(u: AdminUser): Promise<void> {
    const ok = await this.confirm.ask({
      title: `¿Eliminar a ${u.username}?`,
      text: 'Se borran su cuenta, sus chats y archivos para siempre. No se puede deshacer.',
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (ok) await this.run(this.api.remove(u.id), `${u.username} eliminado`);
  }

  private async run(request: ReturnType<AdminApi['remove']>, done: string): Promise<void> {
    this.busy.set(true);
    try {
      await firstValueFrom(request);
      this.toast.success(done);
      await this.reload();
    } catch (error) {
      this.toast.error(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
