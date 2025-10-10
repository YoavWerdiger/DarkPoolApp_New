import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Switch,
  Alert,
  TouchableOpacity
} from 'react-native';
import { 
  Bell, 
  Volume2,
  Smartphone,
  X
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface NotificationSettings {
  notifications: boolean;
  sound: boolean;
  vibration: boolean;
  messageNotifications: boolean;
}

export default function NotificationsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<NotificationSettings>({
    notifications: true,
    sound: true,
    vibration: true,
    messageNotifications: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      if (!user) {
        setLoading(false);
        return;
      }
      
      const savedSettings = await AsyncStorage.getItem('notification_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error loading notification settings:', error);
      setLoading(false);
    }
  };

  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem('notification_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert('שגיאה', 'לא ניתן לשמור את ההגדרות');
    }
  };

  const handleToggle = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  const notificationOptions = [
    {
      id: 'notifications',
      title: 'התראות',
      subtitle: 'התראות כלליות',
      icon: Bell,
      key: 'notifications' as keyof NotificationSettings
    },
    {
      id: 'messageNotifications',
      title: 'התראות הודעות',
      subtitle: 'הודעות בצ\'אט',
      icon: Bell,
      key: 'messageNotifications' as keyof NotificationSettings
    },
    {
      id: 'sound',
      title: 'צלילים',
      subtitle: 'צלילי התראות',
      icon: Volume2,
      key: 'sound' as keyof NotificationSettings
    },
    {
      id: 'vibration',
      title: 'רטט',
      subtitle: 'רטט בהתראות',
      icon: Smartphone,
      key: 'vibration' as keyof NotificationSettings
    }
  ];

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#666', fontSize: 16 }}>טוען...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      {/* Header */}
      <View style={{
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#1E1E1E',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <X size={24} color="#666" strokeWidth={2} />
        </TouchableOpacity>
        
        <Text style={{ 
          color: '#FFFFFF', 
          fontSize: 18, 
          fontWeight: '600'
        }}>
          התראות
        </Text>
        
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingVertical: 24, paddingHorizontal: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{
          backgroundColor: '#1A1A1A',
          borderRadius: 12,
          borderWidth: 1,
          borderColor: '#2A2A2A',
          overflow: 'hidden'
        }}>
          {notificationOptions.map((option, index) => (
            <View
              key={option.id}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 20,
                flexDirection: 'row',
                alignItems: 'center',
                height: 64,
                borderBottomWidth: index < notificationOptions.length - 1 ? 1 : 0,
                borderBottomColor: '#2A2A2A'
              }}
            >
              <View style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#252525',
                alignItems: 'center',
                justifyContent: 'center',
                marginRight: 16
              }}>
                <option.icon size={20} color="#666" strokeWidth={2} />
              </View>
              
              <View style={{ flex: 1 }}>
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 16, 
                  fontWeight: '500',
                  marginBottom: 2,
                  textAlign: 'right',
                  writingDirection: 'rtl'
                }}>
                  {option.title}
                </Text>
                <Text style={{ 
                  color: '#666', 
                  fontSize: 13,
                  textAlign: 'right',
                  writingDirection: 'rtl'
                }}>
                  {option.subtitle}
                </Text>
              </View>
              
              <View style={{ marginLeft: 16 }}>
                <Switch
                  value={settings[option.key]}
                  onValueChange={() => handleToggle(option.key)}
                  trackColor={{ false: '#2A2A2A', true: '#00E654' }}
                  thumbColor={settings[option.key] ? '#FFFFFF' : '#4A4A4A'}
                  ios_backgroundColor="#2A2A2A"
                />
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}
