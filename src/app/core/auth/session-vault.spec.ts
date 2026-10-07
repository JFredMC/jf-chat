import { deriveKey, isVaulted, seal, unlock } from './session-vault';

describe('session vault', () => {
  it('seals the token so only the right PIN opens it', async () => {
    const vault = await deriveKey('4821');
    const sealed = await seal(vault, 'refresh-token-123');
    expect(isVaulted(sealed)).toBe(true);
    expect(sealed).not.toContain('refresh-token-123');
    await expect(unlock('4821', sealed)).resolves.toMatchObject({ secret: 'refresh-token-123' });
    await expect(unlock('0000', sealed)).resolves.toBeNull();
  });

  it('uses a fresh IV every time and keeps the salt', async () => {
    const vault = await deriveKey('123456');
    const a = await seal(vault, 'x');
    const b = await seal(vault, 'x');
    expect(a).not.toBe(b);
    expect(a.split('.')[1]).toBe(b.split('.')[1]);
  });

  it('rejects plain or damaged values', async () => {
    expect(isVaulted('plain-token')).toBe(false);
    await expect(unlock('4821', 'plain-token')).resolves.toBeNull();
    await expect(unlock('4821', 'pin1.AAAA.BBBB')).resolves.toBeNull();
  });
});
