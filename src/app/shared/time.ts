const TIME = new Intl.DateTimeFormat('es-CO', { hour: 'numeric', minute: '2-digit' });
const WEEKDAY = new Intl.DateTimeFormat('es-CO', { weekday: 'long' });
const SHORT_DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const LONG_DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
const RELATIVE = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });

const startOfDay = (date: Date): number => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
const daysBetween = (a: Date, b: Date): number => Math.round((startOfDay(b) - startOfDay(a)) / 86_400_000);
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

/** "3:45 p. m." */
export function timeLabel(value: string | Date): string {
  return TIME.format(new Date(value));
}

/** Separator between days in a conversation: "Hoy", "Ayer", "Lunes", "3 de octubre de 2026". */
export function dayLabel(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  const days = daysBetween(date, now);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  if (days > 1 && days < 7) return capitalize(WEEKDAY.format(date));
  return LONG_DATE.format(date);
}

/** Compact time for the conversation list: "3:45 p. m.", "Ayer", "lunes", "3 oct". */
export function listTimeLabel(value: string | Date, now = new Date()): string {
  const date = new Date(value);
  const days = daysBetween(date, now);
  if (days === 0) return timeLabel(date);
  if (days === 1) return 'Ayer';
  if (days > 1 && days < 7) return WEEKDAY.format(date);
  return SHORT_DATE.format(date);
}

/** "en línea", "visto hace 5 minutos", "visto ayer a las 3:45 p. m.". */
export function lastSeenLabel(lastSeen: string | null | undefined, now = new Date()): string {
  if (!lastSeen) return 'desconectado';
  const date = new Date(lastSeen);
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  if (seconds > -60) return 'visto hace un momento';
  if (seconds > -3600) return `visto ${RELATIVE.format(Math.round(seconds / 60), 'minute')}`;
  const days = daysBetween(date, now);
  if (days === 0) return `visto hoy a las ${timeLabel(date)}`;
  if (days === 1) return `visto ayer a las ${timeLabel(date)}`;
  return `visto el ${SHORT_DATE.format(date)}`;
}

export function isSameDay(a: string | Date, b: string | Date): boolean {
  return startOfDay(new Date(a)) === startOfDay(new Date(b));
}

export function fileSizeLabel(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
