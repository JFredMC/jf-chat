import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { errorMessage } from '../../core/api-error';
import { displayName, type Friendship, type User } from '../../core/models';
import { ToastService } from '../../core/ui/toast.service';
import { FriendsApi } from './friends.api';

@Injectable({ providedIn: 'root' })
export class FriendsStore {
  private readonly api = inject(FriendsApi);
  private readonly toast = inject(ToastService);
  private readonly state = signal<Friendship[]>([]);
  public readonly loaded = signal(false);

  public readonly friends = computed(() =>
    this.state()
      .filter((f) => f.status === 'accepted')
      .sort((a, b) => displayName(a.friend).localeCompare(displayName(b.friend), 'es')),
  );
  public readonly incoming = computed(() => this.state().filter((f) => f.status === 'pending' && f.direction === 'incoming'));
  public readonly outgoing = computed(() => this.state().filter((f) => f.status === 'pending' && f.direction === 'outgoing'));

  /** My single-use invite code (loaded on demand, rotates when someone redeems it). */
  public readonly inviteCode = signal<string | null>(null);
  public readonly inviteBusy = signal(false);

  /** A user changed their photo, name or status (realtime `user_updated`). */
  public patchUser(user: User): void {
    this.state.update((list) => list.map((f) => (f.friend.id === user.id ? { ...f, friend: { ...f.friend, ...user } } : f)));
  }

  public async load(): Promise<void> {
    try {
      this.state.set(await firstValueFrom(this.api.list()));
      this.loaded.set(true);
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudieron cargar tus contactos'));
    }
  }

  public async loadInvite(): Promise<void> {
    try {
      this.inviteCode.set((await firstValueFrom(this.api.myInvite())).code);
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudo cargar tu código'));
    }
  }

  /** Invalidate the current code (e.g. it was shared by mistake). */
  public async rotateInvite(): Promise<void> {
    this.inviteBusy.set(true);
    try {
      this.inviteCode.set((await firstValueFrom(this.api.rotateInvite())).code);
      this.toast.success('Código nuevo. El anterior ya no sirve.');
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudo cambiar el código'));
    } finally {
      this.inviteBusy.set(false);
    }
  }

  /** Redeem someone's code; resolves with the new contact, or null on failure. */
  public async redeem(code: string): Promise<Friendship | null> {
    let added: Friendship | null = null;
    await this.run(this.api.redeem(code), (f) => {
      added = f;
      this.toast.success(`${displayName(f.friend)} ya es tu contacto`);
    });
    return added;
  }

  /** Someone redeemed my code: it is used up, fetch the fresh one if it was shown. */
  public async refreshInviteIfLoaded(): Promise<void> {
    if (this.inviteCode()) await this.loadInvite();
  }

  public async accept(id: number): Promise<void> {
    await this.run(this.api.accept(id), (f) => this.toast.success(`${displayName(f.friend)} ya es tu contacto`));
  }

  public async reject(id: number): Promise<void> {
    try {
      await firstValueFrom(this.api.reject(id));
      this.state.update((list) => list.filter((f) => f.id !== id));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  public async remove(id: number): Promise<void> {
    try {
      await firstValueFrom(this.api.remove(id));
      this.state.update((list) => list.filter((f) => f.id !== id));
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }

  public reset(): void {
    this.state.set([]);
    this.loaded.set(false);
    this.inviteCode.set(null);
  }

  private async run(request: ReturnType<FriendsApi['accept']>, onDone: (f: Friendship) => void): Promise<void> {
    try {
      const friendship = await firstValueFrom(request);
      this.state.update((list) => [...list.filter((f) => f.id !== friendship.id && f.friend.id !== friendship.friend.id), friendship]);
      onDone(friendship);
    } catch (error) {
      this.toast.error(errorMessage(error));
    }
  }
}
