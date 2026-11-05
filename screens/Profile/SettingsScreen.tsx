import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { AppSwitch } from '../../components/ui/AppSwitch';
import {
  Languages,
  CreditCard,
  ScanFace,
  Eraser,
  Info,
  Moon,
  type LucideIcon,
} from 'lucide-react-native';
import { ChevronLeft } from '../../lib/i18n/dirIcons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import * as LocalAuthentication from 'expo-local-authentication';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  loadAppSettings,
  saveAppSettings,
  clearAppCache,
} from '../../services/appSettings';
import { useTranslation } from 'react-i18next';
import { APP_LANGUAGES, changeLanguage, getStoredLanguage } from '../../lib/i18n';
import { getAppVersionLabel } from '../../utils/appMeta';
import {
  SettingsGlassCard,
  SettingsSectionTitle,
} from '../../components/profile/ProfileSettingsUI';
import {
  settingsHebrewText,
  settingsRowType,
  settingsBodyType,
  settingsCaptionType,
} from '../../components/profile/settingsType';
import { isolateNumericRuns } from '../DarkPool/utils/bidi';

interface SettingItem {
  id: string;
  title: string;
  icon: LucideIcon;
  type: 'switch' | 'action';
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

export default function SettingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme, isDarkMode, toggleTheme } = useTheme();
  const DesignTokens = useDesignTokens();
  const [biometricAuth, setBiometricAuth] = useState(false);
  const { t } = useTranslation();
  const language = getStoredLanguage();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const saved = await loadAppSettings();
      setBiometricAuth(saved.biometricAuth);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  const persistBiometric = async (value: boolean) => {
    void HapticFeedback.selection();
    setBiometricAuth(value);
    try {
      await saveAppSettings({ biometricAuth: value });
    } catch (error) {
    }
  };

  // בחירת שפה: שתי השפות האחרות (כל אחת בכתב שלה) + ביטול → שמירה וטעינה מחדש של האפליקציה.
  // השפה הנוכחית כבר מוצגת בכותרת השורה, ולכן לא מופיעה כאן (3 כפתורים נכנסים בשורה אחת בדיאלוג).
  const cycleLanguage = () => {
    void HapticFeedback.selection();
    const options = APP_LANGUAGES.filter((lang) => lang !== language);
    legacyAlert(t('settings.changeLanguageTitle'), t('settings.changeLanguageBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      ...options.map((next) => ({
        text: t(`settings.languageNames.${next}`),
        onPress: () => {
          // appSettings (AsyncStorage) מכיר רק he/en — מקור האמת הוא SecureStore דרך changeLanguage
          if (next !== 'ar') void saveAppSettings({ language: next }).catch(() => {});
          void changeLanguage(next);
        },
      })),
    ]);
  };

  const handleClearCache = () => {
    legacyAlert(
      t('settings.clearCache'),
      t('settings.clearCacheConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.clear'),
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await clearAppCache();
              void HapticFeedback.success();
              legacyAlert(
                t('common.success'),
                removed > 0 ? t('settings.clearCacheDone', { count: removed }) : t('settings.clearCacheNothing'),
              );
            } catch (error) {
              legacyAlert(t('common.error'), t('settings.clearCacheError'));
            }
          }
        }
      ]
    );
  };

  const handleBiometricAuth = async (value: boolean) => {
    if (value) {
      try {
        // נבדוק אם יש תמיכה באימות ביומטרי
        const compatible = await LocalAuthentication.hasHardwareAsync();
        
        if (!compatible) {
          legacyAlert(t('common.error'), t('settings.biometricUnsupported'));
          return;
        }

        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          legacyAlert(t('common.error'), t('settings.biometricNotEnrolled'));
          return;
        }

        // נבצע אימות ביומטרי
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: t('settings.biometricPrompt'),
          cancelLabel: t('common.cancel'),
          disableDeviceFallback: false,
        });

        if (result.success) {
          await persistBiometric(true);
          void HapticFeedback.success();
          legacyAlert(t('common.success'), t('settings.biometricEnabled'));
        } else {
          legacyAlert(t('common.cancelled'), t('settings.biometricCancelled'));
        }
      } catch (error) {
        legacyAlert(t('common.error'), t('settings.biometricError'));
      }
    } else {
      await persistBiometric(false);
    }
  };

  const settingSections = [
    {
      title: t('settings.appearance'),
      items: [
        {
          id: 'darkMode',
          title: t('settings.darkMode'),
          icon: Moon,
          type: 'switch' as const,
          value: isDarkMode,
          onToggle: (value: boolean) => {
            if (value === isDarkMode) return;
            void HapticFeedback.selection();
            void toggleTheme();
          },
        },
      ],
    },
    {
      title: t('settings.language'),
      items: [
        {
          id: 'language',
          title: `${t('settings.interfaceLanguage')} · ${t('settings.languageName')}`,
          icon: Languages,
          type: 'action' as const,
          onPress: () => void cycleLanguage(),
        },
      ],
    },
    {
      title: t('settings.billingSection'),
      items: [
        {
          id: 'billing',
          title: t('settings.billing'),
          icon: CreditCard,
          type: 'action' as const,
          onPress: () => {
            void HapticFeedback.impactLight();
            navigation.navigate('Billing');
          },
        },
      ],
    },
    {
      title: t('settings.security'),
      items: [
        {
          id: 'biometricAuth',
          title: t('settings.biometric'),
          icon: ScanFace,
          type: 'switch' as const,
          value: biometricAuth,
          onToggle: handleBiometricAuth
        }
      ]
    },
    {
      title: t('settings.advanced'),
      items: [
        {
          id: 'clearCache',
          title: t('settings.clearCache'),
          icon: Eraser,
          type: 'action' as const,
          onPress: handleClearCache,
          danger: true
        },
        {
          id: 'about',
          title: t('settings.about'),
          icon: Info,
          type: 'action' as const,
          onPress: () => {
            legacyAlert(t('settings.aboutTitle'), t('settings.aboutBody', { version: getAppVersionLabel(), year: new Date().getFullYear() }));
          }
        }
      ]
    }
  ];

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: DesignTokens.colors.background.primary }]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={[styles.loadingText, { color: DesignTokens.colors.text.secondary }]}>{t('common.loading')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: DesignTokens.colors.background.primary }]}>
      <RNSafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title={t('settings.title')}
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />

        <ScrollView style={styles.root} showsVerticalScrollIndicator={false}>
          <View style={styles.scroll}>
            {settingSections.map((section) => (
              <View key={section.title}>
                <SettingsSectionTitle title={section.title} />
                <SettingsGlassCard>
                  {section.items.map((item, itemIndex) => {
                    const ItemIcon = item.icon;
                    const danger = 'danger' in item && item.danger;
                    const iconColor = danger
                      ? DesignTokens.colors.danger.main
                      : DesignTokens.colors.text.primary;

                    return (
                      <View key={item.id}>
                        <TouchableOpacity
                          onPress={
                            item.type === 'action'
                              ? () => {
                                  void HapticFeedback.impactLight();
                                  item.onPress?.();
                                }
                              : undefined
                          }
                          disabled={item.type === 'switch'}
                          activeOpacity={item.type === 'action' ? 0.7 : 1}
                          style={styles.row}
                        >
                          {item.type === 'switch' && item.onToggle ? (
                            <AppSwitch
                              value={item.value}
                              onValueChange={item.onToggle}
                              trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                              thumbColor={item.value ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                              ios_backgroundColor={theme.switchTrackOff}
                              style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
                            />
                          ) : (
                            <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                          )}

                          <View style={styles.textCol}>
                            <Text
                              style={[
                                styles.title,
                                {
                                  color: danger
                                    ? DesignTokens.colors.danger.main
                                    : DesignTokens.colors.text.primary,
                                },
                              ]}
                            >
                              {item.title}
                            </Text>
                          </View>
                          <View style={styles.leadingIcon}>
                            <ItemIcon size={20} color={iconColor} strokeWidth={2} />
                          </View>
                        </TouchableOpacity>
                        {itemIndex < section.items.length - 1 ? (
                          <View
                            style={[
                              styles.divider,
                              { backgroundColor: DesignTokens.colors.border.divider },
                            ]}
                          />
                        ) : null}
                      </View>
                    );
                  })}
                </SettingsGlassCard>
              </View>
            ))}

            <View style={styles.versionWrap}>
              <Text style={[styles.version, { color: DesignTokens.colors.text.muted }]}>
                {isolateNumericRuns(t('settings.versionLine', { version: getAppVersionLabel() }))}
              </Text>
            </View>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...settingsHebrewText,
    ...settingsBodyType,
    marginTop: APP_LAYOUT.componentGap,
  },
  scroll: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.sectionHeaderToContent - 4,
    paddingBottom: 48,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  textCol: {
    flex: 1,
    minWidth: 0,
  },
  leadingIcon: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...settingsHebrewText,
    ...settingsRowType,
  },
  divider: {
    height: 1,
    marginHorizontal: APP_LAYOUT.cardPadding,
  },
  versionWrap: {
    alignItems: 'center',
    marginTop: APP_LAYOUT.cardStackGap,
    marginBottom: APP_LAYOUT.componentGap,
  },
  version: {
    ...settingsCaptionType,
  },
});
