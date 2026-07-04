import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Switch, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { 
  Bell,
  Volume2,
  Smartphone,
  MessageSquare,
  Newspaper,
  Calendar,
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../services/notificationService';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface NotificationSettings {
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
  messageNotifications: boolean;
  newsNotifications: boolean;
  earningsNotifications: boolean;
  economicCalendarNotifications: boolean;
  newsSound: string; // 'default' | 'sound1' | 'sound2' | 'sound3' | 'none'
  recordingSound: string; // 'default' | 'sound1' | 'sound2' | 'sound3' | 'none'
}

interface NotificationOption {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  key: keyof NotificationSettings;
}

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const DesignTokens = useDesignTokens();
  const [settings, setSettings] = useState<NotificationSettings>({
    notifications: true,
    sound: true,
    vibration: true,
    messageNotifications: true,
    newsNotifications: true,
    earningsNotifications: true,
    economicCalendarNotifications: true,
    newsSound: 'default',
    recordingSound: 'default'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    checkNotificationPermissions();
  }, [user]);

  const checkNotificationPermissions = async () => {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      
      // אם ההרשאות לא ניתנו, נכבה את כפתור "התראות כלליות"
      if (status !== 'granted' && settings.notifications) {
        const newSettings = {
          ...settings,
          notifications: false
        };
        setSettings(newSettings);
        await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
        await saveSettingsToDatabase(newSettings);
      }
    } catch (error) {
    }
  };

  const loadSettings = async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }

      // נסה לטעון מהמסד הנתונים (עדכני)
      const { data: dbSettings, error: dbError } = await supabase
        .from('user_notification_settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (dbSettings && !dbError) {
        // הגדרות מהמסד הנתונים - עדכניות
        const mappedSettings = {
          notifications: dbSettings.notifications_enabled ?? true,
          sound: dbSettings.sound_enabled ?? true,
          vibration: dbSettings.vibration_enabled ?? true,
          messageNotifications: dbSettings.message_notifications ?? true,
          newsNotifications: dbSettings.news_notifications ?? true,
          earningsNotifications: dbSettings.earnings_notifications ?? true,
          economicCalendarNotifications: dbSettings.economic_calendar_notifications ?? true,
          newsSound: typeof dbSettings.news_sound === 'string' ? dbSettings.news_sound : (dbSettings.news_sound ? 'default' : 'none'),
          recordingSound: typeof dbSettings.recording_sound === 'string' ? dbSettings.recording_sound : (dbSettings.recording_sound ? 'default' : 'none')
        };

        setSettings(mappedSettings);
        
        // עדכן את AsyncStorage עם הערכים מהמסד הנתונים (לשימוש offline)
        await AsyncStorage.setItem('notificationSettings', JSON.stringify(mappedSettings));
      } else {
        // אם אין במסד הנתונים, טען מ-AsyncStorage (גיבוי)
        const saved = await AsyncStorage.getItem('notificationSettings');
        if (saved) {
          const parsed = JSON.parse(saved);
          setSettings({
            ...parsed,
            newsSound: typeof parsed.newsSound === 'string' ? parsed.newsSound : (parsed.newsSound !== false ? 'default' : 'none'),
            recordingSound: typeof parsed.recordingSound === 'string' ? parsed.recordingSound : (parsed.recordingSound !== false ? 'default' : 'none')
          });

          // שמור במסד הנתונים כדי שיהיה עדכני
          await saveSettingsToDatabase(parsed);
        } else {
          // אין הגדרות בכלל - צור ברירת מחדל
          await saveSettingsToDatabase(settings);
        }
      }

      setLoading(false);
    } catch (error) {
      setLoading(false);
    }
  };

  const saveSettingsToDatabase = async (settingsToSave: NotificationSettings) => {
    try {
      if (!user) return;

      const { error } = await supabase
        .from('user_notification_settings')
        .upsert({
          user_id: user.id,
          notifications_enabled: settingsToSave.notifications ?? true,
          sound_enabled: settingsToSave.sound ?? true,
          vibration_enabled: settingsToSave.vibration ?? true,
          message_notifications: settingsToSave.messageNotifications ?? true,
          news_notifications: settingsToSave.newsNotifications ?? true,
          earnings_notifications: settingsToSave.earningsNotifications ?? true,
          economic_calendar_notifications: settingsToSave.economicCalendarNotifications ?? true,
          news_sound: settingsToSave.newsSound ?? 'default',
          recording_sound: settingsToSave.recordingSound ?? 'default',
        }, {
          onConflict: 'user_id'
        });

      if (error) {
      } else {
      }
    } catch (error) {
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    void HapticFeedback.selection();
    const newValue = !settings[key];
    // עדכן את המצב מיד (לפני כל בדיקות הרשאות)
    const newSettings = {
      ...settings,
      [key]: newValue
    };
    
    setSettings(newSettings);

    if (key === 'vibration') {
      HapticFeedback.setEnabled(newValue as boolean);
    }
    
    // אם זה כפתור "התראות כלליות" ומפעילים אותו, צריך לבקש הרשאות
    if (key === 'notifications' && newValue) {
      // בדוק את הסטטוס הנוכחי לפני שאנחנו מבקשים
      const { status: currentStatus } = await Notifications.getPermissionsAsync();
      // אם ההרשאות כבר ניתנו, נציג הודעה וננסה לשלוף את הטוקן
      if (currentStatus === 'granted') {
        // ננסה לשלוף את הטוקן ישירות
        const token = await NotificationService.getPushTokenDirectly();
        if (token) {
        } else {
        }
        
        const registered = await NotificationService.registerDeviceToken();
        const isSimulator = !require('expo-device').Device.isDevice;
        if (registered) {
          legacyAlert(
            'התראות הופעלו',
            'תקבל התראות על אירועים חשובים באפליקציה.',
            [{ text: 'אישור' }]
          );
        } else {
          legacyAlert(
            'התראות הופעלו',
            isSimulator 
              ? 'ההרשאות כבר ניתנו. הערה: התראות Push לא עובדות בסימולטור - נסה במכשיר אמיתי כדי לבדוק push notifications.'
              : 'ההרשאות כבר ניתנו. אם יש בעיה ברישום המכשיר, נסה שוב מאוחר יותר.',
            [{ text: 'אישור' }]
          );
        }
        return;
      }
      
      // אם ההרשאות לא ניתנו, נבקש אותן
      const hasPermission = await NotificationService.requestPermissions(true);
      if (!hasPermission) {
        // המשתמש לא נתן הרשאות - נחזיר למצב כבוי
        const revertedSettings = {
          ...newSettings,
          [key]: false
        };
        setSettings(revertedSettings);
        
        legacyAlert(
          'הרשאות התראות נדרשות',
          'כדי לקבל התראות, אנא אפשר גישה להתראות בהגדרות המכשיר.',
          [
            {
              text: 'ביטול',
              style: 'cancel',
              onPress: () => {
              }
            },
            {
              text: 'פתח הגדרות',
              onPress: () => {
                // פתח את מסך ההגדרות של המכשיר
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                } else {
                  Linking.openSettings();
                }
              }
            }
          ]
        );
        
        // שמור את המצב המבוטל
        try {
          await AsyncStorage.setItem('notificationSettings', JSON.stringify(revertedSettings));
          await saveSettingsToDatabase(revertedSettings);
        } catch (error) {
        }
        return;
      }
      
      // אם יש הרשאות, נשמור את ה-token במסד הנתונים
      // ננסה לשלוף את הטוקן ישירות
      const token = await NotificationService.getPushTokenDirectly();
      if (token) {
      } else {
      }
      
      const registered = await NotificationService.registerDeviceToken();
      if (registered) {
        legacyAlert(
          'התראות הופעלו',
          'תקבל התראות על אירועים חשובים באפליקציה.',
          [{ text: 'אישור' }]
        );
      } else {
        // אם זה סימולטור, נסביר למשתמש
        const isSimulator = !require('expo-device').Device.isDevice;
        legacyAlert(
          'התראות הופעלו',
          isSimulator 
            ? 'ההרשאות ניתנו. הערה: התראות Push לא עובדות בסימולטור - נסה במכשיר אמיתי.'
            : 'ההרשאות ניתנו. אם יש בעיה ברישום המכשיר, נסה שוב מאוחר יותר.',
          [{ text: 'אישור' }]
        );
      }
    }
    
    try {
      // שמור גם ב-AsyncStorage (לשימוש offline)
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      
      // שמור גם במסד הנתונים (להתראות server-side)
      await saveSettingsToDatabase(newSettings);
    } catch (error) {
    }
  };

  const systemNotificationOptions: NotificationOption[] = [
    {
      id: 'notifications',
      title: 'התראות כלליות',
      subtitle: 'התראות על אירועים חשובים',
      icon: Bell,
      key: 'notifications'
    },
    {
      id: 'messageNotifications',
      title: 'התראות הודעות',
      subtitle: 'הודעות חדשות בצ\'אט',
      icon: MessageSquare,
      key: 'messageNotifications'
    },
    {
      id: 'sound',
      title: 'צלילים כלליים',
      subtitle: 'הפעל צלילי התראות',
      icon: Volume2,
      key: 'sound'
    },
    {
      id: 'vibration',
      title: 'רטט',
      subtitle: 'רטט בהתראות',
      icon: Smartphone,
      key: 'vibration'
    }
  ];

  const newsNotificationOptions: NotificationOption[] = [
    {
      id: 'newsNotifications',
      title: 'התראות חדשות',
      subtitle: 'חדשות חשובות ושוברות',
      icon: Newspaper,
      key: 'newsNotifications'
    },
    {
      id: 'earningsNotifications',
      title: 'דיווחי תוצאות',
      subtitle: 'התראות על דיווחי רווח',
      icon: Bell,
      key: 'earningsNotifications'
    },
    {
      id: 'economicCalendarNotifications',
      title: 'יומן כלכלי',
      subtitle: 'אירועים כלכליים חשובים',
      icon: Calendar,
      key: 'economicCalendarNotifications'
    }
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 16, marginTop: 16 }}>טוען הגדרות...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="התראות"
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
          <View style={{ paddingHorizontal: DesignTokens.spacing.lg, paddingTop: DesignTokens.spacing.lg }}>
            {/* System Notifications Section */}
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.xs,
              fontWeight: DesignTokens.typography.fontWeight.bold as any,
              color: DesignTokens.colors.text.tertiary,
              marginBottom: DesignTokens.spacing.sm,
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              התראות מערכת
            </Text>

            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              style={{ marginBottom: DesignTokens.spacing.lg, borderRadius: DesignTokens.borderRadius.lg }}
            >
            {systemNotificationOptions.map((option, index) => (
              <View key={option.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingTop: DesignTokens.spacing.md,
                    paddingBottom: index < systemNotificationOptions.length - 1 ? DesignTokens.spacing.sm : DesignTokens.spacing.md,
                    paddingHorizontal: DesignTokens.spacing.md,
                  }}
                  pointerEvents="box-none"
                >
                {/* Switch - שמאל */}
                <Switch
                  key={`switch-${option.key}-${settings[option.key]}`}
                  value={settings[option.key] === true}
                  onValueChange={(value) => {
                    handleToggle(option.key);
                  }}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.15)', true: DesignTokens.colors.primary.main }}
                  thumbColor={settings[option.key] === true ? DesignTokens.colors.text.primary : 'rgba(255, 255, 255, 0.5)'}
                  ios_backgroundColor="rgba(255, 255, 255, 0.15)"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  disabled={false}
                />

                {/* Text */}
                <View style={{ flex: 1, marginLeft: DesignTokens.spacing.sm, marginRight: DesignTokens.spacing.sm }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.base,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.xs,
                    textAlign: 'right'
                  }}>
                    {option.title}
                  </Text>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.sm,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }}>
                    {option.subtitle}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: DesignTokens.borderRadius.md,
                  backgroundColor: `${DesignTokens.colors.primary.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <option.icon size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </View>
              {index < systemNotificationOptions.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  marginHorizontal: DesignTokens.spacing.md,
                }} />
              )}
            </View>
            ))}
            </UICard>

            {/* News Notifications Section */}
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.xs,
              fontWeight: DesignTokens.typography.fontWeight.bold as any,
              color: DesignTokens.colors.text.tertiary,
              marginBottom: DesignTokens.spacing.sm,
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              התראות חדשות
            </Text>

            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              style={{ marginBottom: DesignTokens.spacing.lg, borderRadius: DesignTokens.borderRadius.lg }}
            >
            {newsNotificationOptions.map((option, index) => (
              <View key={option.id}>
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingTop: DesignTokens.spacing.md,
                    paddingBottom: index < newsNotificationOptions.length - 1 ? DesignTokens.spacing.sm : DesignTokens.spacing.md,
                    paddingHorizontal: DesignTokens.spacing.md,
                  }}
                  pointerEvents="box-none"
                >
                {/* Switch - שמאל */}
                <Switch
                  key={`switch-${option.key}-${settings[option.key]}`}
                  value={settings[option.key] === true}
                  onValueChange={(value) => {
                    handleToggle(option.key);
                  }}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.15)', true: DesignTokens.colors.primary.main }}
                  thumbColor={settings[option.key] === true ? DesignTokens.colors.text.primary : 'rgba(255, 255, 255, 0.5)'}
                  ios_backgroundColor="rgba(255, 255, 255, 0.15)"
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                  disabled={false}
                />

                {/* Text */}
                <View style={{ flex: 1, marginLeft: DesignTokens.spacing.sm, marginRight: DesignTokens.spacing.sm }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.base,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.xs,
                    textAlign: 'right'
                  }}>
                    {option.title}
                  </Text>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.sm,
                    color: DesignTokens.colors.text.tertiary,
                    textAlign: 'right'
                  }}>
                    {option.subtitle}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: DesignTokens.borderRadius.md,
                  backgroundColor: `${DesignTokens.colors.primary.main}1A`,
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <option.icon size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </View>
              {index < newsNotificationOptions.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                  marginHorizontal: DesignTokens.spacing.md,
                }} />
              )}
            </View>
            ))}
            </UICard>
          </View>
          </ScrollView>
        </View>
      </RNSafeAreaView>
    </View>
  );
}
