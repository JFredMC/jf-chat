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

  /** Relationship with a user, for search results. */
  public relationWith(userId: number): Friendship | undefined {
    return this.state().find((f) => f.friend.id === userId);
  }

  /** A user changed their photo, name or status (realtime `user_updated`). */
  public patchUser(user: User): void {
    this.state.update((list) => list.map((f) => (f.friend.id === user.id ? { ...f, friend: { ...f.friend, ...user } } : f)));
  }

  public async load(): Promise<void> {
    try {
      this.state.set(await firstValueFrom(this.api.list()));
      this.loaded.set(true);
    } catch (error) {
      this.toast.error(errorMessage(error, 'No se pudieron cargar tus amigos'));
    }
  }

  public async request(userId: number): Promise<void> {
    await this.run(this.api.request(userId), (f) =>
      this.toast.success(f.status === 'accepted' ? `Ahora eres amigo de ${displayName(f.friend)}` : 'Solicitud enviada'),
    );
  }

  public async accept(id: number): Promise<void> {
    await this.run(this.api.accept(id), (f) => this.toast.success(`Ahora eres amigo de ${displayName(f.friend)}`));
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
