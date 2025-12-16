import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Switch, 
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView,
  StyleSheet
} from 'react-native';
import { 
  Moon, 
  ArrowRight,
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
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import * as LocalAuthentication from 'expo-local-authentication';

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
      console.error('Error loading settings:', error);
      setIsLoading(false);
    }
  };

  const handleToggle = async (key: string, value: boolean) => {
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
      console.error('Error saving settings:', error);
    }
  };


  const handleClearCache = () => {
    Alert.alert(
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
              
              Alert.alert('הצלחה', 'המטמון נוקה בהצלחה');
            } catch (error) {
              console.error('Error clearing cache:', error);
              Alert.alert('שגיאה', 'שגיאה בניקוי המטמון');
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
          Alert.alert('שגיאה', 'המכשיר שלך לא תומך באימות ביומטרי');
          return;
        }

        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!enrolled) {
          Alert.alert('שגיאה', 'לא הוגדר אימות ביומטרי במכשיר. אנא הגדר Face ID או Touch ID בהגדרות המכשיר');
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
          Alert.alert('הצלחה', 'אימות ביומטרי הופעל בהצלחה');
        } else {
          Alert.alert('בוטל', 'אימות ביומטרי בוטל');
        }
      } catch (error) {
        console.error('Error with biometric auth:', error);
        Alert.alert('שגיאה', 'שגיאה בהפעלת אימות ביומטרי');
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
            Alert.alert('אודות', 'DarkPool App\nגרסה 1.0.0\n\n© 2025 DarkPool');
          }
        }
      ]
    }
  ];


  if (isLoading) {
    return (
      <View style={{ flex: 1 }}>
        <LinearGradient
          colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
          locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 16, marginTop: 16 }}>טוען...</Text>
          </View>
        </RNSafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* רקע עם גרדיאנט ירוק כהה-שחור אנכי */}
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header עם blur */}
        <View style={{ paddingTop: 0 + DesignTokens.spacing.md, paddingHorizontal: DesignTokens.spacing.lg }}>
          <UICard 
            variant="blur"
            padding="sm"
          >
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingHorizontal: DesignTokens.spacing.md,
              minHeight: 44,
            }}>
              <Text style={{
                flex: 1,
                textAlign: 'center',
                fontSize: DesignTokens.typography.fontSize.lg,
                fontWeight: DesignTokens.typography.fontWeight.bold as any,
                color: DesignTokens.colors.text.primary,
                marginLeft: 36
              }}>
                הגדרות
              </Text>

              <TouchableOpacity 
                onPress={() => navigation.goBack()}
                activeOpacity={0.7}
                style={{
                  width: 36,
                  height: 36,
                  justifyContent: 'center',
                  alignItems: 'center',
                  borderRadius: 18,
                  backgroundColor: 'rgba(255, 255, 255, 0.05)'
                }}
              >
                <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
          </UICard>
        </View>

        <ScrollView 
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg }}>
            {settingSections.map((section, sectionIndex) => (
              <View key={sectionIndex} style={{ marginBottom: DesignTokens.spacing.lg }}>
                {/* Section Title */}
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.xs,
                  fontWeight: DesignTokens.typography.fontWeight.bold as any,
                  color: DesignTokens.colors.text.tertiary,
                  marginBottom: DesignTokens.spacing.sm,
                  marginRight: 4,
                  textAlign: 'right',
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  {section.title}
                </Text>

                {/* Section Items עם blur */}
                <UICard 
                  variant="blur"
                  padding="none"
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
                        paddingTop: 16,
                        paddingBottom: itemIndex < section.items.length - 1 ? 12 : 16,
                        paddingHorizontal: 16,
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
                      <ChevronLeft size={20} color={theme.textTertiary} strokeWidth={2} />
                    )}

                    {/* Text Content - מרכז */}
                    <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: item.danger ? DesignTokens.colors.danger.main : theme.textPrimary,
                        marginBottom: 2,
                        textAlign: 'right'
                      }}>
                        {item.title}
                      </Text>
                      <Text style={{
                        fontSize: 13,
                        color: theme.textTertiary,
                        textAlign: 'right'
                      }}>
                        {item.subtitle}
                      </Text>
                    </View>

                    {/* Icon - ימין */}
                    <View style={{
                      width: 36,
                      height: 36,
                      borderRadius: 8,
                      backgroundColor: item.danger ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 230, 84, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <item.icon 
                        size={20} 
                        color={item.danger ? DesignTokens.colors.danger.main : DesignTokens.colors.primary.main} 
                        strokeWidth={2} 
                      />
                    </View>
                  </TouchableOpacity>
                  {itemIndex < section.items.length - 1 && (
                    <View style={{
                      height: 1,
                      backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    }} />
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
                fontSize: DesignTokens.typography.fontSize.sm
              }}>
                DarkPool App · גרסה 1.0.0
              </Text>
            </View>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
