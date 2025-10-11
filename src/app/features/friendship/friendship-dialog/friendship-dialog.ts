import { Component, effect, inject, output, signal } from '@angular/core';
import { IFriendship } from '../types/friendship.type';
import { toSignal } from '@angular/core/rxjs-interop';
import { FriendshipService } from '../services/friendship.service';

@Component({
  selector: 'app-friendship-dialog',
  imports: [],
  templateUrl: './friendship-dialog.html',
  styleUrl: './friendship-dialog.scss'
})
export class FriendshipDialog {
  private readonly friendshipService = inject(FriendshipService);
  friendSelected = output<string>();
  closed = output<string>();

  // Signals
  public friends = toSignal(this.friendshipService.getAll(), { initialValue: [] });
  public isLoading = this.friendshipService.isLoading;
  public isLoadingBtn = this.friendshipService.isLoadingBtn;
  public searchQuery = signal('');
  public selectedFriendId = signal<string | null>(null);

  constructor() {
    effect(() => {
      this.isLoading.set(this.friendshipService.isLoadingBtn());
      this.isLoadingBtn.set(this.friendshipService.isLoadingBtn());
    });
  }

  public filteredFriends() {
    const query = this.searchQuery().toLowerCase();
    if (!query) return this.friends();

    return this.friends().filter(friend =>
      friend.name.toLowerCase().includes(query) ||
      friend.username.toLowerCase().includes(query)
    );
  }

  public selectFriend(friend: IFriendship) {
    this.selectedFriendId.set(friend.id);
    this.friendSelected.emit(friend.id);
  }

  public onSearchChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.searchQuery.set(input.value);
  }

  public confirmSelection() {
    if (this.selectedFriendId()) {
      this.friendSelected.emit(this.selectedFriendId()!);
      this.closed.emit('close');
    }
  }

  public stopPropagation(event: Event) {
    event.stopPropagation();
  }
}
