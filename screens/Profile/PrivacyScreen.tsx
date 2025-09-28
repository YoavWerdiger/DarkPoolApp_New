import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Switch,
  Alert,
  TextInput 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft, Key, Ban, AlertTriangle, ChevronRight } from 'lucide-react-native';

interface PrivacyScreenProps {
  navigation: any;
}

export default function PrivacyScreen({ navigation }: PrivacyScreenProps) {
  const [privacy, setPrivacy] = useState({
    // נראות פרופיל
    profileVisibility: 'public', // public, friends, private
    showEmail: false,
    showPhone: false,
    showLastSeen: true,
    showOnlineStatus: true,
    
    // הודעות
    whoCanMessage: 'everyone', // everyone, friends, nobody
    whoCanAddToGroups: 'friends',
    readReceipts: true,
    typingIndicator: true,
    
    // תוכן
    whoCanSeeMyContent: 'friends',
    whoCanTagMe: 'friends',
    allowScreenshots: false,
    
    // חסימות
    blockedUsers: [],
    blockedKeywords: [],
    
    // אבטחה
    twoFactorAuth: false,
    loginAlerts: true,
    sessionTimeout: 30, // דקות
    biometricAuth: false,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // פונקציה לשינוי הגדרה
  const updateSetting = (key: string, value: any) => {
    setPrivacy(prev => ({ ...prev, [key]: value }));
  };

  // פונקציה לשמירת ההגדרות
  const handleSave = async () => {
    setIsLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('הצלחה', 'הגדרות הפרטיות נשמרו בהצלחה!');
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בשמירת ההגדרות');
    } finally {
      setIsLoading(false);
    }
  };

  // פונקציה לשינוי סיסמה
  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('שגיאה', 'הסיסמאות אינן תואמות');
      return;
    }
    
    if (passwordData.newPassword.length < 6) {
      Alert.alert('שגיאה', 'הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }

    try {
      setIsLoading(true);
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('הצלחה', 'הסיסמה שונתה בהצלחה!');
      setShowChangePassword(false);
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בשינוי הסיסמה');
    } finally {
      setIsLoading(false);
    }
  };

  // קומפוננט של פריט הגדרה עם switch
  const SettingSwitch = ({ title, subtitle, icon, iconColor, value, onToggle }: any) => (
    <View style={{
      backgroundColor: '#2A2A2A',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
    }}>
      <View style={{
        width: 40,
        height: 40,
        borderRadius: 10,
        backgroundColor: iconColor,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
      }}>
        <Ionicons name={icon} size={20} color="#fff" />
      </View>
      
      <View style={{ flex: 1 }}>
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
          {title}
        </Text>
        <Text style={{ color: '#999', fontSize: 13 }}>
          {subtitle}
        </Text>
      </View>
      
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#333', true: '#00E654' }}
        thumbColor={value ? '#fff' : '#666'}
        ios_backgroundColor="#333"
      />
    </View>
  );

  // קומפוננט של פריט הגדרה עם בחירה
  const SettingChoice = ({ title, subtitle, icon, iconColor, options, value, onSelect }: any) => (
    <View style={{
      backgroundColor: '#2A2A2A',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)'
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          backgroundColor: iconColor,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12
        }}>
          <Ionicons name={icon} size={20} color="#fff" />
        </View>
        
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
            {title}
          </Text>
          <Text style={{ color: '#999', fontSize: 13 }}>
            {subtitle}
          </Text>
        </View>
      </View>
      
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {options.map((option: any, index: number) => (
          <Pressable
            key={index}
            onPress={() => onSelect(option.value)}
            style={{
              flex: 1,
              backgroundColor: value === option.value ? '#00E654' : '#1A1A1A',
              padding: 8,
              borderRadius: 8,
              alignItems: 'center',
              marginHorizontal: 2
            }}
          >
            <Text style={{
              color: value === option.value ? '#000' : '#fff',
              fontSize: 12,
              fontWeight: value === option.value ? 'bold' : 'normal'
            }}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      {/* גרדיאנט רקע */}
      <LinearGradient
        colors={['rgba(0, 230, 84, 0.08)', 'rgba(0, 230, 84, 0.03)', 'rgba(0, 230, 84, 0.05)']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
      />
      
      {/* Header */}
      <View style={{
        backgroundColor: '#2A2A2A',
        paddingTop: 50,
        paddingBottom: 16,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)'
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Pressable
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#1A1A1A',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.2)'
            }}
          >
            <ArrowLeft size={20} color="#fff" strokeWidth={2} />
          </Pressable>
          
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold' }}>
            פרטיות ואבטחה
          </Text>
          
          <Pressable
            onPress={handleSave}
            disabled={isLoading}
            style={{
              backgroundColor: isLoading ? '#666' : '#00E654',
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 20,
              opacity: isLoading ? 0.7 : 1
            }}
          >
            <Text style={{ color: isLoading ? '#ccc' : '#000', fontSize: 14, fontWeight: 'bold' }}>
              {isLoading ? 'שומר...' : 'שמור'}
            </Text>
          </Pressable>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* נראות פרופיל */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            נראות פרופיל
          </Text>
          
          <SettingChoice
            title="מי יכול לראות את הפרופיל שלי"
            subtitle="קבע מי יכול לראות את המידע האישי שלך"
            icon="person-outline"
            iconColor="#4F46E5"
            value={privacy.profileVisibility}
            onSelect={(value: string) => updateSetting('profileVisibility', value)}
            options={[
              { label: 'כולם', value: 'public' },
              { label: 'חברים', value: 'friends' },
              { label: 'פרטי', value: 'private' }
            ]}
          />
          
          <SettingSwitch
            title="הצג כתובת אימייל"
            subtitle="אחרים יכולים לראות את האימייל שלך"
            icon="mail-outline"
            iconColor="#059669"
            value={privacy.showEmail}
            onToggle={(value: boolean) => updateSetting('showEmail', value)}
          />
          
          <SettingSwitch
            title="הצג מספר טלפון"
            subtitle="אחרים יכולים לראות את הטלפון שלך"
            icon="call-outline"
            iconColor="#DC2626"
            value={privacy.showPhone}
            onToggle={(value: boolean) => updateSetting('showPhone', value)}
          />
          
          <SettingSwitch
            title="הצג זמן חיבור אחרון"
            subtitle="אחרים יכולים לראות מתי היית מחובר"
            icon="time-outline"
            iconColor="#7C3AED"
            value={privacy.showLastSeen}
            onToggle={(value: boolean) => updateSetting('showLastSeen', value)}
          />
          
          <SettingSwitch
            title="הצג סטטוס מקוון"
            subtitle="אחרים יכולים לראות שאתה מחובר כעת"
            icon="radio-outline"
            iconColor="#EA580C"
            value={privacy.showOnlineStatus}
            onToggle={(value: boolean) => updateSetting('showOnlineStatus', value)}
          />
        </View>

        {/* הודעות */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            הודעות וצ'אטים
          </Text>
          
          <SettingChoice
            title="מי יכול לשלוח לי הודעות"
            subtitle="קבע מי יכול ליצור איתך צ'אט חדש"
            icon="chatbubble-outline"
            iconColor="#0891B2"
            value={privacy.whoCanMessage}
            onSelect={(value: string) => updateSetting('whoCanMessage', value)}
            options={[
              { label: 'כולם', value: 'everyone' },
              { label: 'חברים', value: 'friends' },
              { label: 'אף אחד', value: 'nobody' }
            ]}
          />
          
          <SettingChoice
            title="מי יכול להוסיף אותי לקבוצות"
            subtitle="קבע מי יכול להוסיף אותך לקבוצות"
            icon="people-outline"
            iconColor="#65A30D"
            value={privacy.whoCanAddToGroups}
            onSelect={(value: string) => updateSetting('whoCanAddToGroups', value)}
            options={[
              { label: 'כולם', value: 'everyone' },
              { label: 'חברים', value: 'friends' },
              { label: 'אף אחד', value: 'nobody' }
            ]}
          />
          
          <SettingSwitch
            title="אישורי קריאה"
            subtitle="אחרים יכולים לראות שקראת את ההודעות"
            icon="checkmark-done-outline"
            iconColor="#F59E0B"
            value={privacy.readReceipts}
            onToggle={(value: boolean) => updateSetting('readReceipts', value)}
          />
          
          <SettingSwitch
            title="מחוון הקלדה"
            subtitle="אחרים יכולים לראות שאתה מקליד"
            icon="create-outline"
            iconColor="#8B5CF6"
            value={privacy.typingIndicator}
            onToggle={(value: boolean) => updateSetting('typingIndicator', value)}
          />
        </View>

        {/* אבטחה */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            אבטחה וגישה
          </Text>
          
          <SettingSwitch
            title="אימות דו-שלבי"
            subtitle="הגנה נוספת עם קוד SMS"
            icon="shield-checkmark-outline"
            iconColor="#DC2626"
            value={privacy.twoFactorAuth}
            onToggle={(value: boolean) => updateSetting('twoFactorAuth', value)}
          />
          
          <SettingSwitch
            title="התראות כניסה"
            subtitle="קבל התראה על כניסות חדשות"
            icon="log-in-outline"
            iconColor="#059669"
            value={privacy.loginAlerts}
            onToggle={(value: boolean) => updateSetting('loginAlerts', value)}
          />
          
          <SettingSwitch
            title="אימות ביומטרי"
            subtitle="כניסה עם טביעת אצבע או פנים"
            icon="finger-print-outline"
            iconColor="#6366F1"
            value={privacy.biometricAuth}
            onToggle={(value: boolean) => updateSetting('biometricAuth', value)}
          />

          {/* שינוי סיסמה */}
          <Pressable
            onPress={() => setShowChangePassword(!showChangePassword)}
            style={{
              backgroundColor: '#2A2A2A',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#F59E0B',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}>
              <Key size={20} color="#fff" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                שינוי סיסמה
              </Text>
              <Text style={{ color: '#999', fontSize: 13 }}>
                עדכן את סיסמת החשבון שלך
              </Text>
            </View>
            
            <Ionicons 
              name={showChangePassword ? "chevron-up" : "chevron-forward"} 
              size={20} 
              color="#666" 
            />
          </Pressable>

          {/* טופס שינוי סיסמה */}
          {showChangePassword && (
            <View style={{
              backgroundColor: '#1A1A1A',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}>
              <TextInput
                placeholder="סיסמה נוכחית"
                placeholderTextColor="#666"
                secureTextEntry
                value={passwordData.currentPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, currentPassword: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)'
                }}
              />
              
              <TextInput
                placeholder="סיסמה חדשה"
                placeholderTextColor="#666"
                secureTextEntry
                value={passwordData.newPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, newPassword: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)'
                }}
              />
              
              <TextInput
                placeholder="אישור סיסמה חדשה"
                placeholderTextColor="#666"
                secureTextEntry
                value={passwordData.confirmPassword}
                onChangeText={(text) => setPasswordData(prev => ({ ...prev, confirmPassword: text }))}
                style={{
                  backgroundColor: '#2A2A2A',
                  color: '#fff',
                  padding: 12,
                  borderRadius: 8,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.1)'
                }}
              />
              
              <Pressable
                onPress={handleChangePassword}
                disabled={isLoading}
                style={{
                  backgroundColor: '#00E654',
                  padding: 12,
                  borderRadius: 8,
                  alignItems: 'center',
                  opacity: isLoading ? 0.7 : 1
                }}
              >
                <Text style={{ color: '#000', fontSize: 14, fontWeight: 'bold' }}>
                  {isLoading ? 'משנה סיסמה...' : 'שנה סיסמה'}
                </Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* פעולות מתקדמות */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            פעולות מתקדמות
          </Text>
          
          <Pressable
            style={{
              backgroundColor: '#2A2A2A',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#DC2626',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}>
              <Ban size={20} color="#fff" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                משתמשים חסומים
              </Text>
              <Text style={{ color: '#999', fontSize: 13 }}>
                נהל רשימת משתמשים חסומים
              </Text>
            </View>
            
            <View style={{
              backgroundColor: '#DC2626',
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderRadius: 12
            }}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                {privacy.blockedUsers.length}
              </Text>
            </View>
          </Pressable>
          
          <Pressable
            style={{
              backgroundColor: '#2A2A2A',
              padding: 16,
              borderRadius: 12,
              marginBottom: 12,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)'
            }}
          >
            <View style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              backgroundColor: '#F59E0B',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 12
            }}>
              <AlertTriangle size={20} color="#fff" strokeWidth={2} />
            </View>
            
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 2 }}>
                מילות מפתח חסומות
              </Text>
              <Text style={{ color: '#999', fontSize: 13 }}>
                הודעות עם מילים אלה יסוננו
              </Text>
            </View>
            
            <ChevronRight size={20} color="#666" strokeWidth={2} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

