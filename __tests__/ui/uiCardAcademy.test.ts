import { readFileSync } from 'fs';
import { join } from 'path';
import { UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { ACADEMY_CARD_RADIUS } from '../../components/learning/academyCardLayout';

const uiCardSrc = readFileSync(join(__dirname, '../../components/ui/UICard.tsx'), 'utf8');

describe('UICard academy shell', () => {
  it('shares radius with academy course cards', () => {
    expect(UI_CARD_RADIUS).toBe(24);
    expect(ACADEMY_CARD_RADIUS).toBe(UI_CARD_RADIUS);
  });

  it('maps legacy glass variants to soft on all themes', () => {
    expect(uiCardSrc).toMatch(/variant === 'glass' \|\| variant === 'default' \|\| variant === 'blur'/);
    expect(uiCardSrc).toMatch(/UI_CARD_RADIUS/);
    expect(uiCardSrc).not.toMatch(/isDarkMode && \(variant === 'glass'/);
  });
});
