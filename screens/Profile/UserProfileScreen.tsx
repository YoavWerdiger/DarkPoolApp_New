import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import {
  UserPen,
  Settings,
  KeyRound,
  CreditCard,
  Shield,
  Inbox,
  MessageCircle,
  FileText,
  ScrollText,
  Bell,
  Trash2,
  LogOut,
  type LucideIcon,
} from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import {
  SettingsSectionTitle,
  SettingsGlassCard,
  ProfileMenuRow,
  ProfileIdentityCard,
} from '../../components/profile/ProfileSettingsUI';
import {
  settingsBodyType,
  settingsHebrewText,
  settingsHeroType,
} from '../../components/profile/settingsType';

type MenuRow = {
  id: string;
  title: string;
  icon: LucideIcon;
  onPress: () => void;
  danger?: boolean;
};

export default function UserProfileScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const { resetData: resetRegistrationData } = useRegistration();
  const { isAdmin } = useIsAdmin();
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
      void loadProfileData();
    }
  }, [user]);

  const loadProfileData = async () => {
    try {
      if (!user) return;
      // הפרופיל המלא של המשתמש עצמו (כולל email/phone) — RPC נעול על auth.uid();
      // public.users לא מחזירה את העמודות הפרטיות ל-`authenticated`.
      const { data: rows } = await supabase.rpc('get_my_profile');
      const data = Array.isArray(rows) ? rows[0] : rows;
      if (data) setProfileData(data);
    } catch {
      /* noop */
    }
  };

  const personalItems: MenuRow[] = [
    {
      id: 'edit',
      title: 'עריכת פרופיל',
      icon: UserPen,
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'settings',
      title: 'הגדרות כלליות',
      icon: Settings,
      onPress: () => navigation.navigate('Settings'),
    },
    {
      id: 'password',
      title: 'שינוי סיסמה',
      icon: KeyRound,
      onPress: () => navigation.navigate('ChangePassword'),
    },
  ];

  const billingItems: MenuRow[] = [
    {
      id: 'billing',
      title: 'מנוי והיסטוריית רכישות',
      icon: CreditCard,
      onPress: () => navigation.navigate('Billing'),
    },
  ];

  const adminItems: MenuRow[] = isAdmin
    ? [
        {
          id: 'admin-panel',
          title: 'פאנל מנהלים',
          icon: Shield,
          onPress: () => {
            const root = navigation.getParent?.();
            try {
              (root as any)?.navigate('Admin');
            } catch {
              (navigation as any).navigate('Admin');
            }
          },
        },
        {
          id: 'admin-tickets',
          title: 'תיבת פניות תמיכה',
          icon: Inbox,
          onPress: () => {
            const root = navigation.getParent?.();
            try {
              (root as any)?.navigate('Admin', { screen: 'AdminTickets' });
            } catch {
              (navigation as any).navigate('AdminTickets');
            }
          },
        },
      ]
    : [];

  const supportItems: MenuRow[] = [
    {
      id: 'privacy',
      title: 'מדיניות פרטיות',
      icon: FileText,
      onPress: () => navigation.navigate('LegalWebView', { kind: 'privacy' }),
    },
    {
      id: 'terms',
      title: 'תנאי שימוש',
      icon: ScrollText,
      onPress: () => navigation.navigate('LegalWebView', { kind: 'terms' }),
    },
    {
      id: 'contact',
      title: 'יצירת קשר',
      icon: MessageCircle,
      onPress: () => navigation.navigate('ContactSupport'),
    },
  ];

  const accountItems: MenuRow[] = [
    {
      id: 'delete',
      title: 'מחיקת חשבון',
      icon: Trash2,
      danger: true,
      onPress: () => {
        void HapticFeedback.impactLight();
        navigation.navigate('DeleteAccount');
      },
    },
    {
      id: 'logout',
      title: 'התנתקות',
      icon: LogOut,
      onPress: () => {
        void HapticFeedback.warning();
        legacyAlert('התנתקות', 'האם אתה בטוח שברצונך להתנתק?', [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'התנתק',
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await signOut();
                resetRegistrationData();
                if (error) legacyAlert('שגיאה', 'לא הצלחנו להתנתק. נסה שוב.');
              } catch {
                resetRegistrationData();
                legacyAlert('שגיאה', 'אירעה שגיאה בהתנתקות. נסה שוב.');
              }
            },
          },
        ]);
      },
    },
  ];

  if (isLoading) {
    return (
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text
            style={{
              ...settingsHebrewText,
              ...settingsBodyType,
              color: DesignTokens.colors.text.secondary,
              marginTop: APP_LAYOUT.componentGap,
              textAlign: 'center',
            }}
          >
            טוען פרופיל...
          </Text>
        </View>
      </RNSafeAreaView>
    );
  }

  if (!user) {
    return (
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: DesignTokens.spacing.xl,
          }}
        >
          <Text
            style={{
              ...settingsHebrewText,
              ...settingsHeroType,
              color: DesignTokens.colors.text.primary,
              textAlign: 'center',
            }}
          >
            לא מחובר
          </Text>
        </View>
      </RNSafeAreaView>
    );
  }

  const displayName = profileData?.full_name || user?.email?.split('@')[0] || 'משתמש';
  const email = user?.email || '';

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <MainDrawerScreenHeader title="פרופיל" onMenuPress={openMainDrawer} />
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: DesignTokens.spacing.xl }}
        >
          <View style={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal }}>
            <ProfileIdentityCard
              name={displayName}
              email={email}
              avatarUri={profileData?.profile_picture}
              onPress={() => {
                void HapticFeedback.impactLight();
                navigation.navigate('EditProfile');
              }}
            />
            <SettingsSectionTitle title="אישי" />
            <SettingsGlassCard>
              {personalItems.map((item, index) => (
                <ProfileMenuRow
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  showDivider={index < personalItems.length - 1}
                />
              ))}
            </SettingsGlassCard>

            <SettingsSectionTitle title="התראות" />
            <SettingsGlassCard>
              <ProfileMenuRow
                title="הגדרות התראות"
                icon={Bell}
                onPress={() => {
                  void HapticFeedback.impactLight();
                  navigation.navigate('Notifications');
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsSectionTitle title="חיובים" />
            <SettingsGlassCard>
              {billingItems.map((item, index) => (
                <ProfileMenuRow
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  showDivider={index < billingItems.length - 1}
                />
              ))}
            </SettingsGlassCard>

            {adminItems.length > 0 ? (
              <>
                <SettingsSectionTitle title="ניהול" />
                <SettingsGlassCard>
                  {adminItems.map((item, index) => (
                    <ProfileMenuRow
                      key={item.id}
                      title={item.title}
                      icon={item.icon}
                      onPress={() => {
                        void HapticFeedback.impactLight();
                        item.onPress();
                      }}
                      showDivider={index < adminItems.length - 1}
                    />
                  ))}
                </SettingsGlassCard>
              </>
            ) : null}

            <SettingsSectionTitle title="תמיכה" />
            <SettingsGlassCard>
              {supportItems.map((item, index) => (
                <ProfileMenuRow
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  showDivider={index < supportItems.length - 1}
                />
              ))}
            </SettingsGlassCard>

            <SettingsSectionTitle title="חשבון" />
            <SettingsGlassCard style={{ marginBottom: DesignTokens.spacing.md }}>
              {accountItems.map((item, index) => (
                <ProfileMenuRow
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  danger={item.danger}
                  onPress={item.onPress}
                  showDivider={index < accountItems.length - 1}
                />
              ))}
            </SettingsGlassCard>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}
