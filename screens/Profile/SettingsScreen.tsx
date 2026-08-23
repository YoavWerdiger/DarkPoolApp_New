import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import * as LocalAuthentication from 'expo-local-authentication';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  loadAppSettings,
  saveAppSettings,
  clearAppCache,
  type AppLanguage,
} from '../../services/appSettings';
import { getAppVersionLabel } from '../../utils/appMeta';
import { SettingsSectionTitle } from '../../components/profile/ProfileSettingsUI';

interface SettingItem {
  id: string;
  title: string;
  subtitle: string;
  type: 'switch' | 'action';
  value?: boolean;
  onToggle?: (value: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
}

export default function SettingsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
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
      title: 'שפה',
      items: [
        {
          id: 'language',
          title: 'שפת ממשק',
          subtitle: language === 'he' ? 'עברית (מועדף)' : 'English (preferred)',
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
          subtitle: 'סטטוס מנוי והורדת חשבוניות',
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
          subtitle: 'השתמש ב-Face ID / Touch ID',
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
          subtitle: 'מחק נתונים זמניים',
          type: 'action' as const,
          onPress: handleClearCache,
          danger: true
        },
        {
          id: 'about',
          title: 'אודות האפליקציה',
          subtitle: 'מידע וגרסה',
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
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={{ 
          color: DesignTokens.colors.text.secondary, 
          fontSize: DesignTokens.typography.body.size,
          fontWeight: DesignTokens.typography.body.weight as any,
          lineHeight: DesignTokens.typography.body.lineHeight,
          marginTop: DesignTokens.spacing.lg 
        }}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="הגדרות"
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />

        <View style={{ flex: 1 }}>
          <ScrollView 
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
          >
          <View
            style={{
              paddingHorizontal: DesignTokens.spacing.base,
              paddingTop: DesignTokens.spacing.md,
            }}
          >
            {settingSections.map((section) => (
              <View key={section.title} style={{ marginBottom: DesignTokens.spacing.lg }}>
                <SettingsSectionTitle title={section.title} />

                <UICard
                  variant="glass"
                  glassIntensity="light"
                  padding="none"
                  style={{ borderRadius: DesignTokens.borderRadius.lg }}
                >
                {section.items.map((item, itemIndex) => (
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
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: DesignTokens.spacing.md,
                        paddingHorizontal: DesignTokens.spacing.base,
                      }}
                    >
                    {item.type === 'switch' && item.onToggle ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                        thumbColor={item.value ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                        ios_backgroundColor={theme.switchTrackOff}
                        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                      />
                    ) : (
                      <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
                    )}

                    <View style={{ flex: 1, marginStart: DesignTokens.spacing.md }}>
                      <Text style={{
                        fontSize: DesignTokens.typography.body.size,
                        fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                        lineHeight: DesignTokens.typography.body.lineHeight,
                        color: 'danger' in item && item.danger ? DesignTokens.colors.danger.main : DesignTokens.colors.text.primary,
                        marginBottom: DesignTokens.spacing.xs / 2,
                        textAlign: 'right'
                      }}>
                        {item.title}
                      </Text>
                      <Text style={{
                        fontSize: DesignTokens.typography.bodySmall.size,
                        fontWeight: DesignTokens.typography.bodySmall.weight as any,
                        lineHeight: DesignTokens.typography.bodySmall.lineHeight,
                        color: DesignTokens.colors.text.tertiary,
                        textAlign: 'right'
                      }}>
                        {item.subtitle}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {itemIndex < section.items.length - 1 && (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: DesignTokens.colors.border.divider,
                        marginHorizontal: DesignTokens.spacing.base,
                      }}
                    />
                  )}
                </View>
                ))}
                </UICard>
              </View>
            ))}

            {/* App Version */}
            <View style={{ 
              alignItems: 'center', 
              marginTop: DesignTokens.spacing.md,
              marginBottom: DesignTokens.spacing.lg
            }}>
              <Text style={{ 
                color: DesignTokens.colors.text.tertiary, 
                fontSize: DesignTokens.typography.caption.size,
                fontWeight: DesignTokens.typography.caption.weight as any,
              }}>
                DarkPool App · גרסה {getAppVersionLabel()}
              </Text>
            </View>
          </View>
          </ScrollView>
        </View>
      </RNSafeAreaView>
    </View>
  );
}
