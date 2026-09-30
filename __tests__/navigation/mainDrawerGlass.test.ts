import { readFileSync } from 'fs';
import { join } from 'path';
import { MAIN_DRAWER_GLASS } from '../../navigation/mainDrawerNav';

const mainTabsSrc = readFileSync(join(__dirname, '../../navigation/MainTabs.tsx'), 'utf8');

describe('main drawer chrome', () => {
  it('keeps the drawer panel on the theme card, not a transparent dim', () => {
    expect(MAIN_DRAWER_GLASS.panelBackground).toBe('transparent');
    expect(mainTabsSrc).toContain('tokens.colors.background.cardSolid');
    expect(mainTabsSrc).not.toContain('tokens.colors.background.primary');
    expect(mainTabsSrc).not.toContain('tokens.colors.background.navChrome');
    expect(mainTabsSrc).toContain('tokens.colors.text.primary');
    expect(mainTabsSrc).toContain('tokens.colors.border.divider');
    expect(mainTabsSrc).not.toContain("color: '#FFFFFF'");
    expect(mainTabsSrc).not.toContain('const LABEL');
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

  it('swaps in the light wordmark at the same drawer logo box', () => {
    expect(mainTabsSrc).toContain('app-media/branding/IMG_9432.png');
    expect(mainTabsSrc).toContain('{ uri: DRAWER_MENU_LOGO_LIGHT_URI }');
    expect(mainTabsSrc).toContain('height: DRAWER_MENU_LOGO_HEIGHT');
    expect(mainTabsSrc).toContain("overflow: 'hidden'");
    expect(mainTabsSrc).toContain('width: LIGHT_LOGO_RENDERED');
    expect(mainTabsSrc).toContain('source={DRAWER_MENU_LOGO}');
    expect(mainTabsSrc).not.toContain('darkpool-logo-light.jpg');
  });
});
