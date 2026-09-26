import { readFileSync } from 'fs';
import { join } from 'path';
import { APP_TYPE } from '../../components/ui/appType';
import {
  SETTINGS_TYPE,
  settingsHeroType,
  settingsHeroTitleStyle,
  settingsRowType,
  settingsBodyType,
  settingsMetaType,
  settingsCaptionType,
  settingsCaption2Type,
  settingsButtonLabelStyle,
} from '../../components/profile/settingsType';

const groupInfoSrc = readFileSync(
  join(__dirname, '../../screens/ChatNew/ChatGroupInfoScreen.tsx'),
  'utf8',
);
const settingsUiSrc = readFileSync(
  join(__dirname, '../../components/profile/ProfileSettingsUI.tsx'),
  'utf8',
);
const notificationsSrc = readFileSync(
  join(__dirname, '../../screens/Profile/NotificationsScreen.tsx'),
  'utf8',
);
const profileSrc = readFileSync(
  join(__dirname, '../../screens/Profile/UserProfileScreen.tsx'),
  'utf8',
);

describe('settings / group-info typography', () => {
  it('re-exports the shared Explore scale', () => {
    expect(SETTINGS_TYPE).toBe(APP_TYPE);
  });

  it('maps hero / row / meta without Academy-size titles', () => {
    expect(settingsHeroType).toEqual(APP_TYPE.sectionTitle);
    expect(settingsHeroType.fontSize).toBe(22);
    expect(settingsHeroTitleStyle.fontSize).toBe(22);
    expect(settingsHeroType.fontWeight).toBe('800');
    expect(settingsRowType).toEqual(APP_TYPE.cardTitle);
    expect(settingsRowType.fontSize).toBe(17);
    expect(settingsRowType.fontWeight).toBe('700');
    expect(settingsBodyType.fontSize).toBe(16);
    expect(settingsMetaType).toEqual(APP_TYPE.footnote);
    expect(settingsMetaType.fontSize).toBe(13);
    expect(settingsCaptionType.fontSize).toBe(12);
    expect(settingsCaption2Type.fontSize).toBe(11);
    expect(settingsButtonLabelStyle.fontSize).toBe(16);
  });

  it('keeps group-info card titles outside the glass card', () => {
    expect(groupInfoSrc).toContain('renderSectionHeader');
    expect(groupInfoSrc).toContain('settingsHeroType');
    expect(groupInfoSrc).toContain('settingsRowTitleStyle');
    expect(groupInfoSrc).not.toContain('settingsHeroTitleStyle');
    expect(groupInfoSrc).toMatch(/groupName: \{[\s\S]*?settingsHeroType/);
    expect(groupInfoSrc).toMatch(/sectionHeaderTitle: \{[\s\S]*?settingsRowTitleStyle/);
    expect(groupInfoSrc).toMatch(/renderSectionHeader\(\s*'מדיה'/);
    expect(groupInfoSrc).toMatch(/renderSectionHeader\('פעולות'\)/);
    expect(groupInfoSrc).toMatch(/renderSectionHeader\(\s*isolateNumericRuns\(`חברים/);
    expect(groupInfoSrc).not.toContain('renderCardHeader');
    const mediaBlock = groupInfoSrc.slice(
      groupInfoSrc.indexOf("renderSectionHeader("),
      groupInfoSrc.indexOf("renderSectionHeader('פעולות')"),
    );
    expect(mediaBlock.indexOf('renderSectionHeader')).toBeLessThan(mediaBlock.indexOf('<UICard'));
  });

  it('keeps notification section titles outside soft cards at 22/800', () => {
    expect(settingsUiSrc).toContain('export function SettingsOutsideTitle');
    expect(settingsUiSrc).toMatch(/SettingsOutsideTitle[\s\S]*settingsHeroType/);
    expect(notificationsSrc).toContain('SettingsOutsideTitle');
    expect(notificationsSrc).toContain("title=\"צ'אט\"");
    expect(notificationsSrc).toContain('title="קהילה"');
    expect(notificationsSrc).toContain('title="דארק פול / אינסיידרים"');
    expect(notificationsSrc).toContain('title="שווקים / רשימה"');
    expect(notificationsSrc).toContain('title="חדשות"');
    expect(notificationsSrc).toContain('title="כללי"');
    const chatTitle = notificationsSrc.indexOf('<SettingsOutsideTitle title="צ\'אט"');
    const chatCard = notificationsSrc.indexOf('<SettingsGlassCard>', chatTitle);
    expect(chatTitle).toBeGreaterThanOrEqual(0);
    expect(chatCard).toBeGreaterThan(chatTitle);
    expect(profileSrc).toContain("navigation.navigate('Notifications')");
    expect(profileSrc).not.toContain('toggleContentNotifs');
    expect(profileSrc).not.toContain('news_notifications: value');
  });
});
