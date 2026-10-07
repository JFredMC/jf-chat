import { countdownLabel } from './message-bubble.component';

describe('countdownLabel', () => {
  it('formats the time left before a message self-destructs', () => {
    expect(countdownLabel(45_000)).toBe('0:45');
    expect(countdownLabel(12 * 60_000 + 3000)).toBe('12:03');
    expect(countdownLabel(60 * 60_000)).toBe('1:00:00');
    expect(countdownLabel(-5)).toBe('0:00');
    expect(countdownLabel(400)).toBe('0:01');
  });
});
