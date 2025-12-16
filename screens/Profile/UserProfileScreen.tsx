import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  Pressable, 
  Image, 
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  SafeAreaView,
  StyleSheet,
  Platform
} from 'react-native';
import { 
  User, 
  Settings, 
  ChevronLeft,
  Star,
  Bell,
  CreditCard,
  ArrowLeft,
  Edit3,
  LogOut,
  Shield,
  Info,
  MessageSquare
} from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { SafeAreaView as RNSafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  onPress: () => void;
}

export default function UserProfileScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const DesignTokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const mainTabsHeight = useMainTabsHeight();
  const [profileData, setProfileData] = useState<any>(null);

  useEffect(() => {
    if (user) {
      loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      if (!user) return;
      
      const { data } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();
      
      if (data) {
        setProfileData(data);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const mainMenuItems: MenuItem[] = [
    {
      id: 'edit',
      title: 'עריכת פרופיל',
      subtitle: 'עדכן את פרטיך האישיים',
      icon: Edit3,
      onPress: () => navigation.navigate('EditProfile')
    },
    {
      id: 'settings',
      title: 'הגדרות',
      subtitle: 'הגדרות אפליקציה כלליות',
      icon: Settings,
      onPress: () => navigation.navigate('Settings')
    },
    {
      id: 'notifications',
      title: 'התראות',
      subtitle: 'הגדרות התראות וצלילים',
      icon: Bell,
      onPress: () => navigation.navigate('Notifications')
    },
    {
      id: 'subscription',
      title: 'מנוי ומסלול',
      subtitle: 'ניהול מנוי ותשלומים',
      icon: CreditCard,
      onPress: () => navigation.navigate('SubscriptionPlans')
    },
    {
      id: 'rate',
      title: 'דרג אותנו',
      subtitle: 'שתף את החוויה שלך',
      icon: Star,
      onPress: () => {
        Alert.alert(
          'דרג אותנו',
          'איך תרצה לדרג אותנו?',
          [
            {
              text: 'דירוג אנונימי',
              onPress: () => {
                // פתיחת סקר אנונימי בגוגל פורמס
                const anonymousFormUrl = 'https://forms.gle/YOUR_ANONYMOUS_FORM_ID';
                // כאן צריך להוסיף קישור לסקר אנונימי
                Alert.alert('תודה!', 'הסקר האנונימי יפתח בקרוב');
              }
            },
            {
              text: 'דירוג לא אנונימי',
              onPress: () => {
                // פתיחת סקר לא אנונימי בגוגל פורמס
                const namedFormUrl = 'https://forms.gle/YOUR_NAMED_FORM_ID';
                // כאן צריך להוסיף קישור לסקר לא אנונימי
                Alert.alert('תודה!', 'הסקר יפתח בקרוב');
              }
            },
            {
              text: 'ביטול',
              style: 'cancel'
            }
          ]
        );
      }
    }
  ];

  const secondaryMenuItems: MenuItem[] = [
    {
      id: 'security',
      title: 'אבטחה',
      subtitle: 'סיסמה ואימות',
      icon: Shield,
      onPress: () => {
        Alert.alert('אבטחה', 'אבטחה - בקרוב!');
      }
    },
    {
      id: 'about',
      title: 'אודות',
      subtitle: 'מידע על האפליקציה',
      icon: Info,
      onPress: () => {
        Alert.alert('אודות', 'DarkPool App v1.0.0');
      }
    }
  ];

  if (isLoading) {
    return (
      <RNSafeAreaView style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: DesignTokens.typography.fontSize.base, 
            marginTop: DesignTokens.spacing.lg 
          }}>
            טוען פרופיל...
          </Text>
        </View>
      </RNSafeAreaView>
    );
  }

  if (!user) {
    return (
      <RNSafeAreaView style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: DesignTokens.spacing.xl }}>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: DesignTokens.typography.fontSize.xl, 
            fontWeight: DesignTokens.typography.fontWeight.semibold as any, 
            marginBottom: DesignTokens.spacing.sm 
          }}>
            לא מחובר
          </Text>
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: DesignTokens.typography.fontSize.base, 
            textAlign: 'center' 
          }}>
            יש להתחבר לאפליקציה
          </Text>
        </View>
      </RNSafeAreaView>
    );
  }

  const displayName = profileData?.full_name || user?.email?.split('@')[0] || 'משתמש';
  const email = user?.email || '';
  
  // Get member since date from user creation
  const getMemberSinceDate = () => {
    if (profileData?.created_at) {
      const date = new Date(profileData.created_at);
      return date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
    }
    return 'ינואר 2024';
  };

  return (
    <View style={{ flex: 1 }}>
      {/* רקע עם גרדיאנט ירוק כהה-שחור אנכי - אזור ירוק רחב יותר בגובה */}
      <LinearGradient
        colors={['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']}
        locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
          <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false}
          >
          {/* Profile Header Card - עם blur כמו MainTabs, צמוד למעלה, פינות תחתונות מעוגלות */}
          <UICard 
            variant="blur"
            padding="md"
            style={{
              marginHorizontal: 0,
              marginTop: 0,
              paddingTop: 10,
              paddingBottom: DesignTokens.spacing.md,
              borderTopLeftRadius: 0,
              borderTopRightRadius: 0,
              borderBottomLeftRadius: DesignTokens.borderRadius['2xl'],
              borderBottomRightRadius: DesignTokens.borderRadius['2xl'],
            }}
          >
          {/* Container עם פריסה מרכזית - תמונה במרכז, טקסט מתחת */}
          <View style={{
            alignItems: 'center',
          }}>
            {/* Avatar - במרכז */}
            <View style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              backgroundColor: DesignTokens.colors.background.tertiary,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 3,
              borderColor: `${DesignTokens.colors.primary.main}80`,
              ...DesignTokens.shadows.greenGlow,
              marginBottom: DesignTokens.spacing.md,
            }}>
              {profileData?.profile_picture ? (
                <Image 
                  source={{ uri: profileData.profile_picture }} 
                  style={{ width: '100%', height: '100%', borderRadius: 37 }}
                />
              ) : (
                <User size={40} color={DesignTokens.colors.primary.main} strokeWidth={2} />
              )}
            </View>

            {/* Text Content - במרכז */}
            <View style={{ alignItems: 'center' }}>
              {/* Name */}
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.xl,
                fontWeight: DesignTokens.typography.fontWeight.bold as any,
                color: DesignTokens.colors.text.primary,
                marginBottom: DesignTokens.spacing.xs,
                textAlign: 'center',
                letterSpacing: DesignTokens.typography.letterSpacing.tight,
              }}>
                {displayName}
              </Text>

              {/* Email */}
              <Text style={{
                fontSize: DesignTokens.typography.fontSize.sm,
                color: DesignTokens.colors.text.secondary,
                textAlign: 'center',
                marginBottom: DesignTokens.spacing.sm,
                fontWeight: DesignTokens.typography.fontWeight.medium as any,
              } as any}>
                {email}
              </Text>

              {/* Member Since & Subscription Plan */}
              <View style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: DesignTokens.spacing.md,
                marginTop: DesignTokens.spacing.xs,
              }}>
                {/* Member Since */}
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.xs,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'center',
                }}>
                  חבר קהילה מאז {getMemberSinceDate()}
                </Text>
                
                {/* Separator */}
                <View style={{
                  width: 1,
                  height: 12,
                  backgroundColor: DesignTokens.colors.text.tertiary,
                  opacity: 0.3,
                }} />
                
                {/* Subscription Plan */}
                <Text style={{
                  fontSize: DesignTokens.typography.fontSize.xs,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'center',
                }}>
                  מנוי חודשי
                </Text>
              </View>
            </View>
          </View>
        </UICard>

      {/* Menu Sections */}
      <View style={{ paddingHorizontal: DesignTokens.spacing.lg, marginTop: DesignTokens.spacing.lg }}>
        {/* Main Menu Section - עם blur כמו MainTabs */}
        <UICard 
          variant="blur"
          padding="none"
          style={{
            marginBottom: DesignTokens.spacing.lg,
          }}
        >
            {mainMenuItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingTop: DesignTokens.spacing.lg,
                    paddingBottom: index < mainMenuItems.length - 1 ? DesignTokens.spacing.md : DesignTokens.spacing.lg,
                    paddingHorizontal: DesignTokens.spacing.lg,
                  }}
                >
                {/* Chevron - שמאל */}
                <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: DesignTokens.spacing.md, marginRight: DesignTokens.spacing.md }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.base,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.xs / 2,
                    textAlign: 'right'
                  }}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={{
                      fontSize: DesignTokens.typography.fontSize.sm,
                      color: DesignTokens.colors.text.tertiary,
                      textAlign: 'right'
                    }}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>

                {/* Icon - ימין - עם Glassmorphism עדין */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: DesignTokens.borderRadius.md,
                  backgroundColor: `${DesignTokens.colors.primary.main}20`,
                  borderWidth: 1,
                  borderColor: DesignTokens.glassmorphism.primaryBorder.subtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...DesignTokens.shadows.xs,
                }}>
                  <item.icon 
                    size={20} 
                    color={DesignTokens.colors.primary.main} 
                    strokeWidth={2.5} 
                  />
                </View>
              </TouchableOpacity>
              {index < mainMenuItems.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: DesignTokens.glassmorphism.border.dark.subtle,
                  marginLeft: DesignTokens.spacing.lg,
                  marginRight: DesignTokens.spacing.lg,
                }} />
              )}
            </View>
            ))}
        </UICard>

        {/* Secondary Menu Section - עם blur כמו MainTabs */}
        <UICard 
          variant="blur"
          padding="none"
          style={{
            marginBottom: DesignTokens.spacing.lg,
          }}
        >
            {secondaryMenuItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={item.onPress}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingTop: DesignTokens.spacing.lg,
                    paddingBottom: index < secondaryMenuItems.length - 1 ? DesignTokens.spacing.md : DesignTokens.spacing.lg,
                    paddingHorizontal: DesignTokens.spacing.lg,
                  }}
                >
                {/* Chevron - שמאל */}
                <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: DesignTokens.spacing.md, marginRight: DesignTokens.spacing.md }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.fontSize.base,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    color: DesignTokens.colors.text.primary,
                    marginBottom: DesignTokens.spacing.xs / 2,
                    textAlign: 'right'
                  }}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={{
                      fontSize: DesignTokens.typography.fontSize.sm,
                      color: DesignTokens.colors.text.tertiary,
                      textAlign: 'right'
                    }}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>

                {/* Icon - ימין - עם Glassmorphism עדין */}
                <View style={{
                  width: 40,
                  height: 40,
                  borderRadius: DesignTokens.borderRadius.md,
                  backgroundColor: `${DesignTokens.colors.primary.main}20`,
                  borderWidth: 1,
                  borderColor: DesignTokens.glassmorphism.primaryBorder.subtle,
                  alignItems: 'center',
                  justifyContent: 'center',
                  ...DesignTokens.shadows.xs,
                }}>
                  <item.icon 
                    size={20} 
                    color={DesignTokens.colors.primary.main} 
                    strokeWidth={2.5} 
                  />
                </View>
              </TouchableOpacity>
              {index < secondaryMenuItems.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: DesignTokens.glassmorphism.border.dark.subtle,
                  marginLeft: DesignTokens.spacing.lg,
                  marginRight: DesignTokens.spacing.lg,
                }} />
              )}
            </View>
            ))}
        </UICard>

        {/* Logout Button - כפתור נורמלי */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
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
                      console.log('🔄 UserProfileScreen: Signing out...');
                      const { error } = await signOut();
                      if (error) {
                        console.error('❌ UserProfileScreen: Error signing out:', error);
                        Alert.alert('שגיאה', 'לא הצלחנו להתנתק. נסה שוב.');
                      } else {
                        console.log('✅ UserProfileScreen: Signed out successfully');
                        // הניווט יתבצע אוטומטית דרך AuthContext
                      }
                    } catch (error) {
                      console.error('❌ UserProfileScreen: Exception signing out:', error);
                      Alert.alert('שגיאה', 'אירעה שגיאה בהתנתקות. נסה שוב.');
                    }
                  }
                }
              ]
            );
          }}
          style={{
            marginTop: DesignTokens.spacing.lg,
            marginBottom: DesignTokens.spacing['3xl'],
            marginHorizontal: DesignTokens.spacing.lg,
          }}
        >
          <UICard 
            variant="blur"
            padding="md"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: `${DesignTokens.colors.danger.main}40`,
            }}
          >
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.base,
              fontWeight: DesignTokens.typography.fontWeight.semibold as any,
              color: DesignTokens.colors.danger.main
            }}>
              התנתקות
            </Text>
          </UICard>
        </TouchableOpacity>
      </View>
          </ScrollView>
        </View>
      </RNSafeAreaView>
    </View>
  );
}
