const REENCODE = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Re-draws a photo on a canvas so nothing but pixels leaves the phone: no
 * GPS, camera model, date or author (EXIF/XMP). The orientation is applied
 * first. The file name becomes neutral too. GIFs (animation) and videos are
 * left as they are; the server also strips image metadata.
 */
export async function stripImage(file: File): Promise<File> {
  if (!REENCODE.includes(file.type) || typeof createImageBitmap !== 'function') return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, file.type, 0.9));
    canvas.width = canvas.height = 0;
    if (!blob || blob.type !== file.type) return file;
    const extension = file.type === 'image/jpeg' ? 'jpg' : file.type.slice(6);
    return new File([blob], `foto.${extension}`, { type: file.type, lastModified: 0 });
  } catch {
    return file;
  }
}
