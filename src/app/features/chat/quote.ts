import type { MessageQuote } from '../../core/models';

/** One-line summary of a quoted message (media is described, never shown). */
export function quoteText(quote: Pick<MessageQuote, 'content' | 'message_type'>): string {
  const text = quote.content.trim();
  if (text) return text.length > 120 ? `${text.slice(0, 120)}…` : text;
  if (quote.message_type === 'image') return '📷 Foto';
  if (quote.message_type === 'video') return '🎬 Video';
  return 'Mensaje';
}
