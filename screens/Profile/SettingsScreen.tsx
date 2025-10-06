import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Switch, 
  Alert,
  Animated,
  TouchableOpacity
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  Globe, 
  Bell, 
  Moon, 
  Shield, 
  Lock, 
  Trash2,
  LogOut,
  ChevronRight,
  Sun,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  MessageSquare,
  Eye,
  EyeOff,
  Download,
  Smartphone,
  Monitor,
  Zap,
  ZapOff,
  Database,
  Cloud,
  CloudOff,
  Camera,
  Image,
  FileText,
  Settings as SettingsIcon,
  HelpCircle,
  Info,
  UserCheck,
  UserX,
  Clock,
  Calendar
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';

interface SettingItem {
  id: string;
  title: string;
  subtitle: string;
  icon: any;
  type: 'switch' | 'action' | 'navigation';
  value?: boolean;
  onPress?: () => void;
  onToggle?: (value: boolean) => void;
  danger?: boolean;
}

export default function SettingsScreen({ navigation }: any) {
  const { user, signOut } = useAuth();
  const [settings, setSettings] = useState({
    language: 'he',
    notifications: true,
    sound: true,
    darkMode: true,
    wifiOnly: false,
    autoSync: true,
    biometricAuth: false,
    dataBackup: true,
    // הגדרות צאט
    readReceipts: true,
    typingIndicator: true,
    messagePreview: true,
    autoDownload: true,
    // הגדרות מדיה
    imageQuality: 'high',
    videoQuality: 'medium',
    autoPlay: false,
    // הגדרות פרטיות
    showOnlineStatus: true,
    showLastSeen: true,
    allowMentions: true,
    allowDirectMessages: true,
    // הגדרות ביצועים
    lowPowerMode: false,
    cacheSize: 'medium',
    autoClearCache: true
  });

  const [isLoading, setIsLoading] = useState(true);
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(30);
  const scaleAnim = new Animated.Value(0.95);

  useEffect(() => {
    // אנימציה של כניסה
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // טעינת הגדרות שמורות
    loadSettings().finally(() => {
      setIsLoading(false);
    });
  }, [user]);

  const loadSettings = async () => {
    try {
      console.log('Loading settings in SettingsScreen...');
      
      if (!user) {
        console.log('❌ No user found in SettingsScreen');
        return;
      }
      
      console.log('✅ User found in SettingsScreen:', user.id);
      
      const savedSettings = await AsyncStorage.getItem('user_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('❌ Error loading settings in SettingsScreen:', error);
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

  const handleToggle = (key: string, value: boolean | string) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    saveSettings(newSettings);
    
    // אנימציה קלה של שינוי
    Animated.sequence([
      Animated.timing(scaleAnim, {
        toValue: 0.98,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handleLogout = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'התנתק', style: 'destructive', onPress: async () => {
          try {
            await supabase.auth.signOut();
            // נמחק את ההגדרות השמורות
            await AsyncStorage.removeItem('user_settings');
            await AsyncStorage.removeItem('saved_credentials');
            console.log('User logged out successfully');
            // חזרה למסך ההתחברות
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }],
            });
          } catch (error) {
            console.error('Error logging out:', error);
            Alert.alert('שגיאה', 'לא ניתן להתנתק כרגע');
          }
        }}
      ]
    );
  };

  const handleClearData = async () => {
    Alert.alert(
      'מחיקת נתונים',
      'פעולה זו תמחק את כל הנתונים המקומיים. האם אתה בטוח?',
      [
        { text: 'ביטול', style: 'cancel' },
        { text: 'מחק', style: 'destructive', onPress: async () => {
          try {
            // נמחק את כל הנתונים המקומיים
            await AsyncStorage.clear();
            console.log('All local data cleared');
            Alert.alert('הצלחה', 'כל הנתונים המקומיים נמחקו');
          } catch (error) {
            console.error('Error clearing data:', error);
            Alert.alert('שגיאה', 'לא ניתן למחוק את הנתונים כרגע');
          }
        }}
      ]
    );
  };

  const settingSections: { title: string; items: SettingItem[] }[] = [
    {
      title: 'הגדרות כלליות',
      items: [
        {
          id: 'language',
          title: 'שפה',
          subtitle: settings.language === 'he' ? 'עברית' : 'English',
          icon: Globe,
          type: 'navigation',
          onPress: () => {
            Alert.alert('שפה', 'בחר שפה', [
              { text: 'עברית', onPress: () => handleToggle('language', true) },
              { text: 'English', onPress: () => handleToggle('language', false) }
            ]);
          }
        },
        {
          id: 'notifications',
          title: 'התראות',
          subtitle: 'קבל התראות על הודעות חדשות',
          icon: Bell,
          type: 'switch',
          value: settings.notifications,
          onToggle: (value) => handleToggle('notifications', value)
        },
        {
          id: 'sound',
          title: 'צלילים',
          subtitle: 'הפעל צלילי התראות',
          icon: settings.sound ? Volume2 : VolumeX,
          type: 'switch',
          value: settings.sound,
          onToggle: (value) => handleToggle('sound', value)
        },
        {
          id: 'darkMode',
          title: 'מצב כהה',
          subtitle: 'עיצוב כהה של האפליקציה',
          icon: settings.darkMode ? Moon : Sun,
          type: 'switch',
          value: settings.darkMode,
          onToggle: (value) => handleToggle('darkMode', value)
        }
      ]
    },
    {
      title: 'הגדרות רשת',
      items: [
        {
          id: 'wifiOnly',
          title: 'WiFi בלבד',
          subtitle: 'טען תוכן רק ב-WiFi',
          icon: settings.wifiOnly ? Wifi : WifiOff,
          type: 'switch',
          value: settings.wifiOnly,
          onToggle: (value) => handleToggle('wifiOnly', value)
        },
        {
          id: 'autoSync',
          title: 'סנכרון אוטומטי',
          subtitle: 'סנכרן נתונים אוטומטית',
          icon: Shield,
          type: 'switch',
          value: settings.autoSync,
          onToggle: (value) => handleToggle('autoSync', value)
        }
      ]
    },
    {
      title: 'אבטחה ופרטיות',
      items: [
        {
          id: 'biometricAuth',
          title: 'אימות ביומטרי',
          subtitle: 'השתמש בטביעת אצבע או זיהוי פנים',
          icon: Lock,
          type: 'switch',
          value: settings.biometricAuth,
          onToggle: (value) => handleToggle('biometricAuth', value)
        },
        {
          id: 'dataBackup',
          title: 'גיבוי נתונים',
          subtitle: 'גבה נתונים אוטומטית לענן',
          icon: Shield,
          type: 'switch',
          value: settings.dataBackup,
          onToggle: (value) => handleToggle('dataBackup', value)
        }
      ]
    },
    {
      title: 'הגדרות צאט',
      items: [
        {
          id: 'readReceipts',
          title: 'אישורי קריאה',
          subtitle: 'הצג אישורי קריאה להודעות',
          icon: Eye,
          type: 'switch',
          value: settings.readReceipts,
          onToggle: (value) => handleToggle('readReceipts', value)
        },
        {
          id: 'typingIndicator',
          title: 'אינדיקטור הקלדה',
          subtitle: 'הצג כשמישהו מקליד',
          icon: MessageSquare,
          type: 'switch',
          value: settings.typingIndicator,
          onToggle: (value) => handleToggle('typingIndicator', value)
        },
        {
          id: 'messagePreview',
          title: 'תצוגה מקדימה',
          subtitle: 'הצג תצוגה מקדימה של הודעות',
          icon: Eye,
          type: 'switch',
          value: settings.messagePreview,
          onToggle: (value) => handleToggle('messagePreview', value)
        },
        {
          id: 'autoDownload',
          title: 'הורדה אוטומטית',
          subtitle: 'הורד קבצים אוטומטית',
          icon: Download,
          type: 'switch',
          value: settings.autoDownload,
          onToggle: (value) => handleToggle('autoDownload', value)
        }
      ]
    },
    {
      title: 'הגדרות מדיה',
      items: [
        {
          id: 'imageQuality',
          title: 'איכות תמונות',
          subtitle: settings.imageQuality === 'high' ? 'גבוהה' : settings.imageQuality === 'medium' ? 'בינונית' : 'נמוכה',
          icon: Image,
          type: 'navigation',
          onPress: () => {
            Alert.alert('איכות תמונות', 'בחר איכות', [
              { text: 'נמוכה', onPress: () => handleToggle('imageQuality', 'low') },
              { text: 'בינונית', onPress: () => handleToggle('imageQuality', 'medium') },
              { text: 'גבוהה', onPress: () => handleToggle('imageQuality', 'high') }
            ]);
          }
        },
        {
          id: 'videoQuality',
          title: 'איכות וידאו',
          subtitle: settings.videoQuality === 'high' ? 'גבוהה' : settings.videoQuality === 'medium' ? 'בינונית' : 'נמוכה',
          icon: Camera,
          type: 'navigation',
          onPress: () => {
            Alert.alert('איכות וידאו', 'בחר איכות', [
              { text: 'נמוכה', onPress: () => handleToggle('videoQuality', 'low') },
              { text: 'בינונית', onPress: () => handleToggle('videoQuality', 'medium') },
              { text: 'גבוהה', onPress: () => handleToggle('videoQuality', 'high') }
            ]);
          }
        },
        {
          id: 'autoPlay',
          title: 'השמעה אוטומטית',
          subtitle: 'השמע וידאו אוטומטית',
          icon: settings.autoPlay ? Volume2 : VolumeX,
          type: 'switch',
          value: settings.autoPlay,
          onToggle: (value) => handleToggle('autoPlay', value)
        }
      ]
    },
    {
      title: 'פרטיות מתקדמת',
      items: [
        {
          id: 'showOnlineStatus',
          title: 'הצג סטטוס מקוון',
          subtitle: 'הצג מתי אתה מקוון',
          icon: settings.showOnlineStatus ? Eye : EyeOff,
          type: 'switch',
          value: settings.showOnlineStatus,
          onToggle: (value) => handleToggle('showOnlineStatus', value)
        },
        {
          id: 'showLastSeen',
          title: 'הצג נראה לאחרונה',
          subtitle: 'הצג מתי נראת לאחרונה',
          icon: Clock,
          type: 'switch',
          value: settings.showLastSeen,
          onToggle: (value) => handleToggle('showLastSeen', value)
        },
        {
          id: 'allowMentions',
          title: 'אפשר אזכורים',
          subtitle: 'אפשר למשתמשים להזכיר אותך',
          icon: settings.allowMentions ? UserCheck : UserX,
          type: 'switch',
          value: settings.allowMentions,
          onToggle: (value) => handleToggle('allowMentions', value)
        },
        {
          id: 'allowDirectMessages',
          title: 'אפשר הודעות ישירות',
          subtitle: 'אפשר למשתמשים לשלוח לך הודעות',
          icon: MessageSquare,
          type: 'switch',
          value: settings.allowDirectMessages,
          onToggle: (value) => handleToggle('allowDirectMessages', value)
        }
      ]
    },
    {
      title: 'ביצועים',
      items: [
        {
          id: 'lowPowerMode',
          title: 'מצב חסכון בסוללה',
          subtitle: 'חסוך בסוללה על חשבון ביצועים',
          icon: settings.lowPowerMode ? ZapOff : Zap,
          type: 'switch',
          value: settings.lowPowerMode,
          onToggle: (value) => handleToggle('lowPowerMode', value)
        },
        {
          id: 'cacheSize',
          title: 'גודל מטמון',
          subtitle: settings.cacheSize === 'small' ? 'קטן' : settings.cacheSize === 'medium' ? 'בינוני' : 'גדול',
          icon: Database,
          type: 'navigation',
          onPress: () => {
            Alert.alert('גודל מטמון', 'בחר גודל', [
              { text: 'קטן', onPress: () => handleToggle('cacheSize', 'small') },
              { text: 'בינוני', onPress: () => handleToggle('cacheSize', 'medium') },
              { text: 'גדול', onPress: () => handleToggle('cacheSize', 'large') }
            ]);
          }
        },
        {
          id: 'autoClearCache',
          title: 'ניקוי מטמון אוטומטי',
          subtitle: 'נקה מטמון אוטומטית',
          icon: Trash2,
          type: 'switch',
          value: settings.autoClearCache,
          onToggle: (value) => handleToggle('autoClearCache', value)
        }
      ]
    },
    {
      title: 'פעולות מסוכנות',
      items: [
        {
          id: 'clearData',
          title: 'מחק נתונים מקומיים',
          subtitle: 'מחק את כל הנתונים השמורים במכשיר',
          icon: Trash2,
          type: 'action',
          danger: true,
          onPress: handleClearData
        },
        {
          id: 'logout',
          title: 'התנתק מהחשבון',
          subtitle: 'התנתק מכל המכשירים',
          icon: LogOut,
          type: 'action',
          danger: true,
          onPress: handleLogout
        }
      ]
    }
  ];

  const renderSettingItem = (item: SettingItem) => (
    <Animated.View
      key={item.id}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        marginBottom: 12
      }}
    >
      <TouchableOpacity
        onPress={item.onPress}
        disabled={item.type === 'switch'}
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3
        }}
      >
        <LinearGradient
          colors={item.danger ? ['#2A1A1A', '#1A0A0A'] : ['#252525', '#1E1E1E']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: 20,
            borderRadius: 16,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: item.danger ? '#DC2626' : '#333333'
          }}
        >
          {/* אייקון */}
          <View style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: item.danger ? '#DC2626' : '#333333',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 16
          }}>
            <item.icon size={20} color="#FFFFFF" strokeWidth={2} />
          </View>
          
          {/* תוכן */}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: item.danger ? '#DC2626' : '#FFFFFF', 
              fontSize: 17, 
              fontWeight: '500', 
              marginBottom: 4,
              writingDirection: 'rtl'
            }}>
              {item.title}
            </Text>
            <Text style={{ 
              color: '#B0B0B0', 
              fontSize: 14, 
              fontWeight: '400',
              writingDirection: 'rtl'
            }}>
              {item.subtitle}
            </Text>
          </View>
          
          {/* Switch או חץ */}
          {item.type === 'switch' ? (
            <Switch
              value={item.value}
              onValueChange={item.onToggle}
              trackColor={{ false: '#666666', true: '#00E654' }}
              thumbColor={item.value ? '#FFFFFF' : '#CCCCCC'}
              ios_backgroundColor="#666666"
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          ) : (
            <ChevronRight size={18} color={item.danger ? '#DC2626' : '#666666'} />
          )}
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const renderSection = (section: { title: string; items: SettingItem[] }, index: number) => (
    <Animated.View
      key={index}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        marginBottom: 32
      }}
    >
      <Text style={{ 
        color: '#FFFFFF', 
        fontSize: 20, 
        fontWeight: '600', 
        marginBottom: 16,
        writingDirection: 'rtl'
      }}>
        {section.title}
      </Text>
      
      <View style={{
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 4,
        borderWidth: 1,
        borderColor: '#2A2A2A'
      }}>
        {section.items.map(renderSettingItem)}
      </View>
    </Animated.View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18, writingDirection: 'rtl' }}>
          טוען הגדרות...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <LinearGradient
          colors={['#00E65420', '#00E65410', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 60,
            paddingBottom: 30,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 230, 84, 0.2)'
          }}
        >
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 24, 
            fontWeight: '700',
            writingDirection: 'rtl'
          }}>
            הגדרות
          </Text>
        </LinearGradient>

        <View style={{ paddingHorizontal: 24, paddingTop: 30 }}>
          {/* כל הסעיפים */}
          {settingSections.map(renderSection)}

          {/* מידע על האפליקציה */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              marginTop: 20,
              padding: 20,
              borderRadius: 16,
              backgroundColor: '#1A1A1A',
              borderWidth: 1,
              borderColor: '#333333',
              alignItems: 'center'
            }}
          >
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 18, 
              fontWeight: '600', 
              marginBottom: 8,
              writingDirection: 'rtl'
            }}>
              DarkPool App
            </Text>
            <Text style={{ 
              color: '#B0B0B0', 
              fontSize: 14, 
              fontWeight: '400',
              writingDirection: 'rtl'
            }}>
              גרסה 1.0.0 • Build 2024.1
            </Text>
            <Text style={{ 
              color: '#666666', 
              fontSize: 12, 
              fontWeight: '400',
              marginTop: 4,
              writingDirection: 'rtl'
            }}>
              © 2024 DarkPool Team. כל הזכויות שמורות.
            </Text>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
