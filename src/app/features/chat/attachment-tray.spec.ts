import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, fileProblem } from './attachment-tray.component';

describe('fileProblem', () => {
  const file = (type: string, size: number, name = 'archivo') => ({ type, size, name });

  it('accepts photos up to 10 MB and videos up to 25 MB', () => {
    expect(fileProblem(file('image/png', 1000))).toBeNull();
    expect(fileProblem(file('image/webp', MAX_IMAGE_BYTES))).toBeNull();
    expect(fileProblem(file('video/mp4', MAX_VIDEO_BYTES))).toBeNull();
    expect(fileProblem(file('video/quicktime', 10))).toBeNull();
  });

  it('rejects documents, other types, empty and large files with a Spanish message', () => {
    expect(fileProblem(file('application/pdf', 10, 'contrato.pdf'))).toContain('solo fotos');
    expect(fileProblem(file('image/svg+xml', 10, 'logo.svg'))).toContain('solo fotos');
    expect(fileProblem(file('application/x-msdownload', 10, 'virus.exe'))).toContain('«virus.exe»');
    expect(fileProblem(file('image/png', 0))).toContain('vacío');
    expect(fileProblem(file('image/png', MAX_IMAGE_BYTES + 1))).toContain('10 MB');
    expect(fileProblem(file('video/webm', MAX_VIDEO_BYTES + 1))).toContain('25 MB');
  });
});
