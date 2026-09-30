import { readFileSync } from 'fs';
import { join } from 'path';
import { drawerMenuFaceColor, headerExitButtonFill } from '../../components/ui/DayNavBlurButton';
import { LIGHT_CARD, LIGHT_TEXT_PRIMARY } from '../../components/ui/designTokensStatic';
import { SoftUI } from '../../components/ui/softUiPalette';
import {
  navGlassBlurIntensity,
  navGlassOverlay,
  navGlassAndroidBlurProps,
} from '../../components/ui/navGlass';

const navSrc = readFileSync(join(__dirname, '../../components/ui/NavGlassSurface.tsx'), 'utf8');
const dayNavSrc = readFileSync(join(__dirname, '../../components/ui/DayNavBlurButton.tsx'), 'utf8');
const headerSrc = readFileSync(
  join(__dirname, '../../components/ui/MainDrawerScreenHeader.tsx'),
  'utf8',
);
const profileMenuSrc = readFileSync(
  join(__dirname, '../../components/profile/ProfileDrawerMenuBar.tsx'),
  'utf8',
);
const tabBarSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/DarkPoolBottomTabBar.tsx'),
  'utf8',
);

describe('nav glass chrome', () => {
  it('uses strong blur intensity for readable glass', () => {
    expect(navGlassBlurIntensity('light')).toBeGreaterThanOrEqual(48);
    expect(navGlassOverlay(true, 'light')).toMatch(/^rgba\(255,\s*255,\s*255,/);
  });

  it('wires Android SDK31+ blur on NavGlassSurface', () => {
    expect(navSrc).toMatch(/navGlassAndroidBlurProps/);
    expect(navSrc).toMatch(/BlurView/);
    expect(navSrc).toMatch(/navGlassOverlay/);
    expect(navSrc).toMatch(/navGlassBorderStyle/);
    if (process.platform === 'android') {
      expect(navGlassAndroidBlurProps).toHaveProperty('blurMethod', 'dimezisBlurViewSdk31Plus');
    }
  });

  it('paints the drawer menu button cardSolid in light and keeps glass in dark', () => {
    expect(drawerMenuFaceColor(LIGHT_CARD)).toBe('#FFFFFF');
    expect(drawerMenuFaceColor(SoftUI.surface1)).toBeUndefined();
    expect(LIGHT_TEXT_PRIMARY).toBe('#1E1A24');
    expect(headerSrc).toMatch(/drawerMenuFaceColor\(tokens\.colors\.background\.cardSolid\)/);
    expect(headerSrc).toMatch(/color=\{tokens\.colors\.text\.primary\}/);
    expect(profileMenuSrc).toMatch(/drawerMenuFaceColor/);
    expect(profileMenuSrc).toMatch(/color=\{DesignTokens\.colors\.text\.primary\}/);
  });

  it('fills exit buttons with cardSolid in both themes', () => {
    expect(headerExitButtonFill(LIGHT_CARD)).toBe('#FFFFFF');
    expect(headerExitButtonFill(SoftUI.surface1)).toBe(SoftUI.surface1);
    expect(dayNavSrc).toMatch(/headerExitButtonFill\(tokens\.colors\.background\.cardSolid\)/);
    expect(dayNavSrc).toMatch(/glass = false/);
    expect(dayNavSrc).not.toMatch(/#FFFFFF|#1C1C1E/);
  });

  it('uses NavGlassSurface only when glass is requested; tab pill stays navChrome', () => {
    expect(dayNavSrc).toMatch(/NavGlassSurface/);
    expect(dayNavSrc).toMatch(/const useGlass = glass && !hasSolidOverride/);
    expect(dayNavSrc).not.toMatch(/background\.navChrome/);
    expect(tabBarSrc).toMatch(/background\.navChrome/);
    expect(tabBarSrc).not.toMatch(/NavGlassSurface/);
    expect(tabBarSrc).toMatch(/backgroundColor: 'transparent'/);
  });
});
