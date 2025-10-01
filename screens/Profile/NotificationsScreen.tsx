import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Switch, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft, Bell, BellOff, Volume2, VolumeX, Smartphone, Wifi, WifiOff } from 'lucide-react-native';

interface NotificationsScreenProps {
  navigation: any;
}

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState({
    pushNotifications: true,
    messageNotifications: true,
    groupNotifications: true,
    soundEnabled: true,
    vibrationEnabled: true,
    wifiOnly: false,
  });

  const handleToggle = (key: string) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const notificationSettings = [
    {
      title: 'התראות פוש',
      subtitle: 'קבל התראות על הודעות חדשות',
      icon: 'notifications-outline',
      key: 'pushNotifications',
      color: '#00E654'
    },
    {
      title: 'התראות הודעות',
      subtitle: 'התראות על הודעות ישירות',
      icon: 'chatbubble-outline',
      key: 'messageNotifications',
      color: '#00E654'
    },
    {
      title: 'התראות קבוצות',
      subtitle: 'התראות על פעילות בקבוצות',
      icon: 'people-outline',
      key: 'groupNotifications',
      color: '#00E654'
    },
    {
      title: 'צלילים',
      subtitle: 'השמע צליל בהתראות',
      icon: 'volume-high-outline',
      key: 'soundEnabled',
      color: '#00E654'
    },
    {
      title: 'רטט',
      subtitle: 'רטט במכשיר בזמן התראות',
      icon: 'phone-portrait-outline',
      key: 'vibrationEnabled',
      color: '#00E654'
    },
    {
      title: 'רק ב-WiFi',
      subtitle: 'התראות רק כשמחובר ל-WiFi',
      icon: 'wifi-outline',
      key: 'wifiOnly',
      color: '#00E654'
    }
  ];

  const handleSaveSettings = () => {
    Alert.alert('הצלחה', 'ההגדרות נשמרו בהצלחה!');
    navigation.goBack();
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#181818' }}>
      {/* גרדיאנט רקע */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.05)', 'transparent', 'rgba(0, 230, 84, 0.03)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
      />
      
      {/* Header */}
      <View style={{
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 230, 84, 0.1)',
        backgroundColor: '#181818'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#181818',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
            התראות והודעות
          </Text>
          
          <Pressable
            onPress={handleSaveSettings}
            style={{
              backgroundColor: '#00E654',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20
            }}
          >
            <Text style={{ color: '#000', fontSize: 14, fontWeight: 'bold', writingDirection: 'rtl' }}>
              שמור
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* כרטיס הגדרות כללי */}
        <View style={{ padding: 20, marginBottom: 20 }}>
          <View style={{
            padding: 20,
            borderRadius: 16,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.1)',
            backgroundColor: 'rgba(0, 230, 84, 0.02)'
          }}>
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 }}>
              <Bell size={24} color="#00E654" strokeWidth={2} style={{ marginLeft: 12 }} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
                הגדרות התראות
              </Text>
            </View>
            
            <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl', marginBottom: 16 }}>
              התאם אישית את ההתראות שלך לפי הצרכים שלך
            </Text>

            {/* כפתור הפעל/כבה הכל */}
            <Pressable
              onPress={() => {
                const allEnabled = Object.values(notifications).every(v => v);
                setNotifications({
                  pushNotifications: !allEnabled,
                  messageNotifications: !allEnabled,
                  groupNotifications: !allEnabled,
                  soundEnabled: !allEnabled,
                  vibrationEnabled: !allEnabled,
                  wifiOnly: false,
                });
              }}
              style={{
                backgroundColor: '#181818',
                padding: 12,
                borderRadius: 12,
                flexDirection: 'row-reverse',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', writingDirection: 'rtl' }}>
                הפעל/כבה הכל
              </Text>
              <View style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: Object.values(notifications).every(v => v) ? '#00E654' : '#666',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {Object.values(notifications).every(v => v) ? (
                  <Bell size={14} color="#000" strokeWidth={2} />
                ) : (
                  <BellOff size={14} color="#000" strokeWidth={2} />
                )}
              </View>
            </Pressable>
          </View>
        </View>

        {/* רשימת הגדרות */}
        <View style={{ paddingHorizontal: 20 }}>
          {notificationSettings.map((setting, index) => (
            <View key={index} style={{ marginBottom: 16 }}>
              <LinearGradient
                colors={['#181818', '#1a1a1a']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 16,
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  borderWidth: 1,
                  borderColor: 'rgba(0, 230, 84, 0.1)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 2
                }}
              >
                {/* אייקון עם גרדיאנט */}
                <LinearGradient
                  colors={['#00E654', '#00D04B']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: 16,
                    shadowColor: '#00E654',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 4,
                    elevation: 4
                  }}
                >
                  <Ionicons name={setting.icon as any} size={24} color="#000" />
                </LinearGradient>
                
                {/* טקסט */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    {setting.title}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    {setting.subtitle}
                  </Text>
                </View>
                
                {/* מתג */}
                <Switch
                  value={notifications[setting.key as keyof typeof notifications]}
                  onValueChange={() => handleToggle(setting.key)}
                  trackColor={{ false: '#666', true: '#00E654' }}
                  thumbColor={notifications[setting.key as keyof typeof notifications] ? '#fff' : '#f4f3f4'}
                  style={{ transform: [{ scaleX: 1.2 }, { scaleY: 1.2 }] }}
                />
              </LinearGradient>
            </View>
          ))}
        </View>

        {/* הוראות נוספות */}
        <View style={{ padding: 20, marginTop: 20 }}>
          <View style={{
            padding: 16,
            borderRadius: 12,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.1)',
            backgroundColor: 'rgba(0, 230, 84, 0.02)'
          }}>
            <Text style={{ color: '#00E654', fontSize: 14, fontWeight: '600', marginBottom: 8, writingDirection: 'rtl' }}>
              💡 טיפ:
            </Text>
            <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl', lineHeight: 20 }}>
              ניתן להגדיר התראות מתקדמות יותר בהגדרות המכשיר שלך
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}