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
  Bell, 
  ArrowLeft,
  Volume2,
  Smartphone,
  MessageSquare,
  Newspaper,
  TrendingUp,
  Calendar
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettings {
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
  messageNotifications: boolean;
  newsNotifications: boolean;
  earningsNotifications: boolean;
  economicCalendarNotifications: boolean;
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
  const [settings, setSettings] = useState<NotificationSettings>({
    notifications: true,
    sound: true,
    vibration: true,
    messageNotifications: true,
    newsNotifications: true,
    earningsNotifications: true,
    economicCalendarNotifications: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('notificationSettings');
      if (saved) {
        setSettings(JSON.parse(saved));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setLoading(false);
    }
  };

  const handleToggle = async (key: keyof NotificationSettings) => {
    const newSettings = {
      ...settings,
      [key]: !settings[key]
    };
    
    setSettings(newSettings);
    
    try {
      await AsyncStorage.setItem('notificationSettings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
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
      title: 'צלילים',
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
      <SafeAreaView style={{ flex: 1, backgroundColor: '#121212' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00E654" />
          <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 16 }}>טוען הגדרות...</Text>
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
          התראות
        </Text>
        </View>
      </SafeAreaView>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {/* System Notifications Section */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: theme.textSecondary,
            marginBottom: 12,
            textAlign: 'right',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            התראות מערכת
          </Text>

          <View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 24
          }}>
            {systemNotificationOptions.map((option, index) => (
              <View
                key={option.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderBottomWidth: index < systemNotificationOptions.length - 1 ? 1 : 0,
                  borderBottomColor: theme.border
                }}
              >
                {/* Switch - שמאל */}
                <Switch
                  value={settings[option.key]}
                  onValueChange={() => handleToggle(option.key)}
                  trackColor={{ false: theme.switchTrackOff, true: '#00E654' }}
                  thumbColor={settings[option.key] ? '#ffffff' : theme.switchThumbOff}
                  ios_backgroundColor={theme.switchTrackOff}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />

                {/* Text */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.textPrimary,
                    marginBottom: 4,
                    textAlign: 'right'
                  }}>
                    {option.title}
                  </Text>
                  <Text style={{
                    fontSize: 13,
                    color: theme.textTertiary,
                    textAlign: 'right'
                  }}>
                    {option.subtitle}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: 'rgba(5, 209, 87, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <option.icon size={22} color="#00E654" strokeWidth={2} />
                </View>
              </View>
            ))}
          </View>

          {/* News Notifications Section */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: theme.textSecondary,
            marginBottom: 12,
            textAlign: 'right',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            התראות חדשות
          </Text>

          <View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            overflow: 'hidden'
          }}>
            {newsNotificationOptions.map((option, index) => (
              <View
                key={option.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 16,
                  borderBottomWidth: index < newsNotificationOptions.length - 1 ? 1 : 0,
                  borderBottomColor: theme.border
                }}
              >
                {/* Switch - שמאל */}
                <Switch
                  value={settings[option.key]}
                  onValueChange={() => handleToggle(option.key)}
                  trackColor={{ false: theme.switchTrackOff, true: '#00E654' }}
                  thumbColor={settings[option.key] ? '#ffffff' : theme.switchThumbOff}
                  ios_backgroundColor={theme.switchTrackOff}
                  style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                />

                {/* Text */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.textPrimary,
                    marginBottom: 4,
                    textAlign: 'right'
                  }}>
                    {option.title}
                  </Text>
                  <Text style={{
                    fontSize: 13,
                    color: theme.textTertiary,
                    textAlign: 'right'
                  }}>
                    {option.subtitle}
                  </Text>
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: 10,
                  backgroundColor: 'rgba(5, 209, 87, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <option.icon size={22} color="#00E654" strokeWidth={2} />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
