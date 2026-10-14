/**
 * Decoy PIN: a second PIN that opens an empty Velo. Only a salted PBKDF2
 * hash is kept on the device, under a neutral key.
 */
const KEY = 'velo.lock.alt';
const ITERATIONS = 150_000;

const b64 = (bytes: Uint8Array): string => btoa(String.fromCharCode(...bytes));
const unb64 = (text: string): Uint8Array => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function digest(pin: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: ITERATIONS }, key, 256);
  return b64(new Uint8Array(bits));
}

export function hasDecoyPin(): boolean {
  try {
    return !!localStorage.getItem(KEY);
  } catch {
    return false;
  }
}

export async function saveDecoyPin(pin: string): Promise<void> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  localStorage.setItem(KEY, JSON.stringify({ s: b64(salt), h: await digest(pin, salt) }));
}

export function removeDecoyPin(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

export async function isDecoyPin(pin: string): Promise<boolean> {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return false;
    const { s, h } = JSON.parse(raw) as { s: string; h: string };
    return (await digest(pin, unb64(s))) === h;
  } catch {
    return false;
  }
}
