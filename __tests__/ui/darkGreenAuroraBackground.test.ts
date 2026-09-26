import {
  AURORA_BASE,
  AURORA_GREEN,
  AURORA_GREEN_BRAND,
  AURORA_GREEN_DEEP,
  AURORA_LAYER_OPACITY,
} from '../../components/ui/DarkGreenAuroraBackground';

describe('DarkGreenAuroraBackground palette', () => {
  it('locks the Figma Make thumbnail greens and true-black base', () => {
    expect(AURORA_BASE).toBe('#000000');
    expect(AURORA_GREEN).toBe('#00B531');
    expect(AURORA_GREEN_DEEP).toBe('#013B13');
    expect(AURORA_GREEN_BRAND).toBe('#00C805');
  });

  it('dims the aurora layer itself instead of covering it with a matt overlay', () => {
    expect(AURORA_LAYER_OPACITY).toBeGreaterThanOrEqual(0.45);
    expect(AURORA_LAYER_OPACITY).toBeLessThanOrEqual(0.55);
    expect(AURORA_LAYER_OPACITY).not.toBe(0);
    expect(AURORA_LAYER_OPACITY).not.toBe(1);
  });
});
