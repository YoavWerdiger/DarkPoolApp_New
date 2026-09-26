import { readFileSync } from 'fs';
import { join } from 'path';
import { MAIN_DRAWER_GLASS } from '../../navigation/mainDrawerNav';

const mainTabsSrc = readFileSync(join(__dirname, '../../navigation/MainTabs.tsx'), 'utf8');

describe('main drawer chrome', () => {
  it('keeps the drawer panel transparent so the root canvas shows through', () => {
    expect(MAIN_DRAWER_GLASS.panelBackground).toBe('transparent');
  });

  it('does not wrap drawer content in UICard or paint an opaque Soft UI slab', () => {
    expect(mainTabsSrc).not.toContain('<UICard');
    expect(mainTabsSrc).not.toContain("backgroundColor: '#262626'");
  });

  it('uses the transparent IMG_3289 logo, not the black-plate drawer wordmark', () => {
    expect(mainTabsSrc).toContain('app-media/IMG_3289.PNG');
    expect(mainTabsSrc).toContain("assets/IMG_3289.png");
    expect(mainTabsSrc).not.toContain('darkpool-drawer-logo.png');
    expect(mainTabsSrc).toContain("from 'expo-image'");
    expect(mainTabsSrc).toMatch(/brandLogo:[\s\S]*backgroundColor: 'transparent'/);
  });

  it('keeps the original drawer logo footprint so IMG_3289 is not a thumbnail', () => {
    expect(mainTabsSrc).toContain('const DRAWER_MENU_LOGO_HEIGHT = 96');
    expect(mainTabsSrc).toContain('contentFit="contain"');
    expect(mainTabsSrc).toMatch(/brandLogo:[\s\S]*width: '100%'/);
    expect(mainTabsSrc).not.toMatch(/source=\{\[/);
  });
});
