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
import { DesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../lib/supabase';
import { Users } from 'lucide-react-native';

interface NotificationSettings {
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
  messageNotifications: boolean;
  newsNotifications: boolean;
  earningsNotifications: boolean;
  economicCalendarNotifications: boolean;
  newsSound: boolean;
  communitySound: boolean;
  groupNotifications: Record<string, boolean>;
}

interface NotificationOption {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  key: keyof NotificationSettings;
}

interface Channel {
  id: string;
  name: string;
  image_url?: string;
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
    economicCalendarNotifications: true,
    newsSound: true,
    communitySound: true,
    groupNotifications: {}
  });
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
    loadChannels();
  }, [user]);

  const loadChannels = async () => {
    try {
      if (!user) return;
      
      // שלוף את כל הקבוצות שהמשתמש חבר בהן
      const { data: memberRows } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      if (memberRows && memberRows.length > 0) {
        const channelIds = memberRows.map(row => row.channel_id);
        const { data: channelsData } = await supabase
          .from('channels')
          .select('id, name, image_url')
          .in('id', channelIds)
          .order('name');
        
        setChannels(channelsData || []);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const saved = await AsyncStorage.getItem('notificationSettings');
      if (saved) {
        const parsed = JSON.parse(saved);
        setSettings({
          ...parsed,
          groupNotifications: parsed.groupNotifications || {},
          newsSound: parsed.newsSound !== undefined ? parsed.newsSound : true,
          communitySound: parsed.communitySound !== undefined ? parsed.communitySound : true
        });
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

  const handleGroupToggle = async (channelId: string) => {
    const newGroupNotifications = {
      ...settings.groupNotifications,
      [channelId]: !settings.groupNotifications[channelId]
    };
    
    const newSettings = {
      ...settings,
      groupNotifications: newGroupNotifications
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
      <SafeAreaView style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
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
                  trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                  thumbColor={settings[option.key] ? DesignTokens.colors.text.primary : theme.switchThumbOff}
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
                  <option.icon size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
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
            overflow: 'hidden',
            marginBottom: 24
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
                  trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                  thumbColor={settings[option.key] ? DesignTokens.colors.text.primary : theme.switchThumbOff}
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
                  <option.icon size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                </View>
              </View>
            ))}
          </View>

          {/* Sounds Section */}
          <Text style={{
            fontSize: 14,
            fontWeight: '600',
            color: theme.textSecondary,
            marginBottom: 12,
            textAlign: 'right',
            textTransform: 'uppercase',
            letterSpacing: 0.5
          }}>
            צלילים
          </Text>

          <View style={{
            backgroundColor: theme.cardBackground,
            borderRadius: 16,
            overflow: 'hidden',
            marginBottom: 24
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16,
              borderBottomWidth: 1,
              borderBottomColor: theme.border
            }}>
              <Switch
                value={settings.newsSound}
                onValueChange={() => handleToggle('newsSound')}
                trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                thumbColor={settings.newsSound ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                ios_backgroundColor={theme.switchTrackOff}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: 4,
                  textAlign: 'right'
                }}>
                  צליל לחדשות
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.textTertiary,
                  textAlign: 'right'
                }}>
                  צליל נפרד להתראות חדשות
                </Text>
              </View>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(5, 209, 87, 0.1)',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Newspaper size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            </View>

            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 16
            }}>
              <Switch
                value={settings.communitySound}
                onValueChange={() => handleToggle('communitySound')}
                trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                thumbColor={settings.communitySound ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                ios_backgroundColor={theme.switchTrackOff}
                style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
              />
              <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                <Text style={{
                  fontSize: 16,
                  fontWeight: '600',
                  color: theme.textPrimary,
                  marginBottom: 4,
                  textAlign: 'right'
                }}>
                  צליל לקהילה
                </Text>
                <Text style={{
                  fontSize: 13,
                  color: theme.textTertiary,
                  textAlign: 'right'
                }}>
                  צליל נפרד להתראות קהילה
                </Text>
              </View>
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                backgroundColor: 'rgba(5, 209, 87, 0.1)',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <Users size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              </View>
            </View>
          </View>

          {/* Group Notifications Section */}
          {channels.length > 0 && (
            <>
              <Text style={{
                fontSize: 14,
                fontWeight: '600',
                color: theme.textSecondary,
                marginBottom: 12,
                textAlign: 'right',
                textTransform: 'uppercase',
                letterSpacing: 0.5
              }}>
                התראות קבוצות
              </Text>

              <View style={{
                backgroundColor: theme.cardBackground,
                borderRadius: 16,
                overflow: 'hidden'
              }}>
                {channels.map((channel, index) => (
                  <View
                    key={channel.id}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingVertical: 16,
                      paddingHorizontal: 16,
                      borderBottomWidth: index < channels.length - 1 ? 1 : 0,
                      borderBottomColor: theme.border
                    }}
                  >
                    <Switch
                      value={settings.groupNotifications[channel.id] !== false}
                      onValueChange={() => handleGroupToggle(channel.id)}
                      trackColor={{ false: theme.switchTrackOff, true: DesignTokens.colors.primary.main }}
                      thumbColor={settings.groupNotifications[channel.id] !== false ? DesignTokens.colors.text.primary : theme.switchThumbOff}
                      ios_backgroundColor={theme.switchTrackOff}
                      style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
                    />
                    <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                      <Text style={{
                        fontSize: 16,
                        fontWeight: '600',
                        color: theme.textPrimary,
                        marginBottom: 4,
                        textAlign: 'right'
                      }}>
                        {channel.name}
                      </Text>
                      <Text style={{
                        fontSize: 13,
                        color: theme.textTertiary,
                        textAlign: 'right'
                      }}>
                        התראות מהקבוצה
                      </Text>
                    </View>
                    <View style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      backgroundColor: 'rgba(5, 209, 87, 0.1)',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <MessageSquare size={22} color={DesignTokens.colors.primary.main} strokeWidth={2} />
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
