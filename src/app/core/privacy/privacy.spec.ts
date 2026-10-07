import { wipeLocalData } from './panic.service';
import { base64UrlToBytes } from './push.service';
import { isPrintShortcut, isScreenshotShortcut } from './shield.service';

const key = (k: string, mods: Partial<KeyboardEvent> = {}) => ({ key: k, code: '', metaKey: false, ctrlKey: false, shiftKey: false, ...mods });

describe('privacy helpers', () => {
  it('recognises screenshot and print shortcuts', () => {
    expect(isScreenshotShortcut(key('PrintScreen'))).toBe(true);
    expect(isScreenshotShortcut(key('4', { metaKey: true, shiftKey: true }))).toBe(true);
    expect(isScreenshotShortcut(key('S', { metaKey: true, shiftKey: true }))).toBe(true);
    expect(isScreenshotShortcut(key('s', { ctrlKey: true }))).toBe(false);
    expect(isPrintShortcut(key('p', { ctrlKey: true }))).toBe(true);
    expect(isPrintShortcut(key('p'))).toBe(false);
  });

  it('panic wipe keeps only the discreet preferences', () => {
    localStorage.setItem('velo.session', 'x');
    localStorage.setItem('velo.demo.db', '{}');
    localStorage.setItem('velo.disguise', '1');
    localStorage.setItem('velo.theme', 'dark');
    sessionStorage.setItem('s', '1');
    wipeLocalData();
    expect(Object.keys(localStorage).sort()).toEqual(['velo.disguise', 'velo.theme']);
    expect(sessionStorage.length).toBe(0);
  });

  it('decodes the VAPID key', () => {
    expect(Array.from(base64UrlToBytes('AQID_-8'))).toEqual([1, 2, 3, 255, 239]);
  });
});
