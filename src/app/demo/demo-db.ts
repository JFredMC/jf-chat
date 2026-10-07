/**
 * Data of the in-browser demo backend. It mirrors the API entities and is
 * kept in localStorage so a reload keeps the session and the chats.
 */

export interface DbUser {
  id: number;
  username: string;
  avatar_url: string | null;
  /** Personal status, up to 140 characters. */
  status_message?: string | null;
  password: string;
  created_at: string;
  last_seen: string | null;
  /** Single-use code to become someone's contact (XXXXXXXXXX, no dashes). */
  invite_code: string;
  hide_last_seen?: boolean;
  hide_typing?: boolean;
  /** Simulated people: they answer, type and read. */
  bot?: { online: boolean; replies: string[] };
}

export interface DbFriendship {
  id: number;
  requester_id: number;
  addressee_id: number;
  status: 'pending' | 'accepted';
  created_at: string;
  updated_at: string;
}

export interface DbMember {
  id: number;
  user_id: number;
  last_read_message_id: number | null;
  last_delivered_message_id: number | null;
  left_at: string | null;
}

export interface DbConversation {
  id: number;
  type: 'direct';
  created_at: string;
  last_message_at: string | null;
  members: DbMember[];
}

export interface DbMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  content: string;
  message_type: 'text' | 'image' | 'file';
  reply_to_id: number | null;
  client_id: string | null;
  created_at: string;
  attachment_ids: number[];
}

export interface DbAttachment {
  id: number;
  conversation_id: number;
  uploader_id: number;
  message_id: number | null;
  file_name: string;
  file_type: string;
  file_size: number;
  is_image: boolean;
  /** Small files are kept as data URLs so they survive a reload. */
  data_url: string | null;
}

export interface DemoDb {
  version: number;
  seq: number;
  users: DbUser[];
  friendships: DbFriendship[];
  conversations: DbConversation[];
  messages: DbMessage[];
  attachments: DbAttachment[];
  /** refresh token -> user id */
  refreshTokens: Record<string, number>;
}

export const DB_VERSION = 3;
export const STORAGE_KEY = 'velo.demo.db';
/** Before the Velo rename; dropped on load. */
const LEGACY_STORAGE_KEY = 'jfchat.demo.db';
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'Demo1234';
/** Codes printed in the demo hints: simulated people keep them (they never rotate). */
export const DEMO_CODES = { luna: 'LUNA-DEMO-26', sol: 'SOLE-DEMO-26' } as const;

const INVITE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const newInviteCode = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join('');
};
export const normalizeInvite = (value: string): string => value.toUpperCase().replace(/[^A-Z0-9]/g, '');

const minutesAgo = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString();

/**
 * The world the visitor finds: their partner (Luna) with a recent chat, and
 * Sol, a simulated person reachable only through an invite code.
 */
export function seedDb(now = Date.now()): DemoDb {
  let seq = 0;
  const id = () => ++seq;
  const user = (username: string, code: string, bot?: DbUser['bot'], lastSeenMinutes: number | null = null): DbUser => ({
    id: id(),
    username,
    avatar_url: null,
    password: DEMO_PASSWORD,
    created_at: minutesAgo(now, 60 * 24 * 90),
    last_seen: lastSeenMinutes === null ? null : minutesAgo(now, lastSeenMinutes),
    invite_code: normalizeInvite(code),
    bot,
  });

  const me = user(DEMO_USERNAME, newInviteCode());
  const luna = user(
    'luna',
    DEMO_CODES.luna,
    {
      online: true,
      replies: [
        'Me sacaste una sonrisa 😊',
        'Te extraño un poquito más que ayer',
        'Aquí nadie nos lee 🤫',
        '¿Mañana a la misma hora?',
        'Prometido 💜',
      ],
    },
    2,
  );
  const sol = user(
    'sol',
    DEMO_CODES.sol,
    {
      online: true,
      replies: ['¡Hola! Usaste mi código: ya podemos hablar 👋', 'Todo lo que escribas aquí desaparece en 24 horas ✨', '¿Probaste ocultar tu última conexión? 😉'],
    },
    20,
  );
  sol.hide_last_seen = true;
  me.status_message = '🌙';
  luna.status_message = 'Solo para ti ✨';

  const friendship = (a: DbUser, b: DbUser, status: DbFriendship['status'], minutes: number): DbFriendship => ({
    id: id(),
    requester_id: a.id,
    addressee_id: b.id,
    status,
    created_at: minutesAgo(now, minutes),
    updated_at: minutesAgo(now, minutes),
  });

  const db: DemoDb = {
    version: DB_VERSION,
    seq: 0,
    users: [me, luna, sol],
    friendships: [friendship(luna, me, 'accepted', 60 * 24 * 30)],
    conversations: [],
    messages: [],
    attachments: [],
    refreshTokens: {},
  };

  const chat = (other: DbUser, lines: [DbUser, string, number][], readByMe: boolean, readByOther: boolean) => {
    const conversationId = id();
    const messages = lines.map(([sender, content, minutes]): DbMessage => ({
      id: id(),
      conversation_id: conversationId,
      sender_id: sender.id,
      content,
      message_type: 'text',
      reply_to_id: null,
      client_id: null,
      created_at: minutesAgo(now, minutes),
      attachment_ids: [],
    }));
    const last = messages.at(-1)!;
    const lastFromOther = [...messages].reverse().find((m) => m.sender_id === other.id);
    const lastFromMe = [...messages].reverse().find((m) => m.sender_id === me.id);
    db.messages.push(...messages);
    db.conversations.push({
      id: conversationId,
      type: 'direct',
      created_at: messages[0].created_at,
      last_message_at: last.created_at,
      members: [
        {
          id: id(),
          user_id: me.id,
          last_read_message_id: readByMe ? last.id : (lastFromMe?.id ?? null),
          last_delivered_message_id: last.id,
          left_at: null,
        },
        {
          id: id(),
          user_id: other.id,
          last_read_message_id: readByOther ? last.id : (lastFromOther?.id ?? null),
          last_delivered_message_id: readByOther ? last.id : (lastFromOther?.id ?? null),
          left_at: null,
        },
      ],
    });
  };

  chat(
    luna,
    [
      [luna, '¿Ya saliste? 🌙', 60 * 5],
      [me, 'Recién. Hoy fue eterno', 60 * 5 - 2],
      [luna, 'Te guardé un abrazo largo para esta noche', 60 * 5 - 3],
      [me, 'Lo cobro sin falta 😌', 60 * 5 - 4],
      [luna, 'Recuerda que aquí todo se borra solo en 24 horas', 40],
      [luna, 'Escríbeme algo y te contesto 😉', 39],
    ],
    false,
    true,
  );
  db.seq = seq;
  return db;
}

export function loadDb(): DemoDb | null {
  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const db = JSON.parse(raw) as DemoDb;
    return db.version === DB_VERSION ? db : null;
  } catch {
    return null;
  }
}

export function saveDb(db: DemoDb): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Quota exceeded (big attachments): drop stored files and try again.
    try {
      const light = { ...db, attachments: db.attachments.map((a) => ({ ...a, data_url: null })) };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(light));
    } catch {
      /* the demo keeps working in memory */
    }
  }
}
