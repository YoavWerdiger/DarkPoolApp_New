import { readFileSync } from 'fs';
import { join } from 'path';
import {
  navGlassBlurIntensity,
  navGlassOverlay,
  navGlassAndroidBlurProps,
} from '../../components/ui/navGlass';

const navSrc = readFileSync(join(__dirname, '../../components/ui/NavGlassSurface.tsx'), 'utf8');
const dayNavSrc = readFileSync(join(__dirname, '../../components/ui/DayNavBlurButton.tsx'), 'utf8');
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

  it('uses NavGlassSurface for round nav buttons; tab pill stays navChrome', () => {
    expect(dayNavSrc).toMatch(/NavGlassSurface/);
    expect(dayNavSrc).not.toMatch(/background\.navChrome/);
    expect(tabBarSrc).toMatch(/background\.navChrome/);
    expect(tabBarSrc).not.toMatch(/NavGlassSurface/);
    expect(tabBarSrc).toMatch(/backgroundColor: 'transparent'/);
  });
});
