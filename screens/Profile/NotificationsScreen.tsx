import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Switch,
  Alert,
  Image
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Bell, 
  ArrowLeft,
  Volume2,
  Smartphone,
  Moon,
  Sun
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import GradientHeader from '../../components/GradientHeader';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettings {
  pushNotifications: boolean;
  sound: boolean;
  vibration: boolean;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
}

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    pushNotifications: true,
    sound: true,
    vibration: true,
    quietHours: false,
    quietStart: '22:00',
    quietEnd: '08:00'
  });
  const [loading, setLoading] = useState(true);

  console.log('🚀 NotificationsScreen: Component loaded');
  console.log('🔍 NotificationsScreen: User:', user?.id);
  console.log('🔍 NotificationsScreen: Loading:', loading);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      console.log('Loading notification settings...');
      
      if (!user) {
        console.log('❌ No user found in NotificationsScreen');
        setLoading(false);
        return;
      }
      
      console.log('✅ User found in NotificationsScreen:', user.id);
      
      const savedSettings = await AsyncStorage.getItem('notification_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
        console.log('✅ Notification settings loaded:', JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('❌ Error loading notification settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
      console.log('✅ Notification settings saved:', newSettings);
    } catch (error) {
      console.error('❌ Error saving notification settings:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את ההגדרות');
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const renderSettingItem = (
    title: string,
    subtitle: string,
    key: keyof NotificationSettings,
    icon: React.ReactNode,
    color: string = '#00E654'
  ) => (
    <LinearGradient
      colors={['#252525', '#1E1E1E']}
      style={{
        borderRadius: 16,
        marginBottom: 16,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 6,
      }}
    >
      <Pressable
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          borderRadius: 16,
          padding: 20,
          borderWidth: 1,
          borderColor: '#333333',
        }}
      >
      <View style={{ flex: 1, marginRight: 16 }}>
        <Text style={{
          color: '#FFFFFF',
          fontSize: 17,
          fontWeight: '500',
          marginBottom: 6,
          letterSpacing: 0.3,
          textAlign: 'right'
        }}>
          {title}
        </Text>
        <Text style={{
          color: '#B0B0B0',
          fontSize: 15,
          fontWeight: '400',
          lineHeight: 20,
          textAlign: 'right'
        }}>
          {subtitle}
        </Text>
      </View>
      
      <View style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: color,
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 20,
        shadowColor: color,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
      }}>
        {icon}
      </View>
    </Pressable>
    </LinearGradient>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#181818', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18 }}>טוען הגדרות...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#181818' }}>
      {/* רקע חלק לשיפור ביצועים */}
      <View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#181818',
      }} />

      <GradientHeader 
        title="התראות"
        onBack={() => navigation.goBack()}
      />

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 16 }}
        showsVerticalScrollIndicator={false}
      >
      {/* Push Notifications */}
        <LinearGradient
          colors={['#252525', '#1E1E1E']}
          style={{
            borderRadius: 16,
          marginBottom: 16,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View style={{
            borderRadius: 16,
          padding: 16,
            borderWidth: 1,
            borderColor: '#333333',
          }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{
                color: '#FFFFFF',
              fontSize: 17,
                fontWeight: '600',
                marginBottom: 6,
                textAlign: 'right'
              }}>
                התראות Push
              </Text>
              <Text style={{
                color: '#B0B0B0',
              fontSize: 14,
                textAlign: 'right'
              }}>
                קבל התראות על הודעות ופעילות חדשה
              </Text>
            </View>
            
            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#00E654', alignItems: 'center', justifyContent: 'center', marginLeft: 16 }}>
              <Bell size={18} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <Switch
              value={settings.pushNotifications}
              onValueChange={() => handleToggle('pushNotifications')}
              trackColor={{ false: '#333333', true: '#00E654' }}
              thumbColor={settings.pushNotifications ? '#FFFFFF' : '#888888'}
            />
          </View>
          </View>
        </LinearGradient>

        {/* Sound */}
        {renderSettingItem(
          'צלילים',
          'התראות קוליות',
          'sound',
          <Volume2 size={20} color="#FFFFFF" />,
          '#3B82F6'
        )}

        {/* Vibration */}
        {renderSettingItem(
          'רטט',
          'רטט בהתראות',
          'vibration',
          <Smartphone size={20} color="#FFFFFF" />,
          '#8B5CF6'
        )}

        {/* Quiet Hours */}
        <LinearGradient
          colors={['#252525', '#1E1E1E']}
          style={{
            borderRadius: 16,
            marginBottom: 24,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.15,
            shadowRadius: 12,
            elevation: 6,
          }}
        >
          <View style={{
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#333333',
          }}>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1, marginRight: 16 }}>
              <Text style={{
                color: '#FFFFFF',
                fontSize: 18,
                fontWeight: '600',
                marginBottom: 6,
                textAlign: 'right'
              }}>
                שעות שקטות
              </Text>
              <Text style={{
                color: '#B0B0B0',
                fontSize: 15,
                textAlign: 'right'
              }}>
                {settings.quietStart} - {settings.quietEnd}
              </Text>
            </View>
            
            <View style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: '#F59E0B',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 20,
            }}>
              <Moon size={20} color="#FFFFFF" />
            </View>
          </View>
          
          <View style={{ marginTop: 16, alignItems: 'flex-end' }}>
            <Switch
              value={settings.quietHours}
              onValueChange={() => handleToggle('quietHours')}
              trackColor={{ false: '#333333', true: '#F59E0B' }}
              thumbColor={settings.quietHours ? '#FFFFFF' : '#888888'}
            />
          </View>
          </View>
        </LinearGradient>

        {/* Tips Card */}
        <LinearGradient
          colors={['#1A2332', '#0F1419']}
          style={{
            borderRadius: 16,
            padding: 20,
            borderWidth: 1,
            borderColor: '#2D3748',
            shadowColor: '#F59E0B',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
            elevation: 4,
          }}
        >
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12 }}>
            <Sun size={20} color="#F59E0B" style={{ marginLeft: 12 }} />
            <Text style={{
              color: '#FFFFFF',
              fontSize: 18,
              fontWeight: '600',
              textAlign: 'right'
            }}>
              טיפים
            </Text>
          </View>
          <Text style={{
            color: '#B0B0B0',
            fontSize: 15,
            lineHeight: 22,
            textAlign: 'right'
          }}>
            • שעות שקטות יעזרו לך לישון טוב יותר{'\n'}
            • התראות Push מומלצות להודעות חשובות{'\n'}
            • רטט עובד גם כשהטלפון בשקט
          </Text>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}