import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
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
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s1'),
      icon: UserPen,
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'settings',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s2'),
      icon: Settings,
      onPress: () => navigation.navigate('Settings'),
    },
    {
      id: 'password',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s3'),
      icon: KeyRound,
      onPress: () => navigation.navigate('ChangePassword'),
    },
  ];

  const billingItems: MenuRow[] = [
    {
      id: 'billing',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s4'),
      icon: CreditCard,
      onPress: () => navigation.navigate('Billing'),
    },
  ];

  const adminItems: MenuRow[] = isAdmin
    ? [
        {
          id: 'admin-panel',
          title: i18n.t('auto.screens__Profile__UserProfileScreen.s5'),
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
          title: i18n.t('auto.screens__Profile__UserProfileScreen.s6'),
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
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s7'),
      icon: FileText,
      onPress: () => navigation.navigate('LegalWebView', { kind: 'privacy' }),
    },
    {
      id: 'terms',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s8'),
      icon: ScrollText,
      onPress: () => navigation.navigate('LegalWebView', { kind: 'terms' }),
    },
    {
      id: 'contact',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s9'),
      icon: MessageCircle,
      onPress: () => navigation.navigate('ContactSupport'),
    },
  ];

  const accountItems: MenuRow[] = [
    {
      id: 'delete',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s10'),
      icon: Trash2,
      danger: true,
      onPress: () => {
        void HapticFeedback.impactLight();
        navigation.navigate('DeleteAccount');
      },
    },
    {
      id: 'logout',
      title: i18n.t('auto.screens__Profile__UserProfileScreen.s11'),
      icon: LogOut,
      onPress: () => {
        void HapticFeedback.warning();
        legacyAlert(i18n.t('auto.screens__Profile__UserProfileScreen.s11'), i18n.t('auto.screens__Profile__UserProfileScreen.s12'), [
          { text: i18n.t('auto.screens__Profile__UserProfileScreen.s13'), style: 'cancel' },
          {
            text: i18n.t('auto.screens__Profile__UserProfileScreen.s14'),
            style: 'destructive',
            onPress: async () => {
              try {
                const { error } = await signOut();
                resetRegistrationData();
                if (error) legacyAlert(i18n.t('auto.screens__Profile__UserProfileScreen.s15'), i18n.t('auto.screens__Profile__UserProfileScreen.s16'));
              } catch {
                resetRegistrationData();
                legacyAlert(i18n.t('auto.screens__Profile__UserProfileScreen.s15'), i18n.t('auto.screens__Profile__UserProfileScreen.s17'));
              }
            },
          },
        ]);
      },
    },
  ];

  // בזמן טעינת המשתמש — המסך האמיתי (כותרת, כל התפריטים הקבועים); רק כרטיס הזהות כשלד
  if (!isLoading && !user) {
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
          >{i18n.t('auto.screens__Profile__UserProfileScreen.s19')}</Text>
        </View>
      </RNSafeAreaView>
    );
  }

  const displayName = profileData?.full_name || user?.email?.split('@')[0] || i18n.t('auto.screens__Profile__UserProfileScreen.s20');
  const email = user?.email || '';

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }} edges={['top', 'bottom']}>
        <MainDrawerScreenHeader title={i18n.t('auto.screens__Profile__UserProfileScreen.s21')} onMenuPress={openMainDrawer} />
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: DesignTokens.spacing.xl }}
        >
          <View style={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal }}>
            <ProfileIdentityCard
              name={displayName}
              userId={user?.id}
              email={email}
              avatarUri={profileData?.profile_picture}
              loading={isLoading && !user}
              onPress={() => {
                void HapticFeedback.impactLight();
                navigation.navigate('EditProfile');
              }}
            />
            <SettingsSectionTitle title={i18n.t('auto.screens__Profile__UserProfileScreen.s22')} />
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

            <SettingsSectionTitle title={i18n.t('auto.screens__Profile__UserProfileScreen.s23')} />
            <SettingsGlassCard>
              <ProfileMenuRow
                title={i18n.t('auto.screens__Profile__UserProfileScreen.s24')}
                icon={Bell}
                onPress={() => {
                  void HapticFeedback.impactLight();
                  navigation.navigate('Notifications');
                }}
                showDivider={false}
              />
            </SettingsGlassCard>

            <SettingsSectionTitle title={i18n.t('auto.screens__Profile__UserProfileScreen.s25')} />
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
                <SettingsSectionTitle title={i18n.t('auto.screens__Profile__UserProfileScreen.s26')} />
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

            <SettingsSectionTitle title={i18n.t('auto.screens__Profile__UserProfileScreen.s27')} />
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

            <SettingsSectionTitle title={i18n.t('auto.screens__Profile__UserProfileScreen.s28')} />
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
