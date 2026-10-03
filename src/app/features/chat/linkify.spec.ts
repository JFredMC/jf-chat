import { linkify } from './linkify';

describe('linkify', () => {
  it('turns http(s) links into link parts without trailing punctuation', () => {
    expect(linkify('mira https://angular.dev/guide, y http://a.co/x?y=1.')).toEqual([
      { text: 'mira ' },
      { text: 'https://angular.dev/guide', href: 'https://angular.dev/guide' },
      { text: ', y ' },
      { text: 'http://a.co/x?y=1', href: 'http://a.co/x?y=1' },
      { text: '.' },
    ]);
  });

  it('never creates links for other schemes and keeps markup as plain text', () => {
    const parts = linkify('<img src=x onerror=alert(1)> javascript:alert(1) data:text/html,hi');
    expect(parts).toEqual([{ text: '<img src=x onerror=alert(1)> javascript:alert(1) data:text/html,hi' }]);
  });

  it('returns no parts for empty text', () => {
    expect(linkify('')).toEqual([]);
  });
});
