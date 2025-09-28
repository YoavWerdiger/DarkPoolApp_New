import React, { useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Switch,
  Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ArrowLeft } from 'lucide-react-native';

interface NotificationsScreenProps {
  navigation: any;
}

export default function NotificationsScreen({ navigation }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState({
    // הגדרות כלליות
    pushNotifications: true,
    emailNotifications: false,
    smsNotifications: false,
    
    // הודעות צ'אט
    newMessages: true,
    groupMessages: true,
    mentions: true,
    reactions: false,
    
    // למידה
    courseUpdates: true,
    newLessons: true,
    achievements: true,
    reminders: false,
    
    // מערכת
    systemUpdates: true,
    securityAlerts: true,
    maintenanceNotices: false,
    
    // הגדרות מתקדמות
    doNotDisturb: false,
    quietHours: false,
    vibration: true,
    sound: true,
    
    // זמני שקט
    quietStart: '22:00',
    quietEnd: '07:00',
  });

  const [isLoading, setIsLoading] = useState(false);

  // פונקציה לשינוי הגדרה
  const toggleSetting = (key: string, value: boolean) => {
    setNotifications(prev => ({ ...prev, [key]: value }));
  };

  // פונקציה לשמירת ההגדרות
  const handleSave = async () => {
    setIsLoading(true);
    try {
      // כאן תהיה הלוגיקה לשמירה בשרת
      await new Promise(resolve => setTimeout(resolve, 1000));
      Alert.alert('הצלחה', 'הגדרות ההתראות נשמרו בהצלחה!');
    } catch (error) {
      Alert.alert('שגיאה', 'אירעה שגיאה בשמירת ההגדרות');
    } finally {
      setIsLoading(false);
    }
  };

  // קומפוננט של פריט הגדרה
  const SettingItem = ({ 
    title, 
    subtitle, 
    icon, 
    iconColor, 
    value, 
    onToggle, 
    disabled = false 
  }: any) => (
    <View style={{
      backgroundColor: '#2A2A2A',
      padding: 16,
      borderRadius: 12,
      marginBottom: 12,
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: 'rgba(255,255,255,0.1)',
      opacity: disabled ? 0.6 : 1
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
        disabled={disabled}
        trackColor={{ false: '#333', true: '#00E654' }}
        thumbColor={value ? '#fff' : '#666'}
        ios_backgroundColor="#333"
      />
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
            התראות והודעות
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
        {/* הגדרות כלליות */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            הגדרות כלליות
          </Text>
          
          <SettingItem
            title="התראות פוש"
            subtitle="התראות על המסך הראשי"
            icon="notifications"
            iconColor="#4F46E5"
            value={notifications.pushNotifications}
            onToggle={(value: boolean) => toggleSetting('pushNotifications', value)}
          />
          
          <SettingItem
            title="התראות אימייל"
            subtitle="התראות לכתובת המייל"
            icon="mail"
            iconColor="#059669"
            value={notifications.emailNotifications}
            onToggle={(value: boolean) => toggleSetting('emailNotifications', value)}
          />
          
          <SettingItem
            title="הודעות SMS"
            subtitle="התראות בהודעות טקסט"
            icon="chatbubble"
            iconColor="#DC2626"
            value={notifications.smsNotifications}
            onToggle={(value: boolean) => toggleSetting('smsNotifications', value)}
          />
        </View>

        {/* הודעות צ'אט */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            הודעות צ'אט
          </Text>
          
          <SettingItem
            title="הודעות חדשות"
            subtitle="התראה על הודעות חדשות"
            icon="chatbubble-outline"
            iconColor="#7C3AED"
            value={notifications.newMessages}
            onToggle={(value: boolean) => toggleSetting('newMessages', value)}
            disabled={!notifications.pushNotifications}
          />
          
          <SettingItem
            title="הודעות קבוצה"
            subtitle="התראות מקבוצות"
            icon="people-outline"
            iconColor="#EA580C"
            value={notifications.groupMessages}
            onToggle={(value: boolean) => toggleSetting('groupMessages', value)}
            disabled={!notifications.pushNotifications}
          />
          
          <SettingItem
            title="אזכורים"
            subtitle="כשמזכירים אותך בהודעה"
            icon="at-outline"
            iconColor="#0891B2"
            value={notifications.mentions}
            onToggle={(value: boolean) => toggleSetting('mentions', value)}
            disabled={!notifications.pushNotifications}
          />
          
          <SettingItem
            title="תגובות"
            subtitle="תגובות על ההודעות שלך"
            icon="heart-outline"
            iconColor="#F59E0B"
            value={notifications.reactions}
            onToggle={(value: boolean) => toggleSetting('reactions', value)}
            disabled={!notifications.pushNotifications}
          />
        </View>

        {/* למידה */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            למידה וקורסים
          </Text>
          
          <SettingItem
            title="עדכוני קורסים"
            subtitle="עדכונים על הקורסים שלך"
            icon="school-outline"
            iconColor="#8B5CF6"
            value={notifications.courseUpdates}
            onToggle={(value: boolean) => toggleSetting('courseUpdates', value)}
            disabled={!notifications.pushNotifications}
          />
          
          <SettingItem
            title="שיעורים חדשים"
            subtitle="כשמתפרסמים שיעורים חדשים"
            icon="play-outline"
            iconColor="#10B981"
            value={notifications.newLessons}
            onToggle={(value: boolean) => toggleSetting('newLessons', value)}
            disabled={!notifications.pushNotifications}
          />
          
          <SettingItem
            title="הישגים"
            subtitle="כשאתה משיג יעדים חדשים"
            icon="trophy-outline"
            iconColor="#F59E0B"
            value={notifications.achievements}
            onToggle={(value: boolean) => toggleSetting('achievements', value)}
            disabled={!notifications.pushNotifications}
          />
          
          <SettingItem
            title="תזכורות למידה"
            subtitle="תזכורות יומיות ללמידה"
            icon="time-outline"
            iconColor="#06B6D4"
            value={notifications.reminders}
            onToggle={(value: boolean) => toggleSetting('reminders', value)}
            disabled={!notifications.pushNotifications}
          />
        </View>

        {/* הגדרות מערכת */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            הגדרות מערכת
          </Text>
          
          <SettingItem
            title="עדכוני מערכת"
            subtitle="עדכונים חשובים על האפליקציה"
            icon="system-outline"
            iconColor="#6366F1"
            value={notifications.systemUpdates}
            onToggle={(value: boolean) => toggleSetting('systemUpdates', value)}
          />
          
          <SettingItem
            title="התראות אבטחה"
            subtitle="התראות על פעילות חשודה"
            icon="shield-checkmark-outline"
            iconColor="#DC2626"
            value={notifications.securityAlerts}
            onToggle={(value: boolean) => toggleSetting('securityAlerts', value)}
          />
          
          <SettingItem
            title="הודעות תחזוקה"
            subtitle="הודעות על תחזוקת השרת"
            icon="construct-outline"
            iconColor="#65A30D"
            value={notifications.maintenanceNotices}
            onToggle={(value: boolean) => toggleSetting('maintenanceNotices', value)}
          />
        </View>

        {/* הגדרות מתקדמות */}
        <View style={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}>
          <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginBottom: 16 }}>
            הגדרות מתקדמות
          </Text>
          
          <SettingItem
            title="מצב שקט"
            subtitle="השתק את כל ההתראות"
            icon="moon-outline"
            iconColor="#6B7280"
            value={notifications.doNotDisturb}
            onToggle={(value: boolean) => toggleSetting('doNotDisturb', value)}
          />
          
          <SettingItem
            title="שעות שקט"
            subtitle="השתק התראות בשעות מסוימות"
            icon="time-outline"
            iconColor="#374151"
            value={notifications.quietHours}
            onToggle={(value: boolean) => toggleSetting('quietHours', value)}
            disabled={notifications.doNotDisturb}
          />
          
          <SettingItem
            title="רטט"
            subtitle="רטט עם התראות"
            icon="phone-portrait-outline"
            iconColor="#9CA3AF"
            value={notifications.vibration}
            onToggle={(value: boolean) => toggleSetting('vibration', value)}
            disabled={notifications.doNotDisturb}
          />
          
          <SettingItem
            title="צליל"
            subtitle="צליל עם התראות"
            icon="volume-high-outline"
            iconColor="#6B7280"
            value={notifications.sound}
            onToggle={(value: boolean) => toggleSetting('sound', value)}
            disabled={notifications.doNotDisturb}
          />
        </View>
      </ScrollView>
    </View>
  );
}

