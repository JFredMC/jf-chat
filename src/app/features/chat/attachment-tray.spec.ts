import { MAX_FILE_BYTES, fileProblem } from './attachment-tray.component';

describe('fileProblem', () => {
  const file = (type: string, size: number, name = 'archivo') => ({ type, size, name });

  it('accepts images, PDF and text up to 10 MB', () => {
    expect(fileProblem(file('image/png', 1000))).toBeNull();
    expect(fileProblem(file('application/pdf', MAX_FILE_BYTES))).toBeNull();
    expect(fileProblem(file('text/plain', 10))).toBeNull();
  });

  it('rejects other types, empty and large files with a Spanish message', () => {
    expect(fileProblem(file('image/svg+xml', 10, 'logo.svg'))).toContain('solo imágenes');
    expect(fileProblem(file('application/x-msdownload', 10, 'virus.exe'))).toContain('«virus.exe»');
    expect(fileProblem(file('image/png', 0))).toContain('vacío');
    expect(fileProblem(file('image/png', MAX_FILE_BYTES + 1))).toContain('10 MB');
  });
});
