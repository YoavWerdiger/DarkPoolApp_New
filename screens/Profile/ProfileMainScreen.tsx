import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Image, 
  Dimensions,
  Animated,
  TouchableOpacity,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  User, 
  Edit3, 
  BookOpen, 
  MessageSquare, 
  Settings, 
  CreditCard,
  ChevronRight,
  Star,
  TrendingUp,
  Users,
  LogOut
} from 'lucide-react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

const { width } = Dimensions.get('window');

// הסרנו סטטיסטיקות מזויפות - נתונים אמיתיים יבואו מהשרת

interface QuickAction {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  onPress: () => void;
}

export default function ProfileMainScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const [imageLoading, setImageLoading] = useState(true);
  const [imageError, setImageError] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  const getMembershipText = (): string => {
    try {
      console.log('🔍 User data for membership:', {
        created_at: (user as any)?.created_at,
        createdAt: (user as any)?.createdAt,
        user_metadata: (user as any)?.user_metadata,
        raw_user: user
      });
      
      const created = (user as any)?.created_at || (user as any)?.createdAt;
      console.log('📅 Created date found:', created);
      
      if (!created) {
        console.log('❌ No created date found');
        return 'חבר בקהילה חדש';
      }
      
      const createdDate = new Date(created);
      console.log('📅 Parsed date:', createdDate);
      
      if (isNaN(createdDate.getTime())) {
        console.log('❌ Invalid date');
        return 'חבר בקהילה חדש';
      }
      
      const day = String(createdDate.getDate()).padStart(2, '0');
      const month = String(createdDate.getMonth() + 1).padStart(2, '0');
      const year = createdDate.getFullYear();
      const result = `חבר בקהילה מאז ${day}/${month}/${year}`;
      
      console.log('✅ Membership text:', result);
      return result;
    } catch (error) {
      console.log('❌ Error in getMembershipText:', error);
      return 'חבר בקהילה חדש';
    }
  };

  const getPlanText = (): string => {
    const raw = (user as any)?.account_type || (user as any)?.plan || (user as any)?.track_id;
    const map: Record<string, string> = {
      free: 'חינם',
      basic: 'בסיס',
      pro: 'פרו',
      premium: 'פרימיום',
      vip: 'VIP',
      trial: 'ניסיון',
    };
    if (!raw) return 'מסלול: חינם';
    const key = String(raw).toLowerCase();
    const friendly = map[key] || raw;
    return `מסלול: ${friendly}`;
  };

  useEffect(() => {
    // אנימציה של כניסה
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // אפס את מצב התמונה כשהמשתמש משתנה
  useEffect(() => {
    if (user?.profile_picture) {
      setImageLoading(true);
      setImageError(false);
    }
  }, [user?.profile_picture]);

  const handleSignOut = async () => {
    Alert.alert(
      'התנתקות',
      'האם אתה בטוח שברצונך להתנתק?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'התנתק ומחק נתונים',
          style: 'destructive',
          onPress: async () => {
            const { error } = await signOut(false); // מחק נתונים
            if (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות');
            }
          },
        },
        {
          text: 'התנתק ושמור נתונים',
          style: 'default',
          onPress: async () => {
            const { error } = await signOut(true); // שמור נתונים
            if (error) {
              Alert.alert('שגיאה', 'שגיאה בהתנתקות');
            } else {
              Alert.alert('התנתקות', 'נתוני ההתחברות נשמרו להפעלה הבאה');
            }
          },
        },
      ]
    );
  };

  const quickActions: QuickAction[] = [
    {
      id: 'edit',
      title: 'ערוך פרופיל',
      subtitle: 'עדכן פרטים אישיים',
      icon: 'person',
      color: '#00E654',
      onPress: () => navigation.navigate('EditProfile')
    },
    {
      id: 'notifications',
      title: 'התראות',
      subtitle: 'הגדרות התראות',
      icon: 'notifications',
      color: '#F59E0B',
      onPress: () => navigation.navigate('Notifications')
    },
    {
      id: 'settings',
      title: 'הגדרות',
      subtitle: 'הגדרות אפליקציה',
      icon: 'settings',
      color: '#F59E0B',
      onPress: () => navigation.navigate('Settings')
    },
    {
      id: 'subscription',
      title: 'מסלול ותשלום',
      subtitle: 'ניהול מנוי',
      icon: 'card',
      color: '#EF4444',
      onPress: () => navigation.navigate('Subscription')
    }
  ];

  // הסרנו renderStatCard - לא נדרש יותר

  const renderQuickAction = (action: QuickAction, index: number) => (
    <Animated.View
      key={action.id}
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <TouchableOpacity
        onPress={action.onPress}
        style={{
          marginBottom: 16,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
          elevation: 3
        }}
      >
        <LinearGradient
          colors={['#252525', '#1E1E1E', '#181818']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            padding: 20,
            borderRadius: 20,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#333333'
          }}
        >
          {/* אייקון */}
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 15,
            backgroundColor: action.color,
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 20,
            shadowColor: action.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 4
          }}>
            <Ionicons name={action.icon as any} size={24} color="#FFFFFF" />
          </View>
          
          {/* תוכן */}
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 18, 
              fontWeight: '600', 
              marginBottom: 4,
              writingDirection: 'rtl'
            }}>
              {action.title}
            </Text>
            <Text style={{ 
              color: '#B0B0B0', 
              fontSize: 14, 
              fontWeight: '400',
              writingDirection: 'rtl'
            }}>
              {action.subtitle}
            </Text>
          </View>
          
          {/* חץ */}
          <View style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: '#333333',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <ChevronRight size={18} color="#888888" />
          </View>
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  console.log('🔍 ProfileMainScreen render:', { 
    isLoading, 
    userId: user?.id,
    userEmail: user?.email,
    userFullName: user?.full_name,
    userCreatedAt: (user as any)?.created_at,
    userCreatedAtAlt: (user as any)?.createdAt,
    userMetadata: (user as any)?.user_metadata,
    rawUser: user
  });

  if (isLoading) {
    console.log('⏳ ProfileMainScreen: Still loading...');
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center' }}>
        <Text style={{ color: '#FFFFFF', fontSize: 18 }}>טוען נתונים...</Text>
      </View>
    );
  }

  // אם אין משתמש, נציג מסך עם הודעה
  if (!user) {
    console.log('❌ ProfileMainScreen: No user found');
    return (
      <View style={{ flex: 1, backgroundColor: '#121212', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '600', marginBottom: 16, textAlign: 'center' }}>
          לא מחובר
        </Text>
        <Text style={{ color: '#B0B0B0', fontSize: 16, textAlign: 'center', lineHeight: 24 }}>
          יש להתחבר לאפליקציה כדי לראות את הפרופיל
        </Text>
      </View>
    );
  }

  console.log('✅ ProfileMainScreen: Rendering with user:', user.id);

  return (
    <View style={{ flex: 1, backgroundColor: '#121212' }}>
      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header עם גרדיאנט */}
        <LinearGradient
          colors={['#00E65420', '#00E65410', 'transparent', '#00E65405']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: 48,
            paddingBottom: 24,
            paddingHorizontal: 24,
            alignItems: 'center',
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(0, 230, 84, 0.2)'
          }}
        >
          {/* תמונת פרופיל אמיתית + Badge מחובר בסגנון וואטסאפ (ללא אפקט זום) */}
          <Animated.View
            style={{
              opacity: fadeAnim,
            }}
          >
            <View style={{ width: 100, height: 100, marginBottom: 20 }}>
              <LinearGradient
                colors={['#00E654', '#00D04B', '#00E654']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  width: 100,
                  height: 100,
                  borderRadius: 50,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: '#00E654',
                  shadowOffset: { width: 0, height: 6 },
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  elevation: 8
                }}
              >
                <View style={{
                  width: 92,
                  height: 92,
                  borderRadius: 46,
                  overflow: 'hidden',
                  backgroundColor: '#FFFFFF'
                }}>
                  {user?.profile_picture && !imageError ? (
                    <Image 
                      source={{ uri: user.profile_picture as any }} 
                      style={{ 
                        width: '100%', 
                        height: '100%',
                        resizeMode: 'cover'
                      }}
                      onError={() => {
                        console.log('❌ Error loading profile picture');
                        setImageError(true);
                        setImageLoading(false);
                      }}
                      onLoad={() => {
                        console.log('✅ Profile picture loaded successfully');
                        setImageLoading(false);
                        setImageError(false);
                      }}
                    />
                  ) : (
                    <View style={{ 
                      width: '100%', 
                      height: '100%', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: '#F0F0F0'
                    }}>
                      <User size={46} color="#666666" strokeWidth={2} />
                    </View>
                  )}
                </View>
              </LinearGradient>
              <View style={{
                position: 'absolute',
                bottom: 2,
                right: 2,
                width: 18,
                height: 18,
                borderRadius: 9,
                backgroundColor: '#25D366',
                borderWidth: 2,
                borderColor: 'rgba(0,0,0,0.6)'
              }} />
            </View>
          </Animated.View>

          {/* פרטי משתמש - שם ושתי שורות מידע אלגנטיות */}
          <Animated.View
            style={{
              opacity: fadeAnim,
              alignItems: 'center'
            }}
          >
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 28, 
              fontWeight: '700', 
              marginBottom: 0,
              writingDirection: 'rtl'
            }}>
              {user?.full_name || (user as any)?.display_name || user?.email?.split('@')[0] || 'משתמש'}
            </Text>
            <Text style={{
              color: '#B0B0B0',
              fontSize: 14,
              marginTop: 8,
              writingDirection: 'rtl'
            }}>
              {getMembershipText()}
            </Text>
            <Text style={{
              color: '#00E654',
              fontSize: 14,
              marginTop: 4,
              writingDirection: 'rtl'
            }}>
              {getPlanText()}
            </Text>
          </Animated.View>
        </LinearGradient>

        {/* הסרנו סטטיסטיקות מזויפות - נתונים אמיתיים יבואו מהשרת */}

        {/* קיצורי דרך */}
        <View style={{ paddingHorizontal: 24, paddingTop: 30 }}>
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 22, 
            fontWeight: '600', 
            marginBottom: 20,
            writingDirection: 'rtl'
          }}>
            קיצורי דרך
          </Text>
          
          {(() => {
            console.log('🎯 Rendering quickActions:', quickActions.length);
            return quickActions.length > 0 ? (
              quickActions.map((action, index) => {
                console.log(`🎯 Rendering action ${index}:`, action.title);
                return renderQuickAction(action, index);
              })
            ) : (
              <View style={{ padding: 20, alignItems: 'center' }}>
                <Text style={{ color: '#888', fontSize: 16 }}>אין קיצורי דרך זמינים</Text>
              </View>
            );
          })()}
        </View>

        {/* כפתור התנתקות */}
        <View style={{ paddingHorizontal: 24, marginTop: 40, marginBottom: 32 }}>
          <Animated.View
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }]
            }}
          >
            <Pressable
              onPress={handleSignOut}
              style={({ pressed }) => ({
                transform: [{ scale: pressed ? 0.99 : 1 }],
                opacity: pressed ? 0.95 : 1
              })}
            >
              <View style={{
                padding: 20,
                borderRadius: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: '#2A1A1A',
                borderWidth: 1,
                borderColor: '#DC2626',
                shadowColor: '#DC2626',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 12,
                elevation: 6
              }}>
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: '#DC2626',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 12
                }}>
                  <LogOut size={18} color="#FFFFFF" strokeWidth={2} />
                </View>
                <Text style={{ 
                  color: '#FFFFFF', 
                  fontSize: 17, 
                  fontWeight: '500',
                  textAlign: 'center',
                  writingDirection: 'rtl',
                  letterSpacing: 0.3
                }}>
                  התנתק מהחשבון
                </Text>
              </View>
            </Pressable>
          </Animated.View>
        </View>

        {/* גרסת אפליקציה */}
        <View style={{ alignItems: 'center', paddingTop: 20, paddingBottom: 20 }}>
          <Text style={{ color: '#666', fontSize: 12, writingDirection: 'rtl' }}>גרסה 1.0.0 • DarkPool App</Text>
        </View>
      </ScrollView>
    </View>
  );
}
