import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { 
  Moon, 
  Smartphone,
  Lock,
  Database,
  Trash2,
  Info,
  ChevronLeft,
  RefreshCcw,
  HardDrive,
  Fingerprint,
  Shield
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import * as LocalAuthentication from 'expo-local-authentication';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface SettingItem {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
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
  const mainTabsHeight = useMainTabsHeight();
  const [settings, setSettings] = useState({
    darkMode: true,
    autoUpdate: true,
    dataSaving: false,
    biometricAuth: false
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('appSettings');
      if (saved) {
        const parsedSettings = JSON.parse(saved);
        setSettings(parsedSettings);
      }
      setIsLoading(false);
    } catch (error) {
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
    void HapticFeedback.selection();
    const newSettings = {
      ...settings,
      [key]: value
    };
    
    setSettings(newSettings);
    
    // Update theme immediately for dark mode
    if (key === 'darkMode') {
      toggleTheme();
    }
    
    try {
      await AsyncStorage.setItem('appSettings', JSON.stringify(newSettings));
    } catch (error) {
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
              // Clear AsyncStorage cache
              const keys = await AsyncStorage.getAllKeys();
              const cacheKeys = keys.filter(key => 
                key.startsWith('cache_') || 
                key.startsWith('temp_') || 
                key === 'offlineData'
              );
              
              if (cacheKeys.length > 0) {
                await AsyncStorage.multiRemove(cacheKeys);
              }
              
              void HapticFeedback.success();
              legacyAlert('הצלחה', 'המטמון נוקה בהצלחה');
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
          handleToggle('biometricAuth', true);
          void HapticFeedback.success();
          legacyAlert('הצלחה', 'אימות ביומטרי הופעל בהצלחה');
        } else {
          legacyAlert('בוטל', 'אימות ביומטרי בוטל');
        }
      } catch (error) {
        legacyAlert('שגיאה', 'שגיאה בהפעלת אימות ביומטרי');
      }
    } else {
      handleToggle('biometricAuth', false);
    }
  };

  const settingSections = [
    {
      title: 'תצוגה',
      items: [
        {
          id: 'darkMode',
          title: 'מצב כהה',
          subtitle: 'תצוגה כהה לעיניים',
          icon: Moon,
          type: 'switch' as const,
          value: settings.darkMode,
          onToggle: (value: boolean) => handleToggle('darkMode', value)
        }
      ]
    },
    {
      title: 'אפליקציה',
      items: [
        {
          id: 'autoUpdate',
          title: 'עדכון אוטומטי',
          subtitle: 'עדכן תוכן באופן אוטומטי',
          icon: RefreshCcw,
          type: 'switch' as const,
          value: settings.autoUpdate,
          onToggle: (value: boolean) => handleToggle('autoUpdate', value)
        },
        {
          id: 'dataSaving',
          title: 'חיסכון בנתונים',
          subtitle: 'הפחת שימוש בנתונים סלולריים',
          icon: HardDrive,
          type: 'switch' as const,
          value: settings.dataSaving,
          onToggle: (value: boolean) => handleToggle('dataSaving', value)
        }
      ]
    },
    {
      title: 'אבטחה',
      items: [
        {
          id: 'biometricAuth',
          title: 'אימות ביומטרי',
          subtitle: 'השתמש ב-Face ID / Touch ID',
          icon: Fingerprint,
          type: 'switch' as const,
          value: settings.biometricAuth,
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
          icon: Trash2,
          type: 'action' as const,
          onPress: handleClearCache,
          danger: true
        },
        {
          id: 'about',
          title: 'אודות האפליקציה',
          subtitle: 'מידע וגרסה',
          icon: Info,
          type: 'action' as const,
          onPress: () => {
            legacyAlert('אודות', 'DarkPool App\nגרסה 1.0.0\n\n© 2025 DarkPool');
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
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top']}>
        <ChatSubScreenHeader title="הגדרות" onBack={() => navigation.goBack()} />

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
            {settingSections.map((section, sectionIndex) => (
              <View key={sectionIndex} style={{ marginBottom: DesignTokens.spacing.lg }}>
                {/* Section Title */}
                <Text style={{
                  fontSize: DesignTokens.typography.caption.size,
                  fontWeight: DesignTokens.typography.fontWeight.bold as any,
                  color: DesignTokens.colors.text.tertiary,
                  marginBottom: DesignTokens.spacing.sm,
                  textAlign: 'right',
                  textTransform: 'uppercase',
                  letterSpacing: DesignTokens.typography.letterSpacing.wide
                }}>
                  {section.title}
                </Text>

                {/* Section Items */}
                <UICard 
                  variant="glass"
                  glassIntensity="light"
                  padding="none"
                  style={{ borderRadius: DesignTokens.borderRadius.lg }}
                >
                {section.items.map((item, itemIndex) => (
                  <View key={item.id}>
                    <TouchableOpacity
                      onPress={item.type === 'action' ? item.onPress : undefined}
                      disabled={item.type === 'switch'}
                      activeOpacity={item.type === 'action' ? 0.7 : 1}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: DesignTokens.spacing.md,
                        paddingHorizontal: DesignTokens.spacing.base,
                      }}
                    >
                    {/* Switch/Chevron - שמאל */}
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

                    {/* Text Content - מרכז */}
                    <View style={{ flex: 1, marginLeft: DesignTokens.spacing.md, marginRight: DesignTokens.spacing.md }}>
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

                    {/* Icon - ימין */}
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: DesignTokens.borderRadius.sm,
                      backgroundColor: 'danger' in item && item.danger ? `${DesignTokens.colors.danger.main}1A` : `${DesignTokens.colors.primary.main}1A`,
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <item.icon 
                        size={20} 
                        color={'danger' in item && item.danger ? DesignTokens.colors.danger.main : DesignTokens.colors.primary.main} 
                        strokeWidth={2} 
                      />
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
                DarkPool App · גרסה 1.0.0
              </Text>
            </View>
          </View>
          </ScrollView>
        </View>
      </RNSafeAreaView>
    </View>
  );
}
