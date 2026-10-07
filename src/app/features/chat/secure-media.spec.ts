import { fitInside, watermarkText } from './secure-media.component';

describe('secure media helpers', () => {
  it('stamps the viewer and the time', () => {
    expect(watermarkText('luna', new Date(2026, 9, 7, 9, 5))).toBe('@luna · 07/10 09:05');
  });

  it('fits inside the screen without upscaling', () => {
    expect(fitInside(4000, 3000, 1000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitInside(300, 200, 1000, 1000)).toEqual({ width: 300, height: 200 });
  });
});
