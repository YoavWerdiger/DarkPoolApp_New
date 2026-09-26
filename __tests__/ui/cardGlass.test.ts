import { readFileSync } from 'fs';
import { join } from 'path';
import {
  CARD_GLASS_ANDROID_BLUR_METHOD,
  CARD_GLASS_ANDROID_BLUR_REDUCTION,
  cardGlassBlurTint,
  resolveUiCardBlur,
  outerStyleBlocksGlassBorder,
  stripConflictingOuterStyleForGlassBorder,
  stripOverflowForGlassBorder,
  uiCardOuterOverflow,
} from '../../components/ui/cardGlass';
import { DesignTokens } from '../../components/ui/DesignTokens';

const uiCardSrc = readFileSync(join(__dirname, '../../components/ui/UICard.tsx'), 'utf8');

function alphaOf(color: string): number {
  const match = /^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(color);
  if (!match) return 1;
  return match[1] === undefined ? 1 : Number(match[1]);
}

describe('resolveUiCardBlur', () => {
  it('keeps list-safe glass / default off unless enableBlur', () => {
    expect(resolveUiCardBlur({ variant: 'glass' })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'default' })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'glass', enableBlur: true })).toBe(true);
  });

  it('keeps blur off for chrome variants unless enableBlur', () => {
    expect(resolveUiCardBlur({ variant: 'elevated' })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'blur' })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'surface' })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'inputGlass' })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'elevated', enableBlur: true })).toBe(true);
  });

  it('lets disableBlur win over enableBlur and auto variants', () => {
    expect(resolveUiCardBlur({ variant: 'inputGlass', disableBlur: true })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'glass', enableBlur: true, disableBlur: true })).toBe(false);
    expect(resolveUiCardBlur({ variant: 'elevated', enableBlur: false })).toBe(false);
  });
});

describe('card glass language', () => {
  it('uses systemThinMaterial on both themes', () => {
    expect(cardGlassBlurTint(true)).toBe('systemThinMaterialDark');
    expect(cardGlassBlurTint(false)).toBe('systemThinMaterialLight');
    expect(DesignTokens.glassmorphism.blurTint.dark).toBe('systemThinMaterialDark');
  });

  it('uses the SDK 31+ Android blur method instead of an opaque slab', () => {
    expect(CARD_GLASS_ANDROID_BLUR_METHOD).toBe('dimezisBlurViewSdk31Plus');
    expect(CARD_GLASS_ANDROID_BLUR_REDUCTION).toBeLessThan(4);
    expect(CARD_GLASS_ANDROID_BLUR_REDUCTION).toBeGreaterThan(0);
  });

  it('does not clip the 1px glass stroke on the outer view', () => {
    expect(uiCardOuterOverflow(true)).toBe('visible');
    expect(uiCardOuterOverflow(false)).toBe('hidden');
    expect(outerStyleBlocksGlassBorder({})).toBe(false);
    expect(outerStyleBlocksGlassBorder({ borderWidth: 0 })).toBe(false);
    expect(outerStyleBlocksGlassBorder({ borderWidth: 1 })).toBe(true);
    expect(
      stripOverflowForGlassBorder({ overflow: 'hidden', borderRadius: 20 }, true)
    ).toEqual({ borderRadius: 20 });
    expect(
      stripOverflowForGlassBorder({ overflow: 'hidden', borderRadius: 20 }, false)
    ).toEqual({ overflow: 'hidden', borderRadius: 20 });
    expect(
      stripConflictingOuterStyleForGlassBorder(
        { overflow: 'hidden', borderWidth: 0, borderRadius: 20 },
        true
      )
    ).toEqual({ borderRadius: 20 });
    const overflowIdx = uiCardSrc.lastIndexOf('overflow: uiCardOuterOverflow');
    const clippedIdx = uiCardSrc.indexOf('clippedOuterStyle');
    expect(overflowIdx).toBeGreaterThan(clippedIdx);
  });

  it('keeps inputGlass fallback on soft surface (solid, not aurora tint)', () => {
    const fallback = DesignTokens.onboardingInputSurface.androidFallback;
    expect(fallback).toBe(DesignTokens.colors.background.secondary);
    expect(DesignTokens.onboardingInputSurface.borderColor).toMatch(/0\.06/);
  });
});
