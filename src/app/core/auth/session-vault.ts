/**
 * Encrypts the refresh token with a key derived from the user's PIN
 * (PBKDF2-SHA-256 → AES-GCM-256, WebCrypto). Without the PIN, the token
 * stored on the device is useless.
 *
 * Format: `pin1.<salt>.<iv>.<ciphertext>` (base64url).
 */
export const VAULT_PREFIX = 'pin1.';
export const PBKDF2_ITERATIONS = 310_000;
export const PIN_PATTERN = /^\d{4,8}$/;

export interface VaultKey {
  key: CryptoKey;
  salt: Uint8Array<ArrayBuffer>;
}

const b64 = (bytes: Uint8Array): string =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const unb64 = (text: string): Uint8Array<ArrayBuffer> => {
  const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(new ArrayBuffer(binary.length));
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const isVaulted = (stored: string | null): stored is string => !!stored && stored.startsWith(VAULT_PREFIX);

export async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer> = crypto.getRandomValues(new Uint8Array(16))): Promise<VaultKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
  return { key, salt };
}

export async function seal(vault: VaultKey, secret: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.key, new TextEncoder().encode(secret));
  return `${VAULT_PREFIX}${b64(vault.salt)}.${b64(iv)}.${b64(new Uint8Array(data))}`;
}

/** Salt stored in a sealed value (to derive the key again from the PIN). */
export function saltOf(sealed: string): Uint8Array<ArrayBuffer> {
  return unb64(sealed.slice(VAULT_PREFIX.length).split('.')[0] ?? '');
}

/** Returns the secret, or null if the PIN (key) is wrong or the value is damaged. */
export async function open(vault: VaultKey, sealed: string): Promise<string | null> {
  try {
    const [, iv, data] = sealed.slice(VAULT_PREFIX.length).split('.');
    if (!iv || !data) return null;
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(iv) }, vault.key, unb64(data));
    return new TextDecoder().decode(plain);
  } catch {
    return null;
  }
}

/** Derives the key from the PIN and opens the sealed value in one go. */
export async function unlock(pin: string, sealed: string): Promise<{ vault: VaultKey; secret: string } | null> {
  if (!isVaulted(sealed)) return null;
  const vault = await deriveKey(pin, saltOf(sealed));
  const secret = await open(vault, sealed);
  return secret === null ? null : { vault, secret };
}
