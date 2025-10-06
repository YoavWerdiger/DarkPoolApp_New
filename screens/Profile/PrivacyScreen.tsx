import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft, Shield, Lock, Eye, EyeOff, UserCheck, UserX, Key, Download, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface PrivacyScreenProps {
  navigation: any;
}

export default function PrivacyScreen({ navigation }: PrivacyScreenProps) {
  const [privacySettings, setPrivacySettings] = useState({
    profileVisibility: 'friends', // 'public', 'friends', 'private'
    onlineStatus: true,
    lastSeen: true,
    readReceipts: true,
    twoFactorAuth: false,
  });

  const handleChangeSetting = (key: string, value: any) => {
    setPrivacySettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const privacyOptions = [
    {
      title: 'נתוני חשבון',
      subtitle: 'מידע אישי ופרטי התחברות',
      icon: 'person-outline',
      type: 'account_data',
      color: '#00E654'
    },
    {
      title: 'הרשאות אפליקציה',
      subtitle: 'ניהול הרשאות גישה למידע',
      icon: 'shield-checkmark-outline',
      type: 'permissions',
      color: '#00E654'
    },
    {
      title: 'אבטחת חשבון',
      subtitle: 'אימות דו-שלבי, סיסמאות, מפתחות',
      icon: 'key-outline',
      type: 'security',
      color: '#00E654'
    },
    {
      title: 'קבלות קריאה',
      subtitle: 'הצג מתי קראת הודעות',
      icon: 'checkmark-done-outline',
      key: 'readReceipts',
      type: 'boolean',
      color: '#00E654'
    },
    {
      title: 'אימות דו-שלבי',
      subtitle: 'אבטחה נוספת לחשבון',
      icon: 'shield-checkmark-outline',
      key: 'twoFactorAuth',
      type: 'boolean',
      color: '#00E654'
    }
  ];

  const securityActions = [
    {
      title: 'שינוי סיסמה',
      subtitle: 'עדכן את הסיסמה שלך',
      icon: 'key-outline',
      action: () => Alert.alert('שינוי סיסמה', 'פתיחת דף שינוי סיסמה...'),
      color: '#00E654'
    },
    {
      title: 'מחיקת נתוני התחברות',
      subtitle: 'מחק פרטי התחברות שמורים מהמכשיר',
      icon: 'log-out-outline',
      action: () => Alert.alert('מחיקת נתוני התחברות', 'האם אתה בטוח שברצונך למחוק את נתוני ההתחברות השמורים?', [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: clearSavedCredentials }
      ]),
      color: '#F59E0B'
    },
    {
      title: 'ייצוא נתונים',
      subtitle: 'הורד העתק של הנתונים שלך',
      icon: 'download-outline',
      action: () => Alert.alert('ייצוא נתונים', 'התחלת תהליך ייצוא...'),
      color: '#00E654'
    },
    {
      title: 'מחיקת חשבון',
      subtitle: 'מחק את החשבון לצמיתות',
      icon: 'trash-outline',
      action: () => {
        Alert.alert(
          'מחיקת חשבון',
          'האם אתה בטוח שברצונך למחוק את החשבון? פעולה זו לא ניתנת לביטול.',
          [
            { text: 'ביטול', style: 'cancel' },
            { text: 'מחק', style: 'destructive', onPress: () => Alert.alert('מחיקה', 'חשבון נמחק') }
          ]
        );
      },
      color: '#DC2626'
    }
  ];

  const handleSaveSettings = () => {
    Alert.alert('הצלחה', 'ההגדרות נשמרו בהצלחה!');
    navigation.goBack();
  };

  const clearSavedCredentials = async () => {
    try {
      await AsyncStorage.removeItem('saved_email');
      await AsyncStorage.removeItem('saved_password');
      await AsyncStorage.removeItem('remember_me');
      Alert.alert('הצלחה', 'נתוני התחברות נמחקו בהצלחה!');
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה במחיקת הנתונים');
    }
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
            פרטיות ואבטחה
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
        {/* כרטיס פרטיות */}
        <View style={{ padding: 20, marginBottom: 20 }}>
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.08)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.06)', 'rgba(0, 230, 84, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 20,
              borderRadius: 16,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.15)'
            }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 }}>
              <Shield size={24} color="#00E654" strokeWidth={2} style={{ marginLeft: 12 }} />
              <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
                הגדרות פרטיות
              </Text>
            </View>
            
            <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl', marginBottom: 16 }}>
              שלוט במי יכול לראות את המידע שלך
            </Text>
          </LinearGradient>
        </View>

        {/* הגדרות פרטיות */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          {privacyOptions.map((setting, index) => (
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
                
                {/* תוכן */}
                <View style={{ flex: 1 }}>
                  <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                    {setting.title}
                  </Text>
                  <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                    {setting.subtitle}
                  </Text>
                  
                  {/* אפשרויות או מתג */}
                  {setting.options ? (
                    <View style={{ flexDirection: 'row-reverse', marginTop: 8 }}>
                      {setting.options.map((option, optionIndex) => (
                        <Pressable
                          key={optionIndex}
                          onPress={() => handleChangeSetting(setting.key, option.value)}
                          style={{
                            backgroundColor: privacySettings[setting.key as keyof typeof privacySettings] === option.value ? '#00E654' : '#333',
                            paddingHorizontal: 12,
                            paddingVertical: 6,
                            borderRadius: 8,
                            marginLeft: 8
                          }}
                        >
                          <Text style={{ 
                            color: privacySettings[setting.key as keyof typeof privacySettings] === option.value ? '#000' : '#fff',
                            fontSize: 12,
                            writingDirection: 'rtl'
                          }}>
                            {option.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleChangeSetting(setting.key, !privacySettings[setting.key as keyof typeof privacySettings])}
                      style={{
                        backgroundColor: privacySettings[setting.key as keyof typeof privacySettings] ? '#00E654' : '#666',
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 8,
                        alignSelf: 'flex-start',
                        marginTop: 8
                      }}
                    >
                      <Text style={{ 
                        color: privacySettings[setting.key as keyof typeof privacySettings] ? '#000' : '#fff',
                        fontSize: 12,
                        writingDirection: 'rtl'
                      }}>
                        {privacySettings[setting.key as keyof typeof privacySettings] ? 'מופעל' : 'מכובה'}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </LinearGradient>
            </View>
          ))}
        </View>

        {/* פעולות אבטחה */}
        <View style={{ paddingHorizontal: 20, marginBottom: 20 }}>
          <View style={{ marginBottom: 16 }}>
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', writingDirection: 'rtl' }}>
              פעולות אבטחה
            </Text>
          </View>
          
          {securityActions.map((action, index) => (
            <View key={index} style={{ marginBottom: 12 }}>
              <Pressable
                onPress={action.action}
                style={({ pressed }) => ({
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                  opacity: pressed ? 0.8 : 1
                })}
              >
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
                    borderColor: action.color === '#DC2626' ? 'rgba(220, 38, 38, 0.2)' : 'rgba(0, 230, 84, 0.1)',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.1,
                    shadowRadius: 4,
                    elevation: 2
                  }}
                >
                  {/* אייקון עם גרדיאנט */}
                  <LinearGradient
                    colors={action.color === '#DC2626' ? ['#DC2626', '#B91C1C'] : ['#00E654', '#00D04B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 16,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginLeft: 16,
                      shadowColor: action.color,
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.3,
                      shadowRadius: 4,
                      elevation: 4
                    }}
                  >
                    <Ionicons name={action.icon as any} size={24} color="#000" />
                  </LinearGradient>
                  
                  {/* טקסט */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 4, writingDirection: 'rtl' }}>
                      {action.title}
                    </Text>
                    <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl' }}>
                      {action.subtitle}
                    </Text>
                  </View>
                </LinearGradient>
              </Pressable>
            </View>
          ))}
        </View>

        {/* הוראות אבטחה */}
        <View style={{ padding: 20, marginTop: 20 }}>
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.06)', 'rgba(0, 230, 84, 0.02)', 'rgba(0, 230, 84, 0.04)', 'rgba(0, 230, 84, 0.01)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              padding: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: 'rgba(0, 230, 84, 0.12)'
            }}
          >
            <Text style={{ color: '#00E654', fontSize: 14, fontWeight: '600', marginBottom: 8, writingDirection: 'rtl' }}>
              🔒 טיפי אבטחה:
            </Text>
            <Text style={{ color: '#999', fontSize: 14, writingDirection: 'rtl', lineHeight: 20 }}>
              • השתמש בסיסמה חזקה וייחודית{'\n'}
              • הפעל אימות דו-שלבי{'\n'}
              • אל תשתף פרטים אישיים עם זרים{'\n'}
              • בדוק את הגדרות הפרטיות שלך באופן קבוע
            </Text>
          </LinearGradient>
        </View>
      </ScrollView>
    </View>
  );
}