import { formatInviteInput } from './invite.component';

describe('formatInviteInput', () => {
  it('groups the code as XXXX-XXXX-XX and uppercases it', () => {
    expect(formatInviteInput('k7qm2xrp9d')).toBe('K7QM-2XRP-9D');
  });

  it('ignores spaces, dashes and extra characters', () => {
    expect(formatInviteInput(' k7qm - 2xrp 9d77 ')).toBe('K7QM-2XRP-9D');
  });

  it('keeps partial input readable', () => {
    expect(formatInviteInput('k7q')).toBe('K7Q');
    expect(formatInviteInput('k7qm2')).toBe('K7QM-2');
  });
});
