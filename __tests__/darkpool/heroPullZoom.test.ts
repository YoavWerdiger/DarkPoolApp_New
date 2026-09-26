import { readFileSync } from 'fs';
import { join } from 'path';
import {
  heroPullZoom,
  heroScrollContentCompensateY,
} from '../../screens/DarkPool/utils/heroPullZoom';

const heroSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/components/PersonProfileHero.tsx'),
  'utf8'
);
const profileSrc = readFileSync(
  join(__dirname, '../../screens/DarkPool/PersonPortfolioProfileScreen.tsx'),
  'utf8'
);

describe('heroPullZoom', () => {
  it('stays at rest when the list is at the top or scrolling down', () => {
    expect(heroPullZoom(0, 400)).toEqual({ scale: 1, translateY: 0 });
    expect(heroPullZoom(80, 400)).toEqual({ scale: 1, translateY: 0 });
  });

  it('scales from 1 and pins the photo to the viewport on overscroll', () => {
    expect(heroPullZoom(-80, 400)).toEqual({ scale: 1.2, translateY: -80 });
    expect(heroPullZoom(-400, 400)).toEqual({ scale: 2, translateY: -400 });
  });

  it('keeps a pinned backdrop at the top while overscrolling', () => {
    expect(heroPullZoom(-80, 400, 'pinned')).toEqual({ scale: 1.2, translateY: 0 });
  });

  it('moves a pinned backdrop up with content so it cannot leak after scroll', () => {
    expect(heroPullZoom(120, 400, 'pinned')).toEqual({ scale: 1, translateY: -120 });
  });

  it('does not invent a transform when height is missing', () => {
    expect(heroPullZoom(-40, 0)).toEqual({ scale: 1, translateY: 0 });
    expect(heroPullZoom(-40, Number.NaN)).toEqual({ scale: 1, translateY: 0 });
  });
});

describe('heroScrollContentCompensateY', () => {
  it('does not shift content when scrolled down or at rest', () => {
    expect(heroScrollContentCompensateY(0)).toBe(0);
    expect(heroScrollContentCompensateY(120)).toBe(0);
  });

  it('counters top overscroll so the portfolio body stays pinned', () => {
    expect(heroScrollContentCompensateY(-80)).toBe(80);
    expect(heroScrollContentCompensateY(-400)).toBe(400);
  });
});

describe('PersonProfileHero photo', () => {
  it('keeps a fixed-height photo layer and does not transform the chrome root', () => {
    expect(heroSrc).toMatch(/hidePhoto/);
    expect(heroSrc).not.toMatch(/transformOrigin:/);
    expect(heroSrc).toMatch(/style=\{\{ width: photoWidth, height \}\}/);
    expect(heroSrc).toMatch(/styles\.photoLayer/);
    expect(heroSrc).toMatch(/\[styles\.photoLayer, \{ width: photoWidth, height \}, photoZoomStyle\]/);
    expect(heroSrc).toMatch(/style=\{\[styles\.root, \{ height \}\]\}/);
    expect(heroSrc).not.toMatch(/\[styles\.root, \{ height \}, photoZoomStyle\]/);
    expect(profileSrc).toMatch(/hidePhoto/);
    expect(profileSrc).toMatch(/pinned photoOnly/);
    expect(profileSrc).toMatch(/heroChrome/);
    expect(profileSrc).toMatch(/chromeOverlay/);
    expect(profileSrc).toMatch(/scrollBodyCompensateStyle/);
  });

  it('hero chrome buttons match drawer nav glass (subtle, same size)', () => {
    expect(heroSrc).toMatch(/DRAWER_MENU_BUTTON_SIZE/);
    expect(heroSrc).toMatch(/glassIntensity="subtle"/);
    expect(heroSrc).toMatch(/DayNavBlurButton/);
  });

  it('anchors the name on the photo bottom with a strong bottom vignette', () => {
    expect(heroSrc).toMatch(/bottom: 0/);
    expect(heroSrc).toMatch(/'rgba\(0,0,0,0\.92\)'/);
    expect(heroSrc).toMatch(/locations=\{\[0, 0\.28, 0\.52, 0\.78, 1\]\}/);
    expect(heroSrc).not.toMatch(/'transparent',\s*\n\s*\]\}\s*\n\s*locations=\{\[0, 0\.22, 0\.58, 0\.86, 1\]\}/);
  });
});
