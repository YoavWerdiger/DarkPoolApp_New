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
  ChevronLeft,
  Languages,
  CreditCard,
  ScanFace,
  Eraser,
  Info,
  Moon,
  type LucideIcon,
} from 'lucide-react-native';
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
  type AppLanguage,
} from '../../services/appSettings';
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
  const [language, setLanguage] = useState<AppLanguage>('he');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const saved = await loadAppSettings();
      setBiometricAuth(saved.biometricAuth);
      setLanguage(saved.language);
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

  const cycleLanguage = async () => {
    void HapticFeedback.selection();
    const next: AppLanguage = language === 'he' ? 'en' : 'he';
    setLanguage(next);
    try {
      await saveAppSettings({ language: next });
      legacyAlert(
        'שפה',
        next === 'he'
          ? 'העדפת שפה: עברית (נשמר מקומית).\nתרגום מלא של הממשק עדיין לא מחובר.'
          : 'Language preference: English (saved locally).\nFull UI translation is not wired yet.',
      );
    } catch {
      /* noop */
    }
  };

  const handleClearCache = () => {
    legacyAlert(
      'נקה מטמון',
      'האם אתה בטוח שברצונך למחוק את כל הנתונים הזמניים? פעולה זו לא תמחק את המידע האישי שלך.',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'נקה',
          style: 'destructive',
          onPress: async () => {
            try {
              const removed = await clearAppCache();
              void HapticFeedback.success();
              legacyAlert(
                'הצלחה',
                removed > 0 ? `נוקו ${removed} פריטי מטמון` : 'אין מטמון לניקוי',
              );
            } catch (error) {
              legacyAlert('שגיאה', 'שגיאה בניקוי המטמון');
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
          legacyAlert('שגיאה', 'המכשיר שלך לא תומך באימות ביומטרי');
          return;
        }

        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          legacyAlert('שגיאה', 'לא הוגדר אימות ביומטרי במכשיר. אנא הגדר Face ID או Touch ID בהגדרות המכשיר');
          return;
        }

        // נבצע אימות ביומטרי
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'אמת את זהותך',
          cancelLabel: 'ביטול',
          disableDeviceFallback: false,
        });

        if (result.success) {
          await persistBiometric(true);
          void HapticFeedback.success();
          legacyAlert('הצלחה', 'אימות ביומטרי הופעל בהצלחה');
        } else {
          legacyAlert('בוטל', 'אימות ביומטרי בוטל');
        }
      } catch (error) {
        legacyAlert('שגיאה', 'שגיאה בהפעלת אימות ביומטרי');
      }
    } else {
      await persistBiometric(false);
    }
  };

  const settingSections = [
    {
      title: 'מראה',
      items: [
        {
          id: 'darkMode',
          title: 'מצב כהה',
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
      title: 'שפה',
      items: [
        {
          id: 'language',
          title: 'שפת ממשק',
          icon: Languages,
          type: 'action' as const,
          onPress: () => void cycleLanguage(),
        },
      ],
    },
    {
      title: 'מנוי וחיובים',
      items: [
        {
          id: 'billing',
          title: 'מנוי, תשלומים וחשבוניות',
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
      title: 'אבטחה',
      items: [
        {
          id: 'biometricAuth',
          title: 'אימות ביומטרי',
          icon: ScanFace,
          type: 'switch' as const,
          value: biometricAuth,
          onToggle: handleBiometricAuth
        }
      ]
    },
    {
      title: 'מתקדם',
      items: [
        {
          id: 'clearCache',
          title: 'נקה מטמון',
          icon: Eraser,
          type: 'action' as const,
          onPress: handleClearCache,
          danger: true
        },
        {
          id: 'about',
          title: 'אודות האפליקציה',
          icon: Info,
          type: 'action' as const,
          onPress: () => {
            legacyAlert('אודות', `DarkPool App\nגרסה ${getAppVersionLabel()}\n\n© ${new Date().getFullYear()} DarkPool`);
          }
        }
      ]
    }
  ];

  if (isLoading) {
    return (
      <View style={[styles.loading, { backgroundColor: DesignTokens.colors.background.primary }]}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={[styles.loadingText, { color: DesignTokens.colors.text.secondary }]}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: DesignTokens.colors.background.primary }]}>
      <RNSafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="הגדרות"
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
                {isolateNumericRuns(`DarkPool App · גרסה ${getAppVersionLabel()}`)}
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
