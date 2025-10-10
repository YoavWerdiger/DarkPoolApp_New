import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Switch, 
  Alert,
  TouchableOpacity,
  Pressable
} from 'react-native';
import { 
  Globe, 
  Bell, 
  Moon, 
  Volume2,
  Smartphone,
  LogOut,
  X,
  Trash2,
  ChevronRight
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';

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
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState({
    notifications: true,
    sound: true,
    vibration: true,
    darkMode: true,
    messageNotifications: true,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, [user]);

  const loadSettings = async () => {
    try {
      if (!user) {
        setIsLoading(false);
        return;
      }
      
      const savedSettings = await AsyncStorage.getItem('user_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading settings:', error);
      setIsLoading(false);
    }
  };

  const saveSettings = async (newSettings: typeof settings) => {
    try {
      await AsyncStorage.setItem('user_settings', JSON.stringify(newSettings));
      setSettings(newSettings);
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const handleToggle = (key: string, value: boolean) => {
    const newSettings = { ...settings, [key]: value };
    saveSettings(newSettings);
  };

  const handleLogout = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'התנתק', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await supabase.auth.signOut();
              await AsyncStorage.removeItem('user_settings');
              await AsyncStorage.removeItem('saved_credentials');
              navigation.reset({
                index: 0,
                routes: [{ name: 'Auth' }],
              });
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן להתנתק כרגע');
            }
          }
        }
      ]
    );
  };

  const handleClearData = async () => {
    Alert.alert(
      'מחיקת נתונים',
      'פעולה זו תמחק את כל הנתונים המקומיים',
      [
        { text: 'ביטול', style: 'cancel' },
        { 
          text: 'מחק', 
          style: 'destructive', 
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              Alert.alert('הצלחה', 'נתונים מקומיים נמחקו');
            } catch (error) {
              Alert.alert('שגיאה', 'לא ניתן למחוק');
            }
          }
        }
      ]
    );
  };

  const settingSections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'הגדרות כלליות',
      items: [
        {
          id: 'darkMode',
          title: 'מצב כהה',
          subtitle: 'עיצוב כהה',
          icon: Moon,
          type: 'switch',
          value: settings.darkMode,
          onToggle: (value) => handleToggle('darkMode', value)
        },
        {
          id: 'language',
          title: 'שפה',
          subtitle: 'עברית',
          icon: Globe,
          type: 'action',
          onPress: () => {
            Alert.alert('שפה', 'עדיין לא זמין');
          }
        }
      ]
    },
    {
      title: 'התראות',
      items: [
        {
          id: 'notifications',
          title: 'התראות',
          subtitle: 'התראות כלליות',
          icon: Bell,
          type: 'switch',
          value: settings.notifications,
          onToggle: (value) => handleToggle('notifications', value)
        },
        {
          id: 'messageNotifications',
          title: 'התראות הודעות',
          subtitle: 'הודעות בצ\'אט',
          icon: Bell,
          type: 'switch',
          value: settings.messageNotifications,
          onToggle: (value) => handleToggle('messageNotifications', value)
        },
        {
          id: 'sound',
          title: 'צלילים',
          subtitle: 'צלילי התראות',
          icon: Volume2,
          type: 'switch',
          value: settings.sound,
          onToggle: (value) => handleToggle('sound', value)
        },
        {
          id: 'vibration',
          title: 'רטט',
          subtitle: 'רטט בהתראות',
          icon: Smartphone,
          type: 'switch',
          value: settings.vibration,
          onToggle: (value) => handleToggle('vibration', value)
        }
      ]
    },
    {
      title: 'נתונים',
      items: [
        {
          id: 'clearData',
          title: 'מחק נתונים מקומיים',
          subtitle: 'מחק נתונים שמורים',
          icon: Trash2,
          type: 'action',
          danger: true,
          onPress: handleClearData
        }
      ]
    }
  ];

  if (isLoading) {
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
          הגדרות
        </Text>
        
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          {settingSections.map((section, sectionIndex) => (
            <View key={sectionIndex} style={{ marginBottom: 24 }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 18, 
                fontWeight: '600', 
                marginBottom: 16,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}>
                {section.title}
              </Text>
              
              <View style={{
                backgroundColor: '#181818',
                borderRadius: 16,
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.15)',
                overflow: 'hidden'
              }}>
                {section.items.map((item, index) => (
                  <Pressable
                    key={item.id}
                    onPress={item.onPress}
                    disabled={item.type === 'switch'}
                    style={({ pressed }) => ({
                      flexDirection: 'row', 
                      alignItems: 'center',
                      paddingHorizontal: 14,
                      paddingVertical: 12,
                      minHeight: 40,
                      backgroundColor: pressed ? '#2A2A2A' : '#181818',
                      borderBottomWidth: index < section.items.length - 1 ? 0.5 : 0,
                      borderBottomColor: 'rgba(255,255,255,0.08)'
                    })}
                  >
                    {/* אייקון */}
                    <View style={{ marginRight: 10, width: 20, alignItems: 'center' }}>
                      <item.icon size={20} color={item.danger ? '#DC2626' : '#FFFFFF'} strokeWidth={2} />
                    </View>
                    
                    {/* טקסט */}
                    <View style={{ flex: 1 }}>
                      <Text style={{ 
                        color: item.danger ? '#DC2626' : '#FFFFFF', 
                        fontSize: 15,
                        fontWeight: '400',
                        marginBottom: 2,
                        textAlign: 'right',
                        writingDirection: 'rtl'
                      }}>
                        {item.title}
                      </Text>
                      <Text style={{ 
                        color: '#888', 
                        fontSize: 13,
                        textAlign: 'right',
                        writingDirection: 'rtl'
                      }}>
                        {item.subtitle}
                      </Text>
                    </View>
                    
                    {/* Switch או Chevron */}
                    <View style={{ marginLeft: 16 }}>
                      {item.type === 'switch' ? (
                        <Switch
                          value={item.value}
                          onValueChange={item.onToggle}
                          trackColor={{ false: '#2A2A2A', true: '#00E654' }}
                          thumbColor={item.value ? '#FFFFFF' : '#4A4A4A'}
                          ios_backgroundColor="#2A2A2A"
                        />
                      ) : (
                        <ChevronRight size={18} color="#666" strokeWidth={2} />
                      )}
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          {/* App Info */}
          <View style={{
            marginTop: 20,
            padding: 16,
            borderRadius: 16,
            backgroundColor: '#181818',
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
            alignItems: 'center'
          }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 16, 
              fontWeight: '600', 
              marginBottom: 4
            }}>
              DarkPool App
            </Text>
            <Text style={{ 
              color: '#666', 
              fontSize: 13
            }}>
              גרסה 1.0.0
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
