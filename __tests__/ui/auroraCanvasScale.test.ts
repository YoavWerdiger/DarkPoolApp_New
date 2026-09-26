import { auroraCanvasPixelRatio } from '../../components/ui/GradientBackground';

describe('auroraCanvasPixelRatio', () => {
  it('uses full device pixels — never a half-res perf scale', () => {
    expect(auroraCanvasPixelRatio(3)).toBe(3);
    expect(auroraCanvasPixelRatio(2)).toBe(2);
    expect(auroraCanvasPixelRatio(1.5)).toBe(1.5);
    expect(auroraCanvasPixelRatio(1)).toBe(1);
  });

  it('keeps retina screens at least 2x and never half of a 3x display', () => {
    expect(auroraCanvasPixelRatio(2)).toBeGreaterThanOrEqual(2);
    expect(auroraCanvasPixelRatio(3)).toBeGreaterThanOrEqual(2);
    expect(auroraCanvasPixelRatio(3)).not.toBe(1.5);
  });

  it('falls back to 2x when the ratio is invalid', () => {
    expect(auroraCanvasPixelRatio(0)).toBe(2);
    expect(auroraCanvasPixelRatio(Number.NaN)).toBe(2);
    expect(auroraCanvasPixelRatio(-1)).toBe(2);
  });
});
