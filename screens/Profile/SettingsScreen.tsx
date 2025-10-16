import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Switch, 
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  SafeAreaView
} from 'react-native';
import { 
  Globe, 
  Moon, 
  Sun,
  ArrowLeft,
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
  const [settings, setSettings] = useState({
    darkMode: true,
    autoUpdate: true,
    dataSaving: false,
    biometricAuth: false,
    language: 'he'
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

  const handleLanguageChange = () => {
    Alert.alert(
      'שפה',
      'בחר שפה',
      [
        { text: 'עברית', onPress: () => handleToggle('language', 'he') },
        { text: 'English', onPress: () => handleToggle('language', 'en') },
        { text: 'ביטול', style: 'cancel' }
      ]
    );
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

  const handleBiometricAuth = (value: boolean) => {
    if (value) {
      Alert.alert(
        'אימות ביומטרי',
        'הפעלת אימות ביומטרי תאפשר לך להתחבר לאפליקציה באמצעות Face ID או Touch ID.',
        [
          { text: 'ביטול', onPress: () => {} },
          { 
            text: 'הפעל', 
            onPress: () => {
              // Here you would integrate with biometric authentication
              handleToggle('biometricAuth', true);
              Alert.alert('הצלחה', 'אימות ביומטרי הופעל');
            }
          }
        ]
      );
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
          title: settings.darkMode ? 'מצב כהה' : 'מצב בהיר',
          subtitle: settings.darkMode ? 'תצוגה כהה לעיניים' : 'תצוגה בהירה ובהירה',
          icon: settings.darkMode ? Moon : Sun,
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
        },
        {
          id: 'language',
          title: 'שפה',
          subtitle: settings.language === 'he' ? 'עברית' : 'English',
          icon: Globe,
          type: 'action' as const,
          onPress: handleLanguageChange
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00E654" />
          <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 16 }}>טוען...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.background }}>
      <SafeAreaView style={{ backgroundColor: theme.cardBackground }}>
        {/* Header */}
        <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: theme.cardBackground,
        borderBottomWidth: 1,
        borderBottomColor: theme.border
      }}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={{
            width: 36,
            height: 36,
            justifyContent: 'center',
            alignItems: 'center',
            borderRadius: 18,
            backgroundColor: theme.isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'
          }}
        >
          <ArrowLeft size={20} color={theme.textPrimary} strokeWidth={2} />
        </TouchableOpacity>
        
        <Text style={{
          flex: 1,
          textAlign: 'center',
          fontSize: 20,
          fontWeight: '700',
          color: theme.textPrimary,
          marginRight: 36
        }}>
          הגדרות
        </Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {settingSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={{ marginBottom: 24 }}>
              {/* Section Title */}
              <Text style={{
                fontSize: 13,
                fontWeight: '700',
                color: theme.textTertiary,
                marginBottom: 12,
                marginRight: 4,
                textAlign: 'right',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                {section.title}
              </Text>

              {/* Section Items */}
              <View style={{
                backgroundColor: theme.cardBackground,
                borderRadius: 16,
                overflow: 'hidden'
              }}>
                {section.items.map((item, itemIndex) => (
                  <TouchableOpacity
                    key={item.id}
                    onPress={item.type === 'action' ? item.onPress : undefined}
                    disabled={item.type === 'switch'}
                    activeOpacity={item.type === 'action' ? 0.7 : 1}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderBottomWidth: itemIndex < section.items.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border
                    }}
                  >
                    {/* Switch/Chevron - שמאל */}
                    {item.type === 'switch' && item.onToggle ? (
                      <Switch
                        value={item.value}
                        onValueChange={item.onToggle}
                        trackColor={{ false: theme.switchTrackOff, true: '#00E654' }}
                        thumbColor={item.value ? '#ffffff' : theme.switchThumbOff}
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
                        color: item.danger ? '#EF4444' : theme.textPrimary,
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
                        color={item.danger ? '#EF4444' : '#00E654'} 
                        strokeWidth={2} 
                      />
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ))}

          {/* App Version */}
          <View style={{ 
            alignItems: 'center', 
            marginTop: 16,
            marginBottom: 20
          }}>
            <Text style={{ 
              color: theme.textTertiary, 
              fontSize: 13
            }}>
              DarkPool App · גרסה 1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
