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
  SafeAreaView
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
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { DesignTokens } from '../../components/ui/DesignTokens';

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  onPress: () => void;
}

export default function UserProfileScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const { theme } = useTheme();
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
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={{ color: theme.textSecondary, fontSize: 16, marginTop: 16 }}>טוען פרופיל...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
          <Text style={{ color: theme.textPrimary, fontSize: 22, fontWeight: '600', marginBottom: 8 }}>
            לא מחובר
          </Text>
          <Text style={{ color: theme.textSecondary, fontSize: 16, textAlign: 'center' }}>
            יש להתחבר לאפליקציה
          </Text>
        </View>
      </SafeAreaView>
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
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background }}>

      <ScrollView 
        style={{ flex: 1 }} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Profile Header Card */}
        <View style={{
          backgroundColor: theme.cardBackground,
          marginHorizontal: 20,
          marginTop: 8,
          borderRadius: 16,
          borderBottomLeftRadius: 16,
          borderBottomRightRadius: 16,
          paddingVertical: 24,
          paddingHorizontal: 20,
          alignItems: 'center'
        }}>
          {/* Avatar */}
          <View style={{
            width: 120,
            height: 120,
            borderRadius: 60,
            backgroundColor: 'rgba(0,0,0,0.3)',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 16,
            borderWidth: 4,
            borderColor: DesignTokens.colors.primary.main
          }}>
            {profileData?.profile_picture ? (
              <Image 
                source={{ uri: profileData.profile_picture }} 
                style={{ width: '100%', height: '100%', borderRadius: 56 }}
              />
            ) : (
              <User size={60} color={DesignTokens.colors.primary.main} strokeWidth={1.5} />
            )}
          </View>

          {/* Name */}
          <Text style={{
            fontSize: 28,
            fontWeight: '800',
            color: theme.textPrimary,
            marginBottom: 8,
            textAlign: 'center',
            letterSpacing: 0.5
          }}>
            {displayName}
          </Text>

          {/* Email */}
          <Text style={{
            fontSize: 16,
            color: theme.textSecondary,
            textAlign: 'center',
            marginBottom: 16,
            fontWeight: '500'
          }}>
            {email}
          </Text>

          {/* Community Member Since */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 16
          }}>
            <Text style={{
              fontSize: 14,
              color: DesignTokens.colors.primary.main,
              fontWeight: '600',
              marginRight: 8
            }}>
              {getMemberSinceDate()}
            </Text>
            <Text style={{
              fontSize: 14,
              color: theme.textSecondary
            }}>
              חבר קהילה מאז
            </Text>
          </View>

          {/* Subscription Plan Tag */}
          <View style={{
            backgroundColor: 'rgba(0, 230, 84, 0.1)',
            borderRadius: 20,
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.3)'
          }}>
            <Text style={{
              fontSize: 14,
              color: DesignTokens.colors.primary.main,
              fontWeight: '600'
            }}>
              מנוי חודשי
            </Text>
          </View>
        </View>

      {/* Menu Sections */}
      <View style={{ paddingHorizontal: 20, marginTop: 16 }}>
        {/* Main Menu Section */}
        <View style={{
          backgroundColor: theme.cardBackground,
          borderRadius: 16,
          marginBottom: 16,
          overflow: 'hidden'
        }}>
            {mainMenuItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={item.onPress}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingTop: 16,
                    paddingBottom: index < mainMenuItems.length - 1 ? 12 : 16,
                    paddingHorizontal: 16,
                  }}
                >
                {/* Chevron - שמאל */}
                <ChevronLeft size={20} color={theme.textTertiary} strokeWidth={2} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.textPrimary,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={{
                      fontSize: 13,
                      color: theme.textTertiary,
                      textAlign: 'right'
                    }}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'rgba(5, 209, 87, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <item.icon 
                    size={20} 
                    color={DesignTokens.colors.primary.main} 
                    strokeWidth={2} 
                  />
                </View>
              </TouchableOpacity>
              {index < mainMenuItems.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                }} />
              )}
            </View>
            ))}
        </View>

        {/* Secondary Menu Section */}
        <View style={{
          backgroundColor: theme.cardBackground,
          borderRadius: 16,
          marginBottom: 16,
          overflow: 'hidden'
        }}>
            {secondaryMenuItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={item.onPress}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingTop: 16,
                    paddingBottom: index < secondaryMenuItems.length - 1 ? 12 : 16,
                    paddingHorizontal: 16,
                  }}
                >
                {/* Chevron - שמאל */}
                <ChevronLeft size={20} color={theme.textTertiary} strokeWidth={2} />

                {/* Text Content - מרכז */}
                <View style={{ flex: 1, marginLeft: 12, marginRight: 12 }}>
                  <Text style={{
                    fontSize: 16,
                    fontWeight: '600',
                    color: theme.textPrimary,
                    marginBottom: 2,
                    textAlign: 'right'
                  }}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={{
                      fontSize: 13,
                      color: theme.textTertiary,
                      textAlign: 'right'
                    }}>
                      {item.subtitle}
                    </Text>
                  )}
                </View>

                {/* Icon - ימין */}
                <View style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: 'rgba(0, 230, 84, 0.1)',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <item.icon 
                    size={20} 
                    color={DesignTokens.colors.primary.main} 
                    strokeWidth={2} 
                  />
                </View>
              </TouchableOpacity>
              {index < secondaryMenuItems.length - 1 && (
                <View style={{
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.15)',
                }} />
              )}
            </View>
            ))}
        </View>

        {/* Logout Button */}
          <TouchableOpacity 
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
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: `${DesignTokens.colors.danger.main}1A`,
              paddingVertical: 14,
              paddingHorizontal: 20,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${DesignTokens.colors.danger.main}33`,
              marginBottom: 32
            }}
          >
            <LogOut size={20} color={DesignTokens.colors.danger.main} strokeWidth={2} style={{ marginRight: 8 }} />
            <Text style={{
              fontSize: 16,
              fontWeight: '600',
              color: DesignTokens.colors.danger.main
            }}>
              התנתקות
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
