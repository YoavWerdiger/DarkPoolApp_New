import {
  APP_TYPE,
  appPhysicalRightText,
  appPhysicalLeftText,
  appScreenTitleStyle,
  appSectionTitleStyle,
  appSectionSubtitleStyle,
  appScreenSubtitleStyle,
  appBodyTextStyle,
  appCaptionStyle,
  appCaption2Style,
  appSheetTitleStyle,
  appSheetButtonLabelStyle,
} from '../../components/ui/appType';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { JOURNAL_TYPE } from '../../screens/Journal/journalLayout';
import { DARK_POOL_TYPE } from '../../screens/DarkPool/darkPoolLayout';
import { SETTINGS_TYPE } from '../../components/profile/settingsType';

describe('shared APP_TYPE scale (Blink / Soft UI)', () => {
  it('locks screen / section / body / caption numbers', () => {
    expect(APP_TYPE.screenTitle).toEqual({
      fontSize: 24,
      fontWeight: '700',
      lineHeight: 28,
      letterSpacing: -0.42,
    });
    expect(APP_TYPE.flowTitle.fontSize).toBe(28);
    expect(APP_TYPE.flowTitleCompact.fontSize).toBe(24);
    expect(APP_TYPE.sectionTitle).toEqual({
      fontSize: 22,
      fontWeight: '700',
      lineHeight: 28,
      letterSpacing: -0.42,
    });
    expect(APP_TYPE.groupLabel).toEqual({
      fontSize: 15,
      fontWeight: '500',
      lineHeight: 20,
    });
    expect(APP_TYPE.cardSubtitle.fontWeight).toBe('400');
    expect(APP_TYPE.sectionSubtitle).toEqual({
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400',
    });
    expect(APP_TYPE.body).toEqual({
      fontSize: 16,
      fontWeight: '400',
      lineHeight: 24,
    });
    expect(APP_TYPE.cardTitle).toEqual({
      fontSize: 17,
      fontWeight: '600',
      lineHeight: 22,
      letterSpacing: -0.2,
    });
    expect(APP_TYPE.cardSubtitle.fontSize).toBe(13);
    expect(APP_TYPE.cardMetricLabel.fontSize).toBe(12);
    expect(APP_TYPE.cardMetricValue.fontSize).toBe(28);
    expect(APP_TYPE.cardMetricValueSecondary.fontSize).toBe(20);
    expect(APP_TYPE.cardBody.fontSize).toBe(15);
    expect(APP_TYPE.caption.fontSize).toBe(12);
    expect(APP_TYPE.caption2.fontSize).toBe(11);
  });

  it('uses the Explore LTR-box + textAlign right trick', () => {
    expect(appPhysicalRightText.direction).toBe('ltr');
    expect(appPhysicalRightText.textAlign).toBe('right');
    expect(appPhysicalLeftText.textAlign).toBe('left');
    expect(appScreenTitleStyle.fontSize).toBe(24);
    expect(appSectionTitleStyle.fontSize).toBe(22);
    expect(appSectionTitleStyle.fontWeight).toBe('700');
    expect(appSectionSubtitleStyle.fontSize).toBe(15);
    expect(appSectionSubtitleStyle.marginTop).toBe(APP_LAYOUT.titleSubtitleGap);
    expect(appScreenSubtitleStyle.marginTop).toBe(APP_LAYOUT.titleSubtitleGap);
    expect(appBodyTextStyle.fontSize).toBe(16);
    expect(appBodyTextStyle.lineHeight).toBe(24);
    expect(appCaptionStyle.fontSize).toBe(12);
    expect(appCaption2Style.fontSize).toBe(11);
  });

  it('keeps sheet title/button on the same scale', () => {
    expect(appSheetTitleStyle.fontSize).toBe(22);
    expect(appSheetTitleStyle.fontWeight).toBe('700');
    expect(appSheetButtonLabelStyle.fontSize).toBe(16);
    expect(appSheetButtonLabelStyle.textAlign).toBe('center');
  });

  it('is the same object Journal / Dark Pool re-export', () => {
    expect(JOURNAL_TYPE).toBe(APP_TYPE);
    expect(DARK_POOL_TYPE).toBe(APP_TYPE);
    expect(SETTINGS_TYPE).toBe(APP_TYPE);
  });

  it('aligns layout rhythm with APP_LAYOUT', () => {
    expect(APP_LAYOUT.sectionGap).toBe(40);
    expect(APP_LAYOUT.screenPaddingHorizontal).toBe(20);
  });
});
