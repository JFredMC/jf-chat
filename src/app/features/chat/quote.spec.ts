import { quoteText } from './quote';

describe('quoteText', () => {
  it('summarises text, photos and videos', () => {
    expect(quoteText({ content: '  hola  ', message_type: 'text' })).toBe('hola');
    expect(quoteText({ content: '', message_type: 'image' })).toBe('📷 Foto');
    expect(quoteText({ content: '', message_type: 'video' })).toBe('🎬 Video');
    expect(quoteText({ content: 'x'.repeat(200), message_type: 'text' })).toHaveLength(121);
  });
});
