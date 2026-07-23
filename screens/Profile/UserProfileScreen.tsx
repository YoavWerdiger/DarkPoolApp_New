import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, Image, ActivityIndicator, TouchableOpacity, StyleSheet, I18nManager, Linking } from 'react-native';
import {
  User,
  Settings,
  ChevronLeft,
  Star,
  Bell,
  CreditCard,
  Edit3,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import { getStoreReviewUrl } from '../../utils/appMeta';

interface MenuItem {
  id: string;
  title: string;
  subtitle?: string;
  icon: any;
  onPress: () => void;
}

export default function UserProfileScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const { planName, isLoading: subscriptionLoading } = useSubscription();
  const DesignTokens = useDesignTokens();

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

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
      subtitle: 'צפייה במסלולים (תשלום בקרוב)',
      icon: CreditCard,
      onPress: () => navigation.navigate('SubscriptionPlans')
    },
    {
      id: 'rate',
      title: 'דרג אותנו',
      subtitle: 'שתף את החוויה שלך בחנות',
      icon: Star,
      onPress: () => {
        void Linking.openURL(getStoreReviewUrl()).catch(() => {
          legacyAlert('שגיאה', 'לא הצלחנו לפתוח את דף החנות.');
        });
      }
    }
  ];

  if (isLoading) {
    return (
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: DesignTokens.typography.body.size,
            fontWeight: DesignTokens.typography.body.weight as any,
            lineHeight: DesignTokens.typography.body.lineHeight,
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
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: DesignTokens.spacing.xl }}>
          <Text style={{ 
            color: DesignTokens.colors.text.primary, 
            fontSize: DesignTokens.typography.titleSmall.size,
            fontWeight: DesignTokens.typography.titleSmall.weight as any,
            letterSpacing: DesignTokens.typography.titleSmall.letterSpacing,
            marginBottom: DesignTokens.spacing.sm 
          }}>
            לא מחובר
          </Text>
          <Text style={{ 
            color: DesignTokens.colors.text.secondary, 
            fontSize: DesignTokens.typography.body.size,
            fontWeight: DesignTokens.typography.body.weight as any,
            lineHeight: DesignTokens.typography.body.lineHeight,
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

  const profileTextBlock = (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-end',
        gap: DesignTokens.spacing.xs,
      }}
    >
      <Text
        style={{
          fontSize: DesignTokens.typography.titleSmall.size,
          fontWeight: DesignTokens.typography.titleSmall.weight as any,
          letterSpacing: DesignTokens.typography.titleSmall.letterSpacing,
          lineHeight: DesignTokens.typography.titleSmall.lineHeight,
          color: DesignTokens.colors.text.primary,
          textAlign: 'right',
          width: '100%',
        }}
      >
        {displayName}
      </Text>

      <Text
        style={{
          fontSize: DesignTokens.typography.bodySmall.size,
          fontWeight: DesignTokens.typography.bodySmall.weight as any,
          lineHeight: DesignTokens.typography.bodySmall.lineHeight,
          color: DesignTokens.colors.text.secondary,
          textAlign: 'right',
          width: '100%',
        } as any}
      >
        {email}
      </Text>

      <View
        style={{
          marginTop: DesignTokens.spacing.xs,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
          rowGap: DesignTokens.spacing.xs,
          columnGap: DesignTokens.spacing.sm,
          paddingVertical: DesignTokens.spacing.sm,
          paddingHorizontal: DesignTokens.spacing.md,
          borderRadius: DesignTokens.borderRadius.full,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
          borderWidth: 1,
          borderColor: 'rgba(255, 255, 255, 0.1)',
          alignSelf: 'stretch',
        }}
      >
        <Text
          style={{
            fontSize: DesignTokens.typography.caption.size,
            fontWeight: DesignTokens.typography.caption.weight as any,
            lineHeight: DesignTokens.typography.caption.lineHeight,
            color: DesignTokens.colors.text.tertiary,
            textAlign: 'right',
          }}
        >
          מסלול {subscriptionLoading ? '...' : (planName ?? 'חינמי')}
        </Text>
        <View
          style={{
            width: StyleSheet.hairlineWidth * 2,
            height: 11,
            borderRadius: 1,
            backgroundColor: DesignTokens.colors.border.divider,
          }}
        />
        <Text
          style={{
            fontSize: DesignTokens.typography.caption.size,
            fontWeight: DesignTokens.typography.caption.weight as any,
            lineHeight: DesignTokens.typography.caption.lineHeight,
            color: DesignTokens.colors.text.tertiary,
            textAlign: 'right',
            flexShrink: 1,
          }}
        >
          חבר קהילה מאז {getMemberSinceDate()}
        </Text>
      </View>
    </View>
  );

  const profileAvatar = (
    <View
      style={{
        width: 88,
        height: 88,
        borderRadius: 44,
        backgroundColor: DesignTokens.colors.background.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: `${DesignTokens.colors.primary.main}99`,
        overflow: 'hidden',
        flexShrink: 0,
        ...DesignTokens.shadows.greenGlow,
      }}
    >
      {profileData?.profile_picture ? (
        <Image
          source={{ uri: profileData.profile_picture }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="cover"
        />
      ) : (
        <User size={42} color={DesignTokens.colors.primary.main} strokeWidth={2} />
      )}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <MainDrawerScreenHeader title="פרופיל" onMenuPress={openMainDrawer} />
        <View style={{ flex: 1 }}>
          <ScrollView 
            style={{ flex: 1 }} 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: DesignTokens.spacing.xl }}
          >
          {/* Profile Header — זכוכית (glass) */}
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={{
              marginHorizontal: DesignTokens.spacing.base,
              marginTop: DesignTokens.spacing.xs,
              paddingTop: DesignTokens.spacing.sm,
              paddingBottom: DesignTokens.spacing.lg,
              paddingHorizontal: DesignTokens.spacing.md,
              borderRadius: DesignTokens.borderRadius['2xl'],
            }}
          >
          {/* טקסטים משמאל, תמונה מימין (ב־RTL סדר הילדים מתהפך) */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              width: '100%',
              paddingTop: DesignTokens.spacing.md,
              gap: DesignTokens.spacing.md,
            }}
          >
            {I18nManager.isRTL ? (
              <>
                {profileAvatar}
                {profileTextBlock}
              </>
            ) : (
              <>
                {profileTextBlock}
                {profileAvatar}
              </>
            )}
          </View>
        </UICard>

      {/* Menu Sections */}
      <View style={{ paddingHorizontal: DesignTokens.spacing.base, marginTop: DesignTokens.spacing.md }}>
        {/* תפריט ראשי — זכוכית */}
        <UICard
          variant="glass"
          glassIntensity="light"
          padding="none"
          style={{
            marginBottom: DesignTokens.spacing.md,
            borderRadius: DesignTokens.borderRadius.lg,
          }}
        >
            {mainMenuItems.map((item, index) => (
              <View key={item.id}>
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  activeOpacity={0.7}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: DesignTokens.spacing.md,
                    paddingHorizontal: DesignTokens.spacing.base,
                  }}
                >
                {/* Chevron - שמאל */}
                <ChevronLeft size={20} color={DesignTokens.colors.text.tertiary} strokeWidth={2} />

                {/* Text Content - מרכז */}
                <View style={{
                  flex: 1,
                  marginLeft: DesignTokens.spacing.sm,
                  marginRight: DesignTokens.spacing.sm,
                  gap: DesignTokens.spacing.micro,
                }}>
                  <Text style={{
                    fontSize: DesignTokens.typography.body.size,
                    fontWeight: DesignTokens.typography.fontWeight.semibold as any,
                    lineHeight: DesignTokens.typography.body.lineHeight,
                    color: DesignTokens.colors.text.primary,
                    textAlign: 'right',
                  }}>
                    {item.title}
                  </Text>
                  {item.subtitle && (
                    <Text style={{
                      fontSize: DesignTokens.typography.bodySmall.size,
                      fontWeight: DesignTokens.typography.bodySmall.weight as any,
                      lineHeight: DesignTokens.typography.bodySmall.lineHeight,
                      color: DesignTokens.colors.text.tertiary,
                      textAlign: 'right',
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
                  borderWidth: DesignTokens.layout.borderWidth.normal,
                  borderColor: DesignTokens.colors.border.primary,
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
                  backgroundColor: DesignTokens.colors.border.divider,
                  marginLeft: DesignTokens.spacing.base,
                  marginRight: DesignTokens.spacing.base,
                }} />
              )}
            </View>
            ))}
        </UICard>

        {/* Logout Button - כפתור נורמלי */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => {
            void HapticFeedback.warning();
            legacyAlert(
              'התנתקות',
              'האם אתה בטוח שברצונך להתנתק?',
              [
                { text: 'ביטול', style: 'cancel' },
                { 
                  text: 'התנתק', 
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await signOut();
                      if (error) {
                        legacyAlert('שגיאה', 'לא הצלחנו להתנתק. נסה שוב.');
                      } else {
                        // הניווט יתבצע אוטומטית דרך AuthContext
                      }
                    } catch (error) {
                      legacyAlert('שגיאה', 'אירעה שגיאה בהתנתקות. נסה שוב.');
                    }
                  }
                }
              ]
            );
          }}
          style={{
            marginTop: DesignTokens.spacing.lg,
            marginBottom: DesignTokens.spacing['3xl'],
            marginHorizontal: DesignTokens.spacing.base,
          }}
        >
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 52,
              paddingVertical: DesignTokens.spacing.md,
              paddingHorizontal: DesignTokens.spacing.xl,
              borderRadius: DesignTokens.borderRadius.full,
              borderWidth: 1.5,
              borderColor: `${DesignTokens.colors.danger.main}66`,
            }}
          >
            <Text style={{
              fontSize: DesignTokens.typography.body.size,
              fontWeight: DesignTokens.typography.fontWeight.semibold as any,
              lineHeight: DesignTokens.typography.body.lineHeight,
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
