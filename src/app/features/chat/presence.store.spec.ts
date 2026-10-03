import { TestBed } from '@angular/core/testing';
import { user } from '../../testing/fixtures';
import { PresenceStore } from './presence.store';

describe('PresenceStore', () => {
  let store: PresenceStore;

  beforeEach(() => {
    store = TestBed.inject(PresenceStore);
  });

  afterEach(() => store.ngOnDestroy());

  it('seeds from REST data and lets realtime updates win', () => {
    store.seed([user(1, 'ana', { status: 'online' }), user(2, 'beto', { status: 'offline', last_seen: null })]);
    expect(store.isOnline(1)).toBe(true);
    expect(store.label(1)).toBe('en línea');
    expect(store.label(2)).toBe('desconectado');

    store.apply([{ userId: 1, online: false, lastSeen: new Date().toISOString() }]);
    expect(store.isOnline(1)).toBe(false);
    expect(store.label(1)).toBe('visto hace un momento');

    store.seed([user(1, 'ana', { status: 'online' })]);
    expect(store.isOnline(1)).toBe(false);
  });

  it('tracks who is typing per conversation', () => {
    store.setTyping({ conversationId: 5, userId: 2, username: 'beto', isTyping: true });
    expect(store.typingIn(5)).toEqual([2]);
    expect(store.typingIn(6)).toEqual([]);
    store.clearTyping(5, 2);
    expect(store.typingIn(5)).toEqual([]);
  });

  it('stops showing typing when the user goes offline', () => {
    store.setTyping({ conversationId: 5, userId: 2, username: 'beto', isTyping: true });
    store.apply([{ userId: 2, online: false, lastSeen: null }]);
    expect(store.typingIn(5)).toEqual([]);
  });
});
