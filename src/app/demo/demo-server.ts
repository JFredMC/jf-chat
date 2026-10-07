import { Injectable } from '@angular/core';
import { Observable, Subject, filter, map } from 'rxjs';
import type { Ack, Attachment, AuthSession, Conversation, Friendship, Message, PresenceUpdate, User } from '../core/models';
import type { ClientEvents, ServerEvent } from '../core/realtime/realtime-connection';
import {
  loadDb,
  newInviteCode,
  normalizeInvite,
  saveDb,
  seedDb,
  type DbAttachment,
  type DbConversation,
  type DbFriendship,
  type DbMessage,
  type DbUser,
  type DemoDb,
} from './demo-db';

/** An API error as the real backend would answer it. */
export class DemoHttpError extends Error {
  public constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface DemoRequest {
  method: string;
  /** Path without the API prefix, e.g. `/conversation/3/messages`. */
  path: string;
  query: URLSearchParams;
  body: unknown;
  token: string | null;
}

export interface DemoResponse {
  status: number;
  body: unknown;
}

const DEMO_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
const DEMO_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];

export interface DemoFile {
  name: string;
  type: string;
  size: number;
  /** data: URL for small files (kept after a reload), blob: URL otherwise. */
  url: string;
  persistable: boolean;
}

interface Envelope {
  userIds: number[];
  event: ServerEvent;
}

const USERNAME_PATTERN = /^[a-z0-9._]{3,30}$/;
/** Same defaults as the API: MESSAGE_RETENTION=24h, VIEW_ONCE_TTL=30s. */
export const RETENTION_MS = 24 * 60 * 60_000;
export const VIEW_ONCE_MS = 30_000;
const PAGE_LIMIT = 50;
const MAX_MESSAGE = 4000;

const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const random = () => Math.random().toString(36).slice(2, 12);
const isStrong = (password: string) =>
  password.length >= 8 && password.length <= 72 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);

/**
 * In-browser implementation of the Velo API (jf-chat-be) for the public
 * demo: same endpoints, payloads, errors and realtime events, with simulated
 * contacts that read, type and answer. Data lives in localStorage.
 */
@Injectable({ providedIn: 'root' })
export class DemoServer {
  private db: DemoDb = loadDb() ?? seedDb();
  private readonly bus = new Subject<Envelope>();
  private readonly sockets = new Map<number, number>();
  private readonly blobUrls = new Map<number, string>();
  private readonly replyTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
  private readonly replyCounters = new Map<number, number>();
  private purgeTimer?: ReturnType<typeof setTimeout>;

  /** Multiplies every simulated delay (0 in unit tests). */
  public speed = 1;

  public constructor() {
    this.purge();
    this.save();
  }

  // --- Realtime ---------------------------------------------------------------

  public userIdFromToken(token: string | null): number | null {
    const match = /^demo\.(\d+)\.[a-z0-9]+$/.exec(token ?? '');
    const id = match ? Number(match[1]) : null;
    return id !== null && this.findUser(id) ? id : null;
  }

  public eventsFor(userId: number): Observable<ServerEvent> {
    return this.bus.pipe(
      filter((envelope) => envelope.userIds.includes(userId)),
      map((envelope) => envelope.event),
    );
  }

  public connect(userId: number): void {
    const count = (this.sockets.get(userId) ?? 0) + 1;
    this.sockets.set(userId, count);
    if (count === 1) this.broadcastPresence(userId);
    this.emitTo([userId], { type: 'presence_snapshot', data: this.snapshotFor(userId) });
    this.markAllDelivered(userId);
  }

  public disconnect(userId: number): void {
    const count = Math.max(0, (this.sockets.get(userId) ?? 0) - 1);
    this.sockets.set(userId, count);
    if (count === 0) {
      const user = this.findUser(userId);
      if (user) user.last_seen = new Date().toISOString();
      this.save();
      this.broadcastPresence(userId);
    }
  }

  public socket<K extends keyof ClientEvents>(userId: number, event: K, payload: ClientEvents[K]): Ack {
    this.purge();
    try {
      switch (event) {
        case 'send_message': {
          const { conversationId, ...body } = payload as ClientEvents['send_message'];
          return { ok: true, data: this.sendMessage(userId, conversationId, body).message };
        }
        case 'typing': {
          const { conversationId, isTyping } = payload as ClientEvents['typing'];
          const conversation = this.activeConversation(userId, conversationId);
          const me = this.findUser(userId)!;
          // Like the API: hidden typing is dropped server-side.
          if (me.hide_typing) return { ok: true };
          this.emitTo(this.otherMemberIds(conversation, userId), {
            type: 'typing',
            data: { conversationId, userId, username: me.username, isTyping },
          });
          return { ok: true };
        }
        case 'mark_read': {
          const { conversationId, messageId } = payload as ClientEvents['mark_read'];
          return { ok: true, data: { lastReadMessageId: this.markRead(userId, conversationId, messageId) } };
        }
        case 'mark_delivered': {
          const { conversationId, messageId } = payload as ClientEvents['mark_delivered'];
          return { ok: true, data: { lastDeliveredMessageId: this.markDelivered(userId, conversationId, messageId) } };
        }
      }
      return { ok: false, error: 'Evento desconocido' };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'Error' };
    }
  }

  // --- REST -------------------------------------------------------------------

  public handle(request: DemoRequest): DemoResponse {
    const { method, path } = request;
    const body = (request.body ?? {}) as Record<string, unknown>;
    const route = `${method} ${path}`;
    // Like the API's purge job: nothing past its deadline is ever served.
    this.purge();
    let match: RegExpExecArray | null;

    // Public endpoints
    if (route === 'POST /auth/login') return this.created(200, this.login(String(body['username'] ?? ''), String(body['password'] ?? '')));
    if (route === 'POST /auth/register') return this.created(201, this.register(body));
    if (route === 'POST /auth/refresh') return this.created(200, this.refresh(String(body['refreshToken'] ?? '')));
    if (route === 'POST /auth/logout') {
      delete this.db.refreshTokens[String(body['refreshToken'] ?? '')];
      this.save();
      return { status: 204, body: null };
    }
    // The demo never sends push notifications.
    if (route === 'GET /push/public-key') return { status: 200, body: { publicKey: null } };
    if (route === 'GET /auth/username-available') {
      const username = (request.query.get('username') ?? '').trim().toLowerCase();
      return { status: 200, body: { available: !this.db.users.some((u) => u.username === username) } };
    }

    const me = this.userIdFromToken(request.token);
    if (me === null) throw new DemoHttpError(401, 'No autorizado');

    if (route === 'GET /auth/me') return { status: 200, body: this.publicUser(this.findUser(me)!) };
    if (route === 'PATCH /auth/me') return { status: 200, body: this.updateProfile(me, body) };
    if (route === 'DELETE /auth/me/avatar') return { status: 200, body: this.setAvatar(me, null) };
    if (route === 'POST /auth/me/password') return this.created(200, this.changePassword(me, body));
    if (route === 'GET /auth/me/invite') return { status: 200, body: { code: this.formatCode(this.findUser(me)!.invite_code) } };
    if (route === 'POST /auth/me/invite/rotate') return { status: 200, body: this.rotateInvite(me) };
    if ((match = /^GET \/user\/(\d+)$/.exec(route))) return { status: 200, body: this.contactProfile(me, Number(match[1])) };

    if (route === 'GET /friendship') return { status: 200, body: this.friendships(me) };
    if (route === 'POST /friendship/invite') return { status: 201, body: this.redeemInvite(me, String(body['code'] ?? '')) };
    if ((match = /^POST \/friendship\/(\d+)\/accept$/.exec(route))) return { status: 200, body: this.acceptFriend(me, Number(match[1])) };
    if ((match = /^POST \/friendship\/(\d+)\/reject$/.exec(route))) return { status: 200, body: this.rejectFriend(me, Number(match[1])) };
    if ((match = /^DELETE \/friendship\/(\d+)$/.exec(route))) {
      this.removeFriend(me, Number(match[1]));
      return { status: 204, body: null };
    }

    if (route === 'GET /conversation') return { status: 200, body: this.conversations(me) };
    if (route === 'POST /conversation/direct') return { status: 201, body: this.openDirect(me, Number(body['friendId'])) };
    if ((match = /^GET \/conversation\/(\d+)$/.exec(route))) {
      return { status: 200, body: this.conversationView(this.activeConversation(me, Number(match[1])), me) };
    }
    if ((match = /^POST \/conversation\/(\d+)\/destroy$/.exec(route))) {
      this.destroy(me, Number(match[1]));
      return { status: 204, body: null };
    }
    if ((match = /^DELETE \/conversation\/(\d+)$/.exec(route))) {
      this.leave(me, Number(match[1]));
      return { status: 204, body: null };
    }
    if ((match = /^GET \/conversation\/(\d+)\/messages$/.exec(route))) {
      return { status: 200, body: this.messages(me, Number(match[1]), request.query) };
    }
    if ((match = /^POST \/conversation\/(\d+)\/messages$/.exec(route))) {
      const { message, created } = this.sendMessage(me, Number(match[1]), body);
      return { status: created ? 201 : 200, body: message };
    }
    if ((match = /^POST \/conversation\/(\d+)\/read$/.exec(route))) {
      const messageId = typeof body['messageId'] === 'number' ? body['messageId'] : undefined;
      return { status: 200, body: { lastReadMessageId: this.markRead(me, Number(match[1]), messageId) } };
    }
    if ((match = /^GET \/attachment\/(\d+)\/url$/.exec(route))) return { status: 200, body: this.attachmentUrl(me, Number(match[1])) };
    if ((match = /^DELETE \/attachment\/(\d+)$/.exec(route))) {
      this.discardAttachment(me, Number(match[1]));
      return { status: 204, body: null };
    }
    throw new DemoHttpError(404, 'Ruta no encontrada');
  }

  /** `POST /conversation/:id/attachments` (multipart in the real API). */
  public upload(token: string | null, conversationId: number, file: DemoFile): Attachment {
    const me = this.userIdFromToken(token);
    if (me === null) throw new DemoHttpError(401, 'No autorizado');
    this.activeConversation(me, conversationId);
    const video = DEMO_VIDEO_TYPES.includes(file.type);
    if (!video && !DEMO_IMAGE_TYPES.includes(file.type)) throw new DemoHttpError(400, 'Solo fotos (JPG, PNG, GIF, WebP) o videos (MP4, MOV, WebM)');
    if (file.size <= 0) throw new DemoHttpError(400, 'El archivo está vacío');
    if (file.size > (video ? 25 : 10) * 1024 * 1024) throw new DemoHttpError(413, `El archivo supera ${video ? 25 : 10} MB`);
    const attachment: DbAttachment = {
      id: this.nextId(),
      conversation_id: conversationId,
      uploader_id: me,
      message_id: null,
      file_name: file.name.slice(0, 200),
      file_type: file.type,
      file_size: file.size,
      is_image: !video,
      is_video: video,
      data_url: file.persistable ? file.url : null,
    };
    if (!file.persistable) this.blobUrls.set(attachment.id, file.url);
    this.db.attachments.push(attachment);
    this.save();
    return this.attachmentView(attachment);
  }

  /** `POST /auth/me/avatar` (multipart in the real API). `url` is a data: URL. */
  public uploadAvatar(token: string | null, file: DemoFile): User {
    const me = this.userIdFromToken(token);
    if (me === null) throw new DemoHttpError(401, 'No autorizado');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new DemoHttpError(400, 'Usa una imagen JPG, PNG o WebP');
    if (file.size <= 0) throw new DemoHttpError(400, 'La imagen está vacía');
    if (file.size > 3 * 1024 * 1024) throw new DemoHttpError(400, 'La imagen supera el máximo de 3 MB');
    if (!file.url.startsWith('data:image/')) throw new DemoHttpError(400, 'No se pudo leer la imagen');
    return this.setAvatar(me, file.url);
  }

  /** Back to the initial data (button in the demo banner). */
  public reset(): void {
    for (const timers of this.replyTimers.values()) timers.forEach(clearTimeout);
    this.replyTimers.clear();
    clearTimeout(this.purgeTimer);
    this.db = seedDb();
    this.save();
  }

  /**
   * Destroys what is past its deadline (own expiry or the 24 h retention),
   * with its files, and tells the members, like the API's purge job.
   */
  public purge(now = Date.now()): void {
    const expired = this.db.messages.filter(
      (m) => (m.expires_at && new Date(m.expires_at).getTime() <= now) || new Date(m.created_at).getTime() + RETENTION_MS <= now,
    );
    if (expired.length) this.deleteMessages(expired);
    this.schedulePurge(now);
  }

  // --- Auth -------------------------------------------------------------------

  private login(username: string, password: string): AuthSession {
    // Simulated people can't sign in: their password is the demo one.
    const user = this.db.users.find((u) => u.username === username.trim().toLowerCase());
    if (!user || user.bot || user.password !== password) throw new DemoHttpError(401, 'Usuario o contraseña incorrectos');
    return this.session(user);
  }

  private register(body: Record<string, unknown>): AuthSession {
    const username = String(body['username'] ?? '').trim().toLowerCase();
    const password = String(body['password'] ?? '');
    if (!USERNAME_PATTERN.test(username)) throw new DemoHttpError(400, 'El usuario debe tener de 3 a 30 letras, números, puntos o guiones bajos');
    if (!isStrong(password)) throw new DemoHttpError(400, 'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número');
    if (this.db.users.some((u) => u.username === username)) throw new DemoHttpError(409, 'Ese nombre de usuario ya está en uso');
    const now = new Date().toISOString();
    // Username and password only, like the API: no name, no email.
    const user: DbUser = {
      id: this.nextId(),
      username,
      avatar_url: null,
      password,
      created_at: now,
      last_seen: null,
      invite_code: newInviteCode(),
    };
    this.db.users.push(user);
    // New accounts start alone: the demo hints show the codes of Luna and Sol.
    return this.session(user);
  }

  private refresh(token: string): AuthSession {
    const userId = this.db.refreshTokens[token];
    const user = userId === undefined ? undefined : this.findUser(userId);
    if (!user) throw new DemoHttpError(401, 'Sesión inválida o expirada');
    delete this.db.refreshTokens[token];
    return this.session(user);
  }

  private session(user: DbUser): AuthSession {
    const refreshToken = `demo-refresh.${random()}${random()}`;
    this.db.refreshTokens[refreshToken] = user.id;
    this.save();
    return { user: this.publicUser(user), accessToken: `demo.${user.id}.${random()}`, expiresIn: 900, refreshToken };
  }

  private updateProfile(userId: number, body: Record<string, unknown>): User {
    const user = this.findUser(userId)!;
    if ('status_message' in body) {
      const value = body['status_message'];
      if (value !== null && typeof value !== 'string') throw new DemoHttpError(400, 'El estado debe ser texto');
      const text = (value ?? '').trim();
      if (text.length > 140) throw new DemoHttpError(400, 'El estado admite hasta 140 caracteres');
      user.status_message = text || null;
    }
    if ('first_name' in body || 'last_name' in body) throw new DemoHttpError(400, 'Velo no guarda nombres reales');
    const hidingChanged = 'hide_last_seen' in body && Boolean(body['hide_last_seen']) !== Boolean(user.hide_last_seen);
    if ('hide_last_seen' in body) user.hide_last_seen = Boolean(body['hide_last_seen']);
    if ('hide_typing' in body) user.hide_typing = Boolean(body['hide_typing']);
    this.save();
    this.announceProfile(user);
    if (hidingChanged) this.broadcastPresence(user.id, true);
    return this.publicUser(user);
  }

  private setAvatar(userId: number, url: string | null): User {
    const user = this.findUser(userId)!;
    user.avatar_url = url;
    this.save();
    this.announceProfile(user);
    return this.publicUser(user);
  }

  /** Like the API's `user_updated`: to the user and their friends and contacts. */
  private announceProfile(user: DbUser): void {
    this.emitTo([user.id, ...this.contactsOf(user.id)], { type: 'user_updated', data: this.publicUser(user) });
  }

  private changePassword(userId: number, body: Record<string, unknown>): AuthSession {
    const user = this.findUser(userId)!;
    if (user.password !== String(body['currentPassword'] ?? '')) throw new DemoHttpError(401, 'La contraseña actual no es correcta');
    const next = String(body['newPassword'] ?? '');
    if (!isStrong(next)) throw new DemoHttpError(400, 'La contraseña debe tener al menos 8 caracteres, con mayúscula, minúscula y número');
    user.password = next;
    // Like the API: every other session ends.
    for (const [token, owner] of Object.entries(this.db.refreshTokens)) if (owner === userId) delete this.db.refreshTokens[token];
    return this.session(user);
  }

  // --- Users and friends ------------------------------------------------------

  /** Contacts and conversation partners only: there is no user directory. */
  private contactProfile(me: number, id: number): User {
    const user = this.findUser(id);
    if (!user || (id !== me && !this.contactsOf(me).includes(id))) throw new DemoHttpError(404, 'Usuario no encontrado');
    return this.publicUser(user);
  }

  private rotateInvite(me: number): { code: string } {
    const user = this.findUser(me)!;
    user.invite_code = newInviteCode();
    this.save();
    return { code: this.formatCode(user.invite_code) };
  }

  private friendships(me: number): Friendship[] {
    return this.db.friendships.filter((f) => f.requester_id === me || f.addressee_id === me).map((f) => this.friendshipView(f, me));
  }

  /** Same rules as the API: unknown and own codes give the same 404; codes are single use. */
  private redeemInvite(me: number, raw: string): Friendship {
    const code = normalizeInvite(raw);
    if (!/^[A-Z0-9]{8,16}$/.test(code)) throw new DemoHttpError(400, 'El código de invitación no es válido');
    const owner = this.db.users.find((u) => u.invite_code === code);
    if (!owner || owner.id === me) throw new DemoHttpError(404, 'Código de invitación inválido o ya usado');
    const existing = this.relation(me, owner.id);
    if (existing?.status === 'accepted') throw new DemoHttpError(409, 'Ya es tu contacto');
    // Simulated people keep their printed code so every visitor can try it.
    if (!owner.bot) owner.invite_code = newInviteCode();
    const now = new Date().toISOString();
    if (existing) this.db.friendships = this.db.friendships.filter((f) => f.id !== existing.id);
    const friendship: DbFriendship = { id: this.nextId(), requester_id: owner.id, addressee_id: me, status: 'accepted', created_at: now, updated_at: now };
    this.db.friendships.push(friendship);
    this.save();
    this.emitTo([me, owner.id], { type: 'friendship_updated', data: { friendshipId: friendship.id, status: 'accepted' } });
    if (owner.bot) this.later(`hello-${friendship.id}`, 1500, () => this.botSays(owner, me, owner.bot!.replies[0]));
    return this.friendshipView(friendship, me);
  }

  private acceptFriend(me: number, id: number): Friendship {
    const friendship = this.db.friendships.find((f) => f.id === id && f.addressee_id === me);
    if (!friendship) throw new DemoHttpError(404, 'Solicitud de amistad no encontrada');
    if (friendship.status !== 'pending') throw new DemoHttpError(409, 'Esta solicitud ya fue respondida');
    friendship.status = 'accepted';
    friendship.updated_at = new Date().toISOString();
    this.save();
    this.emitTo([me, friendship.requester_id], { type: 'friendship_updated', data: { friendshipId: id, status: 'accepted' } });
    const requester = this.findUser(friendship.requester_id);
    if (requester?.bot) this.later(`thanks-${id}`, 1500, () => this.botSays(requester, me, requester.bot!.replies[0]));
    return this.friendshipView(friendship, me);
  }

  private rejectFriend(me: number, id: number): Friendship {
    const friendship = this.db.friendships.find((f) => f.id === id && f.addressee_id === me && f.status === 'pending');
    if (!friendship) throw new DemoHttpError(404, 'Solicitud de amistad no encontrada');
    this.db.friendships = this.db.friendships.filter((f) => f.id !== id);
    this.save();
    return { ...this.friendshipView(friendship, me), status: 'rejected' };
  }

  private removeFriend(me: number, id: number): void {
    const friendship = this.db.friendships.find((f) => f.id === id && (f.requester_id === me || f.addressee_id === me));
    if (!friendship) throw new DemoHttpError(404, 'Solicitud de amistad no encontrada');
    this.db.friendships = this.db.friendships.filter((f) => f.id !== id);
    this.save();
    const other = friendship.requester_id === me ? friendship.addressee_id : friendship.requester_id;
    this.emitTo([me, other], { type: 'friendship_updated', data: { friendshipId: id, status: 'removed' } });
  }

  // --- Conversations ----------------------------------------------------------

  private conversations(me: number): Conversation[] {
    return this.db.conversations
      .filter((c) => c.members.some((m) => m.user_id === me && !m.left_at))
      .map((c) => this.conversationView(c, me));
  }

  private openDirect(me: number, friendId: number): Conversation {
    if (friendId === me) throw new DemoHttpError(403, 'No puedes abrir un chat contigo mismo');
    this.requireUser(friendId);
    if (this.relation(me, friendId)?.status !== 'accepted') throw new DemoHttpError(403, 'Solo puedes chatear con tus contactos');
    const conversation = this.directBetween(me, friendId) ?? this.createDirect(me, friendId);
    const mine = conversation.members.find((m) => m.user_id === me)!;
    if (mine.left_at) mine.left_at = null;
    this.save();
    return this.conversationView(conversation, me);
  }

  private leave(me: number, id: number): void {
    const conversation = this.activeConversation(me, id);
    conversation.members.find((m) => m.user_id === me)!.left_at = new Date().toISOString();
    this.save();
  }

  private messages(me: number, conversationId: number, query: URLSearchParams): { items: Message[]; hasMore: boolean } {
    this.activeConversation(me, conversationId);
    const before = Number(query.get('before')) || Infinity;
    const limit = Math.min(Math.max(Number(query.get('limit')) || 30, 1), PAGE_LIMIT);
    const older = this.db.messages.filter((m) => m.conversation_id === conversationId && m.id < before).sort((a, b) => b.id - a.id);
    return { items: older.slice(0, limit).reverse().map((m) => this.messageView(m)), hasMore: older.length > limit };
  }

  private sendMessage(me: number, conversationId: number, body: Record<string, unknown>): { message: Message; created: boolean } {
    const conversation = this.activeConversation(me, conversationId);
    const clientId = typeof body['client_id'] === 'string' ? body['client_id'] : null;
    if (clientId) {
      const existing = this.db.messages.find((m) => m.sender_id === me && m.client_id === clientId);
      if (existing) return { message: this.messageView(existing), created: false };
    }
    const content = typeof body['content'] === 'string' ? body['content'].trim() : '';
    const replyToId = typeof body['reply_to_id'] === 'number' ? body['reply_to_id'] : null;
    if (replyToId !== null && !this.db.messages.some((m) => m.id === replyToId && m.conversation_id === conversationId)) {
      throw new DemoHttpError(400, 'El mensaje al que respondes no existe o ya se autodestruyó');
    }
    const expiresIn = body['expires_in'];
    if (expiresIn !== undefined && (typeof expiresIn !== 'number' || expiresIn < 10 || expiresIn > 86400)) {
      throw new DemoHttpError(400, 'expires_in debe estar entre 10 y 86400 segundos');
    }
    const viewOnce = body['view_once'] === true;
    const attachmentIds = Array.isArray(body['attachment_ids']) ? (body['attachment_ids'] as number[]) : [];
    if (content.length > MAX_MESSAGE) throw new DemoHttpError(400, `El mensaje no puede superar ${MAX_MESSAGE} caracteres`);
    if (!content && !attachmentIds.length) throw new DemoHttpError(400, 'El mensaje no puede estar vacío');
    const attachments = attachmentIds.map((id) => this.db.attachments.find((a) => a.id === id));
    if (attachments.some((a) => !a || a.uploader_id !== me || a.conversation_id !== conversationId || a.message_id !== null)) {
      throw new DemoHttpError(400, 'Algún adjunto no existe o ya se envió');
    }
    const message: DbMessage = {
      id: this.nextId(),
      conversation_id: conversationId,
      sender_id: me,
      content,
      message_type: attachments.length ? (attachments.every((a) => a!.is_image) ? 'image' : attachments.every((a) => a!.is_video) ? 'video' : 'file') : 'text',
      reply_to_id: replyToId,
      client_id: clientId,
      created_at: new Date().toISOString(),
      attachment_ids: attachmentIds,
      expires_at: typeof expiresIn === 'number' ? new Date(Date.now() + expiresIn * 1000).toISOString() : null,
      view_once: viewOnce,
    };
    attachments.forEach((a) => (a!.message_id = message.id));
    this.db.messages.push(message);
    conversation.last_message_at = message.created_at;
    for (const member of conversation.members) {
      if (member.user_id === me) {
        member.last_read_message_id = message.id;
        member.last_delivered_message_id = message.id;
      } else if (member.left_at) {
        // The chat reappears for whoever had hidden it.
        member.left_at = null;
        this.emitTo([member.user_id], { type: 'conversation_updated', data: { conversationId } });
      }
    }
    this.save();
    if (message.expires_at) this.schedulePurge();
    const view = this.messageView(message);
    this.emitTo(this.memberIds(conversation), { type: 'new_message', data: view });
    for (const other of this.otherMemberIds(conversation, me)) {
      const user = this.findUser(other);
      if (user?.bot) this.botReceives(user, conversation, message);
    }
    return { message: view, created: true };
  }

  private markRead(me: number, conversationId: number, messageId?: number): number {
    const conversation = this.activeConversation(me, conversationId);
    const member = conversation.members.find((m) => m.user_id === me)!;
    const newest = this.newestId(conversationId);
    const target = Math.min(messageId ?? newest, newest);
    const read = Math.max(member.last_read_message_id ?? 0, target);
    if (read !== member.last_read_message_id) {
      member.last_read_message_id = read;
      member.last_delivered_message_id = Math.max(member.last_delivered_message_id ?? 0, read);
      this.save();
      this.emitTo(this.memberIds(conversation), { type: 'conversation_read', data: { conversationId, userId: me, lastReadMessageId: read } });
    }
    this.startViewOnceTimers(me, conversation, read);
    return read;
  }

  /** Read view-once messages get a 30 s deadline, announced to both. */
  private startViewOnceTimers(reader: number, conversation: DbConversation, upTo: number): void {
    const deadline = new Date(Date.now() + VIEW_ONCE_MS).toISOString();
    const opened = this.db.messages.filter(
      (m) => m.conversation_id === conversation.id && m.view_once && !m.expires_at && m.sender_id !== reader && m.id <= upTo,
    );
    if (!opened.length) return;
    opened.forEach((m) => (m.expires_at = deadline));
    this.save();
    this.schedulePurge();
    this.emitTo(this.memberIds(conversation), {
      type: 'messages_expiring',
      data: { conversationId: conversation.id, items: opened.map((m) => ({ id: m.id, expires_at: deadline })) },
    });
  }

  /** «Autodestruir»: messages, files and the chat itself, for both members. */
  private destroy(me: number, id: number): void {
    const conversation = this.db.conversations.find((c) => c.id === id && c.members.some((m) => m.user_id === me));
    if (!conversation) throw new DemoHttpError(404, 'Conversación no encontrada');
    for (const message of this.db.messages.filter((m) => m.conversation_id === id)) this.forgetFiles(message);
    this.db.attachments.filter((a) => a.conversation_id === id).forEach((a) => this.revokeBlob(a.id));
    this.db.attachments = this.db.attachments.filter((a) => a.conversation_id !== id);
    this.db.messages = this.db.messages.filter((m) => m.conversation_id !== id);
    this.db.conversations = this.db.conversations.filter((c) => c.id !== id);
    for (const member of conversation.members) this.cancel(`reply-${id}-${member.user_id}`);
    this.save();
    this.emitTo(this.memberIds(conversation), { type: 'conversation_destroyed', data: { conversationId: id } });
  }

  private deleteMessages(messages: DbMessage[]): void {
    const ids = new Set(messages.map((m) => m.id));
    messages.forEach((m) => this.forgetFiles(m));
    this.db.messages = this.db.messages.filter((m) => !ids.has(m.id));
    // Like ON DELETE SET NULL on reply_to_id.
    for (const m of this.db.messages) if (m.reply_to_id !== null && ids.has(m.reply_to_id)) m.reply_to_id = null;
    this.save();
    const byConversation = new Map<number, number[]>();
    for (const m of messages) byConversation.set(m.conversation_id, [...(byConversation.get(m.conversation_id) ?? []), m.id]);
    for (const [conversationId, list] of byConversation) {
      const conversation = this.db.conversations.find((c) => c.id === conversationId);
      if (conversation) this.emitTo(this.memberIds(conversation), { type: 'messages_deleted', data: { conversationId, ids: list } });
    }
  }

  private forgetFiles(message: DbMessage): void {
    for (const id of message.attachment_ids) this.revokeBlob(id);
    const files = new Set(message.attachment_ids);
    this.db.attachments = this.db.attachments.filter((a) => !files.has(a.id));
  }

  private revokeBlob(id: number): void {
    const blob = this.blobUrls.get(id);
    if (blob) URL.revokeObjectURL(blob);
    this.blobUrls.delete(id);
  }

  /** One timer, set for the nearest explicit deadline (ephemeral or view-once). */
  private schedulePurge(now = Date.now()): void {
    clearTimeout(this.purgeTimer);
    const next = this.db.messages.reduce((min, m) => (m.expires_at ? Math.min(min, new Date(m.expires_at).getTime()) : min), Infinity);
    if (next === Infinity) return;
    this.purgeTimer = setTimeout(() => this.purge(), Math.max(0, next - now) + 50);
  }

  private markDelivered(me: number, conversationId: number, messageId?: number): number {
    const conversation = this.activeConversation(me, conversationId);
    const member = conversation.members.find((m) => m.user_id === me)!;
    const newest = this.newestId(conversationId);
    const delivered = Math.max(member.last_delivered_message_id ?? 0, Math.min(messageId ?? newest, newest));
    if (delivered !== member.last_delivered_message_id) {
      member.last_delivered_message_id = delivered;
      this.save();
      this.emitTo(this.memberIds(conversation), {
        type: 'conversation_delivered',
        data: { conversationId, userId: me, lastDeliveredMessageId: delivered },
      });
    }
    return delivered;
  }

  private markAllDelivered(me: number): void {
    for (const conversation of this.db.conversations) {
      const member = conversation.members.find((m) => m.user_id === me && !m.left_at);
      if (member && (member.last_delivered_message_id ?? 0) < this.newestId(conversation.id)) this.markDelivered(me, conversation.id);
    }
  }

  private attachmentUrl(me: number, id: number): { url: string; expiresIn: number } {
    const attachment = this.db.attachments.find((a) => a.id === id);
    const conversation = attachment && this.db.conversations.find((c) => c.id === attachment.conversation_id);
    const allowed = conversation?.members.some((m) => m.user_id === me && !m.left_at) && (attachment!.message_id !== null || attachment!.uploader_id === me);
    const url = attachment && (attachment.data_url ?? this.blobUrls.get(id));
    if (!allowed || !url) throw new DemoHttpError(404, 'Archivo no encontrado');
    return { url, expiresIn: 300 };
  }

  private discardAttachment(me: number, id: number): void {
    const attachment = this.db.attachments.find((a) => a.id === id && a.uploader_id === me && a.message_id === null);
    if (!attachment) throw new DemoHttpError(404, 'Archivo no encontrado');
    this.db.attachments = this.db.attachments.filter((a) => a.id !== id);
    this.revokeBlob(id);
    this.save();
  }

  // --- Simulated people ---------------------------------------------------------

  /** Delivered → read → typing → answer, like a person on the other side. */
  private botReceives(bot: DbUser, conversation: DbConversation, message: DbMessage): void {
    const key = `reply-${conversation.id}-${bot.id}`;
    const human = message.sender_id;
    // A new message restarts the reaction: the bot answers the latest one.
    this.cancel(key);
    const reply = () => this.replyFor(bot, human, message);
    if (!bot.bot!.online) {
      // Offline friends come online a bit later, read and answer, then leave.
      this.later(key, 6000, () => {
        this.setBotOnline(bot, true);
        this.markDelivered(bot.id, conversation.id);
        // Coming back, they first apologise for the delay (their own line).
        this.later(key, 1200, () => this.botReadsAndAnswers(bot, conversation, human, bot.bot!.replies[0] ?? reply(), key, true));
      });
      return;
    }
    this.later(key, 600, () => {
      this.markDelivered(bot.id, conversation.id);
      this.later(key, 900, () => this.botReadsAndAnswers(bot, conversation, human, reply(), key, false));
    });
  }

  private botReadsAndAnswers(bot: DbUser, conversation: DbConversation, human: number, text: string, key: string, goOffline: boolean): void {
    this.markRead(bot.id, conversation.id);
    this.later(key, 700, () => {
      this.botTyping(bot, human, conversation.id, true);
      this.later(key, Math.min(1200 + text.length * 25, 3200), () => {
        this.botTyping(bot, human, conversation.id, false);
        this.sendMessage(bot.id, conversation.id, { content: text });
        if (goOffline) this.later(`offline-${bot.id}`, 15000, () => this.setBotOnline(bot, false));
      });
    });
  }

  /** A bot opens (or reuses) the chat and writes first. */
  private botSays(bot: DbUser, to: number, text: string): void {
    if (this.relation(bot.id, to)?.status !== 'accepted') return;
    const conversation = this.directBetween(bot.id, to) ?? this.createDirect(bot.id, to);
    const key = `reply-${conversation.id}-${bot.id}`;
    this.botTyping(bot, to, conversation.id, true);
    this.later(key, 1500, () => {
      this.botTyping(bot, to, conversation.id, false);
      this.sendMessage(bot.id, conversation.id, { content: text });
    });
  }

  private botTyping(bot: DbUser, to: number, conversationId: number, isTyping: boolean): void {
    if (bot.hide_typing) return;
    this.emitTo([to], { type: 'typing', data: { conversationId, userId: bot.id, username: bot.username, isTyping } });
  }

  private replyFor(bot: DbUser, human: number, message: DbMessage): string {
    const name = this.findUser(human)?.username ?? '';
    const text = normalize(message.content);
    if (message.attachment_ids.length) {
      return message.message_type === 'image' ? 'Ya la vi… y ya se borró 🙈' : 'Recibido 💜';
    }
    if (/^(hola|buenas|hey|holi|que mas|q mas|saludos)\b/.test(text)) return `Hola, ${name} 🌙 ¿Cómo va tu día?`;
    if (/gracias/.test(text)) return 'Siempre 💜';
    if (/(adios|chao|hasta luego|nos vemos|buenas noches)/.test(text)) return 'Hasta pronto. Borra el rastro 😉';
    if (text.includes('?')) {
      const answers = ['Mmm… creo que sí 😏', 'Sí, cuenta conmigo', 'Dímelo tú primero 🙈'];
      return answers[message.id % answers.length];
    }
    const replies = bot.bot!.replies;
    const count = this.replyCounters.get(bot.id) ?? 0;
    this.replyCounters.set(bot.id, count + 1);
    return replies[count % replies.length];
  }

  private setBotOnline(bot: DbUser, online: boolean): void {
    bot.bot!.online = online;
    if (!online) bot.last_seen = new Date().toISOString();
    this.save();
    this.broadcastPresence(bot.id);
  }

  // --- Helpers ----------------------------------------------------------------

  private later(key: string, ms: number, task: () => void): void {
    const timer = setTimeout(() => {
      const list = this.replyTimers.get(key);
      if (list) this.replyTimers.set(key, list.filter((t) => t !== timer));
      try {
        task();
      } catch {
        /* the conversation or friendship changed meanwhile */
      }
    }, ms * this.speed);
    this.replyTimers.set(key, [...(this.replyTimers.get(key) ?? []), timer]);
  }

  private cancel(key: string): void {
    this.replyTimers.get(key)?.forEach(clearTimeout);
    this.replyTimers.delete(key);
  }

  private emitTo(userIds: number[], event: ServerEvent): void {
    // Async, like a network: the HTTP response arrives before the socket echo.
    queueMicrotask(() => this.bus.next({ userIds, event }));
  }

  /** Hidden users are never announced, except the "went hidden" update itself. */
  private broadcastPresence(userId: number, force = false): void {
    const user = this.findUser(userId);
    if (!user || (user.hide_last_seen && !force)) return;
    const contacts = this.contactsOf(userId);
    if (contacts.length) this.emitTo(contacts, { type: 'presence', data: this.presenceOf(user) });
  }

  private snapshotFor(userId: number): PresenceUpdate[] {
    return this.contactsOf(userId)
      .map((id) => this.findUser(id))
      .filter((u): u is DbUser => !!u)
      .map((u) => this.presenceOf(u));
  }

  /** Friends and people with a shared conversation. */
  private contactsOf(userId: number): number[] {
    const ids = new Set<number>();
    for (const f of this.db.friendships) {
      if (f.status !== 'accepted') continue;
      if (f.requester_id === userId) ids.add(f.addressee_id);
      if (f.addressee_id === userId) ids.add(f.requester_id);
    }
    for (const c of this.db.conversations) {
      if (c.members.some((m) => m.user_id === userId)) c.members.forEach((m) => m.user_id !== userId && ids.add(m.user_id));
    }
    return [...ids];
  }

  private isOnline(user: DbUser): boolean {
    return user.bot ? user.bot.online : (this.sockets.get(user.id) ?? 0) > 0;
  }

  private presenceOf(user: DbUser): PresenceUpdate {
    if (user.hide_last_seen) return { userId: user.id, online: false, lastSeen: null };
    const online = this.isOnline(user);
    return { userId: user.id, online, lastSeen: online ? null : user.last_seen };
  }

  private publicUser(user: DbUser): User {
    const presence = this.presenceOf(user);
    return {
      id: user.id,
      username: user.username,
      avatar_url: user.avatar_url,
      status_message: user.status_message ?? null,
      status: presence.online ? 'online' : 'offline',
      last_seen: presence.lastSeen,
      hide_last_seen: !!user.hide_last_seen,
      hide_typing: !!user.hide_typing,
      created_at: user.created_at,
    };
  }

  private friendshipView(f: DbFriendship, me: number): Friendship {
    const other = this.findUser(f.requester_id === me ? f.addressee_id : f.requester_id)!;
    return {
      id: f.id,
      status: f.status,
      direction: f.requester_id === me ? 'outgoing' : 'incoming',
      friend: this.publicUser(other),
      created_at: f.created_at,
      updated_at: f.updated_at,
    };
  }

  private conversationView(c: DbConversation, me: number): Conversation {
    const mine = c.members.find((m) => m.user_id === me);
    const messages = this.db.messages.filter((m) => m.conversation_id === c.id);
    const last = messages.reduce<DbMessage | null>((newest, m) => (!newest || m.id > newest.id ? m : newest), null);
    return {
      id: c.id,
      type: c.type,
      name: null,
      avatar_url: null,
      last_message_at: c.last_message_at,
      members: c.members.map((m) => ({
        id: m.id,
        conversation_id: c.id,
        user_id: m.user_id,
        user: this.publicUser(this.findUser(m.user_id)!),
        role: 'member',
        last_read_message_id: m.last_read_message_id,
        last_delivered_message_id: m.last_delivered_message_id,
        left_at: m.left_at,
      })),
      last_message: last ? this.messageView(last) : null,
      unread_count: messages.filter((m) => m.sender_id !== me && m.id > (mine?.last_read_message_id ?? 0)).length,
      retention_seconds: RETENTION_MS / 1000,
    };
  }

  private messageView(m: DbMessage): Message {
    const quoted = m.reply_to_id === null ? undefined : this.db.messages.find((r) => r.id === m.reply_to_id);
    return {
      id: m.id,
      conversation_id: m.conversation_id,
      sender_id: m.sender_id,
      sender: this.publicUser(this.findUser(m.sender_id)!),
      content: m.content,
      message_type: m.message_type,
      reply_to_id: m.reply_to_id,
      reply_to: quoted ? { id: quoted.id, sender_id: quoted.sender_id, content: quoted.content, message_type: quoted.message_type } : null,
      client_id: m.client_id,
      created_at: m.created_at,
      expires_at: m.expires_at ?? null,
      view_once: !!m.view_once,
      attachments: m.attachment_ids
        .map((id) => this.db.attachments.find((a) => a.id === id))
        .filter((a): a is DbAttachment => !!a)
        .map((a) => this.attachmentView(a)),
    };
  }

  private attachmentView(a: DbAttachment): Attachment {
    return {
      id: a.id,
      message_id: a.message_id,
      file_name: a.file_name,
      file_type: a.file_type,
      file_size: a.file_size,
      is_image: a.is_image,
      is_video: !!a.is_video,
    };
  }

  private activeConversation(me: number, id: number): DbConversation {
    const conversation = this.db.conversations.find((c) => c.id === id && c.members.some((m) => m.user_id === me && !m.left_at));
    if (!conversation) throw new DemoHttpError(404, 'Conversación no encontrada');
    return conversation;
  }

  private directBetween(a: number, b: number): DbConversation | undefined {
    return this.db.conversations.find((c) => c.type === 'direct' && c.members.some((m) => m.user_id === a) && c.members.some((m) => m.user_id === b));
  }

  private createDirect(a: number, b: number): DbConversation {
    const conversation: DbConversation = {
      id: this.nextId(),
      type: 'direct',
      created_at: new Date().toISOString(),
      last_message_at: null,
      members: [a, b].map((userId) => ({ id: this.nextId(), user_id: userId, last_read_message_id: null, last_delivered_message_id: null, left_at: null })),
    };
    this.db.conversations.push(conversation);
    this.save();
    this.emitTo([a, b], { type: 'conversation_updated', data: { conversationId: conversation.id } });
    return conversation;
  }

  private relation(a: number, b: number): DbFriendship | undefined {
    return this.db.friendships.find((f) => (f.requester_id === a && f.addressee_id === b) || (f.requester_id === b && f.addressee_id === a));
  }

  private memberIds(conversation: DbConversation): number[] {
    return conversation.members.map((m) => m.user_id);
  }

  private otherMemberIds(conversation: DbConversation, me: number): number[] {
    return conversation.members.filter((m) => m.user_id !== me).map((m) => m.user_id);
  }

  private newestId(conversationId: number): number {
    return this.db.messages.reduce((max, m) => (m.conversation_id === conversationId && m.id > max ? m.id : max), 0);
  }

  private findUser(id: number): DbUser | undefined {
    return this.db.users.find((u) => u.id === id);
  }

  private requireUser(id: number): DbUser {
    const user = this.findUser(id);
    if (!user) throw new DemoHttpError(404, 'Usuario no encontrado');
    return user;
  }

  /** "K7QM2XRP9D" → "K7QM-2XRP-9D", as the API shows it. */
  private formatCode(code: string): string {
    return [code.slice(0, 4), code.slice(4, 8), code.slice(8)].filter(Boolean).join('-');
  }

  private nextId(): number {
    return ++this.db.seq;
  }

  private created(status: number, body: unknown): DemoResponse {
    return { status, body };
  }

  private save(): void {
    saveDb(this.db);
  }
}

