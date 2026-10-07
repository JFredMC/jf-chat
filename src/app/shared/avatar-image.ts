/** Rules for the profile photo picked on the client (the API re-validates). */
export const AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp';
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;
export const AVATAR_OUTPUT_SIZE = 512;

/** Spanish error for a picked file, or null if it is acceptable. */
export function avatarFileError(file: Pick<File, 'type' | 'size'>): string | null {
  if (!AVATAR_ACCEPT.split(',').includes(file.type)) return 'Elige una imagen JPG, PNG o WebP.';
  if (file.size <= 0) return 'La imagen está vacía.';
  if (file.size > AVATAR_MAX_BYTES) return 'La imagen supera el máximo de 5 MB.';
  return null;
}

/** Centered square of an image of the given size (the "center crop"). */
export function centerSquare(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}

/**
 * Crops the center square and scales it to 512 px, as WebP (or JPEG where
 * WebP encoding isn't supported). Keeps uploads small and avatars round-ready.
 */
export async function cropAvatar(file: Blob): Promise<{ blob: Blob; extension: 'webp' | 'jpg' }> {
  const bitmap = await createImageBitmap(file);
  try {
    const { sx, sy, side } = centerSquare(bitmap.width, bitmap.height);
    const out = Math.min(AVATAR_OUTPUT_SIZE, side);
    const canvas = document.createElement('canvas');
    canvas.width = out;
    canvas.height = out;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('canvas');
    context.imageSmoothingQuality = 'high';
    context.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
    const encode = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, 0.88));
    const webp = await encode('image/webp');
    if (webp && webp.type === 'image/webp') return { blob: webp, extension: 'webp' };
    const jpeg = await encode('image/jpeg');
    if (!jpeg) throw new Error('encode');
    return { blob: jpeg, extension: 'jpg' };
  } finally {
    bitmap.close();
  }
}
