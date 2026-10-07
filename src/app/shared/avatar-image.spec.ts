import { AVATAR_MAX_BYTES, avatarFileError, centerSquare } from './avatar-image';

describe('avatar image rules', () => {
  it('accepts jpg, png and webp up to 5 MB', () => {
    expect(avatarFileError({ type: 'image/jpeg', size: 1000 })).toBeNull();
    expect(avatarFileError({ type: 'image/png', size: AVATAR_MAX_BYTES })).toBeNull();
    expect(avatarFileError({ type: 'image/webp', size: 1 })).toBeNull();
  });

  it('rejects other types, empty and big files', () => {
    expect(avatarFileError({ type: 'image/gif', size: 10 })).toContain('JPG, PNG o WebP');
    expect(avatarFileError({ type: 'image/svg+xml', size: 10 })).not.toBeNull();
    expect(avatarFileError({ type: 'image/png', size: 0 })).toContain('vacía');
    expect(avatarFileError({ type: 'image/png', size: AVATAR_MAX_BYTES + 1 })).toContain('5 MB');
  });

  it('crops the centered square', () => {
    expect(centerSquare(800, 600)).toEqual({ sx: 100, sy: 0, side: 600 });
    expect(centerSquare(300, 500)).toEqual({ sx: 0, sy: 100, side: 300 });
    expect(centerSquare(256, 256)).toEqual({ sx: 0, sy: 0, side: 256 });
  });
});
