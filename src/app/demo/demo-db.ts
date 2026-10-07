/**
 * Data of the in-browser demo backend. It mirrors the API entities and is
 * kept in localStorage so a reload keeps the session and the chats.
 */

export interface DbUser {
  id: number;
  username: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  /** Personal status, up to 140 characters. */
  status_message?: string | null;
  password: string;
  created_at: string;
  last_seen: string | null;
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

export const DB_VERSION = 2;
export const STORAGE_KEY = 'jfchat.demo.db';
export const DEMO_USERNAME = 'demo';
export const DEMO_PASSWORD = 'Demo1234';

const minutesAgo = (now: number, minutes: number) => new Date(now - minutes * 60_000).toISOString();

/** The world the visitor finds: friends with history, a pending request and people to add. */
export function seedDb(now = Date.now()): DemoDb {
  let seq = 0;
  const id = () => ++seq;
  const user = (username: string, first: string, last: string, bot?: DbUser['bot'], lastSeenMinutes: number | null = null): DbUser => ({
    id: id(),
    username,
    first_name: first,
    last_name: last,
    avatar_url: null,
    password: DEMO_PASSWORD,
    created_at: minutesAgo(now, 60 * 24 * 90),
    last_seen: lastSeenMinutes === null ? null : minutesAgo(now, lastSeenMinutes),
    bot,
  });

  const me = user(DEMO_USERNAME, 'Invitado', 'Demo');
  const laura = user('laura.mendez', 'Laura', 'Méndez', {
    online: true,
    replies: [
      '¡Me parece perfecto! 🙌',
      'Jaja, totalmente de acuerdo 😄',
      'Déjame revisarlo y te cuento en un rato.',
      '¿Nos vemos mañana a las 10 entonces?',
      'Gracias por avisar 💜',
    ],
  });
  const carlos = user('carlos.dev', 'Carlos', 'Rincón', {
    online: true,
    replies: [
      'Listo, ya hice el merge del PR 🚀',
      '¿Probaste con la última versión de Angular?',
      'Buena idea, lo agrego al backlog.',
      'Los tests pasan en verde ✅',
      'Te comparto el enlace: https://angular.dev',
    ],
  }, 3);
  const sofia = user('sofia_r', 'Sofía', 'Ramírez', { online: false, replies: ['¡Perdón, estaba sin señal! Ya leí todo 😊'] }, 140);
  const andres = user('andres.p', 'Andrés', 'Pérez', { online: true, replies: ['¡Gracias por aceptar! 👋 ¿Cómo va todo?'] }, 10);
  const valentina = user('valentina.c', 'Valentina', 'Castro', { online: true, replies: ['¡Hola! Gracias por agregarme 😊', '¡Claro que sí!'] }, 30);
  const mateo = user('mateo.g', 'Mateo', 'Gómez', { online: false, replies: ['¡Hola! 👋'] }, 60 * 26);
  laura.status_message = '☕ Con café y buena música';
  carlos.status_message = '💻 Programando, respondo luego';
  sofia.status_message = '✈️ De viaje hasta el lunes';

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
    users: [me, laura, carlos, sofia, andres, valentina, mateo],
    friendships: [
      friendship(laura, me, 'accepted', 60 * 24 * 30),
      friendship(me, carlos, 'accepted', 60 * 24 * 20),
      friendship(sofia, me, 'accepted', 60 * 24 * 10),
      friendship(andres, me, 'pending', 45),
    ],
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
    laura,
    [
      [laura, '¡Hola! ¿Viste el nuevo diseño del chat? 😍', 60 * 3],
      [me, 'Sí, quedó increíble. Ahora tiene modo oscuro 🌙', 60 * 3 - 2],
      [laura, 'Y los ✓✓ azules cuando lees los mensajes', 60 * 3 - 3],
      [me, 'Exacto, y el indicador de «escribiendo…»', 60 * 3 - 5],
      [laura, '¿Almorzamos mañana para celebrarlo?', 12],
      [laura, 'Escríbeme algo para probar las respuestas automáticas 😉', 11],
    ],
    false,
    true,
  );
  chat(
    carlos,
    [
      [me, 'Carlos, ¿cómo vas con la migración a Angular 22?', 60 * 26],
      [carlos, 'Ya casi: signals, zoneless y Vitest funcionando ⚡', 60 * 26 - 4],
      [me, '¡Genial! Avísame cuando abras el PR', 60 * 26 - 6],
      [carlos, 'Hecho, la CI está en verde ✅', 60 * 25],
      [me, 'Perfecto, lo reviso hoy 👍', 60 * 25 - 1],
    ],
    true,
    true,
  );
  chat(
    sofia,
    [
      [sofia, '¿Me pasas las notas de la reunión?', 60 * 24 * 4],
      [me, 'Claro, te las envío en la tarde', 60 * 24 * 4 - 10],
      [me, '¿Pudiste revisarlas?', 60 * 3],
    ],
    true,
    false,
  );
  db.seq = seq;
  return db;
}

export function loadDb(): DemoDb | null {
  try {
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
