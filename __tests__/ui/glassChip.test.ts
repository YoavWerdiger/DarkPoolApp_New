import {
  GLASS_CHIP_CARD,
  GLASS_CHIP_MIN_HEIGHT,
  GLASS_CHIP_RADIUS,
} from '../../components/ui/GlassChip';

describe('GlassChip', () => {
  it('wraps UICard soft surface without blur wash', () => {
    expect(GLASS_CHIP_CARD.variant).toBe('soft');
    expect(GLASS_CHIP_CARD.padding).toBe('none');
    expect(GLASS_CHIP_CARD.enableBlur).toBe(false);
  });

  it('stays a compact pill, not a fat card', () => {
    expect(GLASS_CHIP_MIN_HEIGHT).toBe(32);
    expect(GLASS_CHIP_RADIUS).toBeGreaterThanOrEqual(999);
  });
});
