import { fitInside } from './secure-media.component';

describe('secure media helpers', () => {
  it('fits inside the screen without upscaling', () => {
    expect(fitInside(4000, 3000, 1000, 1000)).toEqual({ width: 1000, height: 750 });
    expect(fitInside(300, 200, 1000, 1000)).toEqual({ width: 300, height: 200 });
  });
});
