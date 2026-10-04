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
const editProfileSrc = readFileSync(
  join(__dirname, '../../screens/Profile/EditProfileScreen.tsx'),
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
    expect(settingsHeroType.fontWeight).toBe('700');
    expect(settingsRowType).toEqual(APP_TYPE.cardTitle);
    expect(settingsRowType.fontSize).toBe(17);
    expect(settingsRowType.fontWeight).toBe('600');
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
    expect(groupInfoSrc).toContain('settingsGroupLabelStyle');
    expect(groupInfoSrc).not.toContain('settingsHeroTitleStyle');
    expect(groupInfoSrc).toMatch(/groupName: \{[\s\S]*?settingsHeroType/);
    expect(groupInfoSrc).toMatch(/sectionHeaderTitle: \{[\s\S]*?settingsGroupLabelStyle/);
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

  it('keeps notification group labels outside soft cards', () => {
    expect(settingsUiSrc).toContain('export function SettingsOutsideTitle');
    expect(settingsUiSrc).toMatch(/SettingsOutsideTitle[\s\S]*settingsGroupLabelStyle/);
    expect(notificationsSrc).toContain('SettingsOutsideTitle');
    expect(notificationsSrc).toContain("title=\"צ'אט\"");
    expect(notificationsSrc).toContain('title="ציוצים"');
    expect(notificationsSrc).toContain('title="אינסיידרים"');
    expect(notificationsSrc).toContain('title="רשימת מעקב"');
    expect(notificationsSrc).not.toContain('title="קהילה"');
    expect(notificationsSrc).not.toContain('דארק פול / אינסיידרים');
    expect(notificationsSrc).not.toContain('שווקים / רשימה');
    expect(notificationsSrc).toContain('title="חדשות מתפרצות"');
    expect(notificationsSrc).toContain('title="דיווחי רווח"');
    expect(notificationsSrc).toContain('title="יומן כלכלי"');
    expect(notificationsSrc).toContain('SettingsScopeChoice');
    expect(notificationsSrc).not.toContain('SymbolSearchModal');
    expect(notificationsSrc).toContain('onSubmitEditing');
    expect(notificationsSrc).toContain('watchlistAlertScope');
    expect(notificationsSrc).toContain('חיפוש טיקר');
    expect(notificationsSrc).not.toContain('title="צלילים"');
    expect(notificationsSrc).not.toContain('!watchSymbols.includes');
    expect(settingsUiSrc).toContain('הכול');
    expect(settingsUiSrc).toContain('לפי הבחירה שלי');
    expect(notificationsSrc).toContain('title="חדשות"');
    expect(notificationsSrc).toContain('title="כללי"');
    const chatTitle = notificationsSrc.indexOf('<SettingsOutsideTitle title="צ\'אט"');
    const chatCard = notificationsSrc.indexOf('<SettingsGlassCard>', chatTitle);
    expect(chatTitle).toBeGreaterThanOrEqual(0);
    expect(chatCard).toBeGreaterThan(chatTitle);
    expect(notificationsSrc).toContain('APP_LAYOUT.screenPaddingHorizontal');
    expect(notificationsSrc).toContain('APP_LAYOUT.cardStackGap');
    expect(notificationsSrc).not.toContain('subtitle=');
    const switchRowSrc = settingsUiSrc.slice(
      settingsUiSrc.indexOf('export function SettingsSwitchRow'),
      settingsUiSrc.indexOf('type SettingsActionRowProps'),
    );
    expect(switchRowSrc).toContain('s.menuRow');
    expect(switchRowSrc).toContain('s.title');
    expect(switchRowSrc).not.toContain('subtitle');
    expect(profileSrc).toContain('ProfileIdentityCard');
    expect(profileSrc).not.toMatch(/fontSize\s*:/);
    expect(profileSrc).not.toContain('borderRadius: 20');
    expect(profileSrc).not.toContain('variant="glass"');
    expect(profileSrc).toContain("navigation.navigate('Notifications')");
    expect(profileSrc).not.toContain('toggleContentNotifs');
    expect(profileSrc).not.toContain('news_notifications: value');
  });

  it('keeps edit-profile on the shared form scale without local type or green chrome', () => {
    expect(editProfileSrc).toContain('formFieldShellStyle');
    expect(editProfileSrc).toContain('formFieldLabelStyle');
    expect(editProfileSrc).toContain('formFieldInputStyle');
    expect(editProfileSrc).toContain('APP_LAYOUT.screenPaddingHorizontal');
    expect(editProfileSrc).not.toMatch(/fontSize\s*:/);
    expect(editProfileSrc).not.toContain('greenGlow');
    expect(editProfileSrc).not.toContain('primary.main');
    expect(editProfileSrc).not.toContain('variant="glass"');
    expect(editProfileSrc).toContain('tokens.colors.text.primary');
    expect(editProfileSrc).toContain('tokens.colors.background.cardSolid');
    expect(editProfileSrc).toContain('handleImageFromGallery');
    expect(editProfileSrc).toContain('cameraBadge');
    expect(editProfileSrc).not.toContain('launchCameraAsync');
    expect(editProfileSrc).toContain("icon: 'male'");
    expect(editProfileSrc).toContain("icon: 'female'");
    expect(editProfileSrc).toContain("direction: 'ltr'");
    expect(editProfileSrc).toContain("flexDirection: 'row'");
    expect(editProfileSrc).toContain('textAlign: \'right\'');
    expect(editProfileSrc).toContain('marginBottom: 8');
    expect(editProfileSrc).not.toContain('flexBasis: 0');
    expect(editProfileSrc).toContain('KeyboardStickyView');
    expect(editProfileSrc).toContain('KeyboardAwareScrollView');
    expect(editProfileSrc).not.toContain('KeyboardAvoidingView');
    expect(editProfileSrc).toContain('variant="primary"');
    expect(editProfileSrc).toContain('fullWidth');
    expect(editProfileSrc).toContain('formFieldLabelStyle');
  });
});
