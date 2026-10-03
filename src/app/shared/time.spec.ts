import { dayLabel, fileSizeLabel, isSameDay, lastSeenLabel, listTimeLabel } from './time';

describe('time labels (es-CO)', () => {
  const now = new Date(2026, 9, 3, 15, 0); // sábado 3 oct 2026, 3:00 p. m.

  it('labels day separators', () => {
    expect(dayLabel(new Date(2026, 9, 3, 8), now)).toBe('Hoy');
    expect(dayLabel(new Date(2026, 9, 2, 23), now)).toBe('Ayer');
    expect(dayLabel(new Date(2026, 8, 28), now)).toBe('Lunes');
    expect(dayLabel(new Date(2026, 0, 15), now)).toBe('15 de enero de 2026');
  });

  it('labels the conversation list compactly', () => {
    expect(listTimeLabel(new Date(2026, 9, 2), now)).toBe('Ayer');
    expect(listTimeLabel(new Date(2026, 8, 30), now)).toBe('miércoles');
    expect(listTimeLabel(new Date(2026, 6, 4), now)).toMatch(/^4 (de )?jul/);
  });

  it('describes when someone was last seen', () => {
    expect(lastSeenLabel(null, now)).toBe('desconectado');
    expect(lastSeenLabel(new Date(now.getTime() - 20_000).toISOString(), now)).toBe('visto hace un momento');
    expect(lastSeenLabel(new Date(now.getTime() - 5 * 60_000).toISOString(), now)).toBe('visto hace 5 minutos');
    expect(lastSeenLabel(new Date(2026, 9, 3, 9, 30).toISOString(), now)).toMatch(/^visto hoy a las 9:30/);
    expect(lastSeenLabel(new Date(2026, 9, 2, 9, 30).toISOString(), now)).toMatch(/^visto ayer a las/);
  });

  it('compares days and formats file sizes', () => {
    expect(isSameDay(new Date(2026, 9, 3, 1), new Date(2026, 9, 3, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 3), new Date(2026, 9, 4))).toBe(false);
    expect(fileSizeLabel(512)).toBe('512 B');
    expect(fileSizeLabel(2048)).toBe('2 KB');
    expect(fileSizeLabel(3.5 * 1024 * 1024)).toBe('3.5 MB');
  });
});
