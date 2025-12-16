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
  Bell, 
  ArrowRight,
  Volume2,
  Smartphone,
  MessageSquare,
  Newspaper,
  TrendingUp,
  Calendar,
  ChevronLeft,
  Mic
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../services/notificationService';
import { Linking, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

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

const SOUND_OPTIONS = [
  { value: 'default', label: 'ברירת מחדל' },
  { value: 'sound1', label: 'צליל 1' },
  { value: 'sound2', label: 'צליל 2' },
  { value: 'sound3', label: 'צליל 3' },
  { value: 'none', label: 'ללא צליל' }
];

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
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
  const [showNewsSoundPicker, setShowNewsSoundPicker] = useState(false);
  const [showRecordingSoundPicker, setShowRecordingSoundPicker] = useState(false);

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
      console.error('Error checking notification permissions:', error);
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
      console.error('Error loading settings:', error);
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
        console.error('Error saving settings to database:', error);
      } else {
        console.log('✅ Settings saved to database');
      }
    } catch (error) {
      console.error('Error in saveSettingsToDatabase:', error);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    console.log('🔵 NotificationsScreen: handleToggle called with key:', key);
    console.log('🔵 NotificationsScreen: Current settings:', JSON.stringify(settings, null, 2));
    
    const newValue = !settings[key];
    console.log(`🔄 NotificationsScreen: Toggling ${key} from ${settings[key]} to ${newValue}`);
    
    // עדכן את המצב מיד (לפני כל בדיקות הרשאות)
    const newSettings = {
      ...settings,
      [key]: newValue
    };
    
    console.log('🔵 NotificationsScreen: Setting new settings:', JSON.stringify(newSettings, null, 2));
    setSettings(newSettings);
    
    // אם זה כפתור "התראות כלליות" ומפעילים אותו, צריך לבקש הרשאות
    if (key === 'notifications' && newValue) {
      console.log('🔔 NotificationsScreen: Requesting notification permissions...');
      
      // בדוק את הסטטוס הנוכחי לפני שאנחנו מבקשים
      const { status: currentStatus } = await Notifications.getPermissionsAsync();
      console.log('🔔 NotificationsScreen: Current permission status:', currentStatus);
      
      // אם ההרשאות כבר ניתנו, נציג הודעה וננסה לשלוף את הטוקן
      if (currentStatus === 'granted') {
        console.log('✅ NotificationsScreen: Permissions already granted, attempting to get token...');
        
        // ננסה לשלוף את הטוקן ישירות
        const token = await NotificationService.getPushTokenDirectly();
        if (token) {
          console.log('✅ NotificationsScreen: Got push token directly:', token.substring(0, 20) + '...');
        } else {
          console.log('⚠️ NotificationsScreen: Could not get push token directly, trying registerDeviceToken...');
        }
        
        const registered = await NotificationService.registerDeviceToken();
        console.log(`📊 NotificationsScreen: registerDeviceToken returned: ${registered}`);
        
        const isSimulator = !require('expo-device').Device.isDevice;
        if (registered) {
          Alert.alert(
            'התראות הופעלו',
            'תקבל התראות על אירועים חשובים באפליקציה.',
            [{ text: 'אישור' }]
          );
        } else {
          Alert.alert(
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
      console.log('🔔 NotificationsScreen: Permission result:', hasPermission);
      
      if (!hasPermission) {
        // המשתמש לא נתן הרשאות - נחזיר למצב כבוי
        console.log('❌ NotificationsScreen: Permissions denied, reverting switch');
        const revertedSettings = {
          ...newSettings,
          [key]: false
        };
        setSettings(revertedSettings);
        
        Alert.alert(
          'הרשאות התראות נדרשות',
          'כדי לקבל התראות, אנא אפשר גישה להתראות בהגדרות המכשיר.',
          [
            {
              text: 'ביטול',
              style: 'cancel',
              onPress: () => {
                console.log('❌ NotificationsScreen: User cancelled permission request');
              }
            },
            {
              text: 'פתח הגדרות',
              onPress: () => {
                console.log('🔵 NotificationsScreen: Opening device settings...');
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
          console.log('✅ NotificationsScreen: Reverted settings saved');
        } catch (error) {
          console.error('❌ NotificationsScreen: Error saving reverted settings:', error);
        }
        return;
      }
      
      // אם יש הרשאות, נשמור את ה-token במסד הנתונים
      console.log('✅ NotificationsScreen: Permissions granted, registering device token...');
      
      // ננסה לשלוף את הטוקן ישירות
      const token = await NotificationService.getPushTokenDirectly();
      if (token) {
        console.log('✅ NotificationsScreen: Got push token directly:', token.substring(0, 20) + '...');
      } else {
        console.log('⚠️ NotificationsScreen: Could not get push token directly, trying registerDeviceToken...');
      }
      
      const registered = await NotificationService.registerDeviceToken();
      console.log(`📊 NotificationsScreen: registerDeviceToken returned: ${registered}`);
      
      if (registered) {
        console.log('✅ NotificationsScreen: Device token registered successfully, showing success alert');
        Alert.alert(
          'התראות הופעלו',
          'תקבל התראות על אירועים חשובים באפליקציה.',
          [{ text: 'אישור' }]
        );
      } else {
        console.log('⚠️ NotificationsScreen: Device token registration failed, showing warning alert');
        // אם זה סימולטור, נסביר למשתמש
        const isSimulator = !require('expo-device').Device.isDevice;
        Alert.alert(
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
      console.log(`✅ NotificationsScreen: Settings saved for ${key}: ${newValue}`);
    } catch (error) {
      console.error('❌ NotificationsScreen: Error saving settings:', error);
    }
  };

  const handleSoundChange = async (key: 'newsSound' | 'recordingSound', value: string) => {
    const newSettings = {
      ...settings,
      [key]: value
    };
    
    setSettings(newSettings);
    
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
      await saveSettingsToDatabase(newSettings);
    } catch (error) {
      console.error('Error saving sound settings:', error);
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
      icon: TrendingUp,
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
            <Text style={{ color: DesignTokens.colors.text.secondary, fontSize: 16, marginTop: 16 }}>טוען הגדרות...</Text>
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
                התראות
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
              variant="blur"
              padding="none"
              style={{ marginBottom: DesignTokens.spacing.lg }}
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
                  value={settings[option.key] ?? false}
                  onValueChange={(value) => {
                    console.log('🔵 NotificationsScreen: Switch onValueChange called:', option.key, 'value:', value);
                    handleToggle(option.key);
                  }}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.15)', true: DesignTokens.colors.primary.main }}
                  thumbColor={settings[option.key] ? DesignTokens.colors.text.primary : 'rgba(255, 255, 255, 0.5)'}
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
              variant="blur"
              padding="none"
              style={{ marginBottom: DesignTokens.spacing.lg }}
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
                  value={settings[option.key] ?? false}
                  onValueChange={(value) => {
                    console.log('🔵 NotificationsScreen: Switch onValueChange called:', option.key, 'value:', value);
                    handleToggle(option.key);
                  }}
                  trackColor={{ false: 'rgba(255, 255, 255, 0.15)', true: DesignTokens.colors.primary.main }}
                  thumbColor={settings[option.key] ? DesignTokens.colors.text.primary : 'rgba(255, 255, 255, 0.5)'}
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

            {/* Sounds Section */}
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.xs,
              fontWeight: DesignTokens.typography.fontWeight.bold as any,
              color: DesignTokens.colors.text.tertiary,
              marginBottom: DesignTokens.spacing.sm,
              textAlign: 'right',
              textTransform: 'uppercase',
              letterSpacing: 0.5
            }}>
              צלילים
            </Text>

            <UICard 
              variant="blur"
              padding="none"
              style={{ marginBottom: DesignTokens.spacing.lg }}
            >
            {/* צליל לחדשות */}
            <TouchableOpacity
              onPress={() => setShowNewsSoundPicker(!showNewsSoundPicker)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingTop: DesignTokens.spacing.md,
                paddingBottom: DesignTokens.spacing.sm,
                paddingHorizontal: DesignTokens.spacing.md,
              }}
            >
              <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              <View style={{ flex: 1, marginLeft: DesignTokens.spacing.sm, marginRight: DesignTokens.spacing.sm }}>
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.base,
                  fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                  color: DesignTokens.colors.text.primary,
                  marginBottom: DesignTokens.spacing.xs,
                  textAlign: 'right'
                }}>
                  צליל לחדשות
                </Text>
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.sm,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'right'
                }}>
                  {SOUND_OPTIONS.find(opt => opt.value === settings.newsSound)?.label || 'ברירת מחדל'}
                </Text>
              </View>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: DesignTokens.borderRadius.md,
                backgroundColor: `${DesignTokens.colors.primary.main}1A`,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Newspaper size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            </TouchableOpacity>
            
            {showNewsSoundPicker && (
              <View style={{
                paddingHorizontal: DesignTokens.spacing.md,
                paddingBottom: DesignTokens.spacing.sm,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.15)',
              }}>
                {SOUND_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      handleSoundChange('newsSound', option.value);
                      setShowNewsSoundPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: DesignTokens.spacing.sm,
                      paddingHorizontal: DesignTokens.spacing.sm,
                      borderRadius: DesignTokens.borderRadius.md,
                      backgroundColor: settings.newsSound === option.value ? `${DesignTokens.colors.primary.main}1A` : 'transparent',
                    }}
                  >
                    <Text style={{
                      flex: 1,
                      fontSize: DesignTokens.typography.fontSize.sm,
                      fontWeight: settings.newsSound === option.value 
                        ? DesignTokens.typography.fontWeight.semibold as any
                        : DesignTokens.typography.fontWeight.normal as any,
                      color: settings.newsSound === option.value ? DesignTokens.colors.primary.main : DesignTokens.colors.text.primary,
                      textAlign: 'right'
                    }}>
                      {option.label}
                    </Text>
                    {settings.newsSound === option.value && (
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: DesignTokens.colors.primary.main,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: 8
                      }}>
                        <View style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: DesignTokens.colors.background.primary
                        }} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            
            <View style={{
              height: 1,
              backgroundColor: 'rgba(255, 255, 255, 0.15)',
              marginHorizontal: DesignTokens.spacing.md,
            }} />
            
            {/* צליל להקלטה */}
            <TouchableOpacity
              onPress={() => setShowRecordingSoundPicker(!showRecordingSoundPicker)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingTop: DesignTokens.spacing.sm,
                paddingBottom: DesignTokens.spacing.md,
                paddingHorizontal: DesignTokens.spacing.md,
              }}
            >
              <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />
              <View style={{ flex: 1, marginLeft: DesignTokens.spacing.sm, marginRight: DesignTokens.spacing.sm }}>
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.base,
                  fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                  color: DesignTokens.colors.text.primary,
                  marginBottom: DesignTokens.spacing.xs,
                  textAlign: 'right'
                }}>
                  צליל להקלטה
                </Text>
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.sm,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'right'
                }}>
                  {SOUND_OPTIONS.find(opt => opt.value === settings.recordingSound)?.label || 'ברירת מחדל'}
                </Text>
              </View>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: DesignTokens.borderRadius.md,
                backgroundColor: `${DesignTokens.colors.primary.main}1A`,
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Mic size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            </TouchableOpacity>
            
            {showRecordingSoundPicker && (
              <View style={{
                paddingHorizontal: DesignTokens.spacing.md,
                paddingBottom: DesignTokens.spacing.md,
                borderTopWidth: 1,
                borderTopColor: 'rgba(255, 255, 255, 0.15)',
              }}>
                {SOUND_OPTIONS.map((option) => (
                  <TouchableOpacity
                    key={option.value}
                    onPress={() => {
                      handleSoundChange('recordingSound', option.value);
                      setShowRecordingSoundPicker(false);
                    }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: DesignTokens.spacing.sm,
                      paddingHorizontal: DesignTokens.spacing.sm,
                      borderRadius: DesignTokens.borderRadius.md,
                      backgroundColor: settings.recordingSound === option.value ? `${DesignTokens.colors.primary.main}1A` : 'transparent',
                    }}
                  >
                    <Text style={{
                      flex: 1,
                      fontSize: DesignTokens.typography.fontSize.sm,
                      fontWeight: settings.recordingSound === option.value 
                        ? DesignTokens.typography.fontWeight.semibold as any
                        : DesignTokens.typography.fontWeight.normal as any,
                      color: settings.recordingSound === option.value ? DesignTokens.colors.primary.main : DesignTokens.colors.text.primary,
                      textAlign: 'right'
                    }}>
                      {option.label}
                    </Text>
                    {settings.recordingSound === option.value && (
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        backgroundColor: DesignTokens.colors.primary.main,
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginLeft: DesignTokens.spacing.xs
                      }}>
                        <View style={{
                          width: 8,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: DesignTokens.colors.background.primary
                        }} />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}
            </UICard>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
