import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  ActivityIndicator,
  TouchableOpacity,
  StyleSheet,
  Switch,
} from 'react-native';
import { User } from 'lucide-react-native';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { useSubscription } from '../../hooks/useSubscription';
import { useIsAdmin } from '../../hooks/useIsAdmin';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import UICard from '../../components/ui/UICard';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import {
  SettingsSectionTitle,
  SettingsGlassCard,
  ProfileMenuRow,
  SettingsActionRow,
} from '../../components/profile/ProfileSettingsUI';

type MenuRow = {
  id: string;
  title: string;
  subtitle?: string;
  onPress: () => void;
  danger?: boolean;
};

export default function UserProfileScreen({ navigation }: any) {
  const { user, isLoading, signOut } = useAuth();
  const { resetData: resetRegistrationData } = useRegistration();
  const { planName, isLoading: subscriptionLoading } = useSubscription();
  const { isAdmin } = useIsAdmin();
  const { theme } = useTheme();
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
  const [systemNotifs, setSystemNotifs] = useState(true);
  const [contentNotifs, setContentNotifs] = useState(true);
  const [notifLoading, setNotifLoading] = useState(true);

  useEffect(() => {
    if (user) {
      void loadProfileData();
      void loadNotificationToggles();
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

  const loadNotificationToggles = async () => {
    if (!user) {
      setNotifLoading(false);
      return;
    }
    try {
      const { data } = await supabase
        .from('user_notification_settings')
        .select('notifications_enabled, news_notifications, message_notifications')
        .eq('user_id', user.id)
        .maybeSingle();

      if (data) {
        setSystemNotifs(data.notifications_enabled ?? true);
        setContentNotifs(
          (data.news_notifications ?? true) || (data.message_notifications ?? true),
        );
      }
    } finally {
      setNotifLoading(false);
    }
  };

  const upsertNotifPatch = async (patch: Record<string, boolean>) => {
    if (!user) return;
    const { error } = await supabase.from('user_notification_settings').upsert(
      {
        user_id: user.id,
        ...patch,
      },
      { onConflict: 'user_id' },
    );
    if (error) {
      legacyAlert('שגיאה', 'לא הצלחנו לשמור את הגדרת ההתראות');
      throw error;
    }
  };

  const toggleSystemNotifs = async (value: boolean) => {
    void HapticFeedback.selection();
    const prev = systemNotifs;
    setSystemNotifs(value);
    try {
      await upsertNotifPatch({ notifications_enabled: value });
    } catch {
      setSystemNotifs(prev);
    }
  };

  const toggleContentNotifs = async (value: boolean) => {
    void HapticFeedback.selection();
    const prev = contentNotifs;
    setContentNotifs(value);
    try {
      await upsertNotifPatch({
        news_notifications: value,
        message_notifications: value,
      });
    } catch {
      setContentNotifs(prev);
    }
  };

  const personalItems: MenuRow[] = [
    {
      id: 'edit',
      title: 'עריכת פרופיל',
      subtitle: 'שם, טלפון ותמונה',
      onPress: () => navigation.navigate('EditProfile'),
    },
    {
      id: 'settings',
      title: 'הגדרות כלליות',
      subtitle: 'שפה, ביומטריה ומטמון',
      onPress: () => navigation.navigate('Settings'),
    },
    {
      id: 'password',
      title: 'שינוי סיסמה',
      subtitle: 'אבטחת החשבון',
      onPress: () => navigation.navigate('ChangePassword'),
    },
  ];

  const billingItems: MenuRow[] = [
    {
      id: 'billing',
      title: 'מנוי והיסטוריית רכישות',
      subtitle: 'סטטוס, חידוש וחשבוניות',
      onPress: () => navigation.navigate('Billing'),
    },
  ];

  const adminItems: MenuRow[] = isAdmin
    ? [
        {
          id: 'admin-panel',
          title: 'פאנל מנהלים',
          subtitle: 'משתמשים, מנויים ופושים',
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
          subtitle: 'טיקטים מהמשתמשים',
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
      id: 'contact',
      title: 'יצירת קשר',
      subtitle: 'פתיחת פנייה לתמיכה',
      onPress: () => navigation.navigate('ContactSupport'),
    },
  ];

  const legalItems: MenuRow[] = [
    {
      id: 'privacy',
      title: 'מדיניות פרטיות',
      subtitle: 'darkpool.site/privacy',
      onPress: () => navigation.navigate('LegalWebView', { kind: 'privacy' }),
    },
    {
      id: 'terms',
      title: 'תנאי שימוש',
      subtitle: 'darkpool.site/terms',
      onPress: () => navigation.navigate('LegalWebView', { kind: 'terms' }),
    },
  ];

  const dangerItems: MenuRow[] = [
    {
      id: 'delete',
      title: 'מחיקת חשבון',
      subtitle: 'פעולה בלתי הפיכה',
      danger: true,
      onPress: () => navigation.navigate('DeleteAccount'),
    },
  ];

  if (isLoading) {
    return (
      <RNSafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text
            style={{
              color: DesignTokens.colors.text.secondary,
              marginTop: DesignTokens.spacing.lg,
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
              color: DesignTokens.colors.text.primary,
              fontSize: DesignTokens.typography.titleSmall.size,
              marginBottom: DesignTokens.spacing.sm,
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

  const getMemberSinceDate = () => {
    if (profileData?.created_at) {
      return new Date(profileData.created_at).toLocaleDateString('he-IL', {
        month: 'long',
        year: 'numeric',
      });
    }
    return '—';
  };

  const profileTextBlock = (
    <View style={{ flex: 1, minWidth: 0, alignItems: 'flex-end', gap: DesignTokens.spacing.xs }}>
      <Text
        style={{
          fontSize: DesignTokens.typography.titleSmall.size,
          fontWeight: DesignTokens.typography.titleSmall.weight as any,
          color: DesignTokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
          width: '100%',
        }}
      >
        {displayName}
      </Text>
      <Text
        style={{
          fontSize: DesignTokens.typography.bodySmall.size,
          color: DesignTokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'ltr',
          width: '100%',
        }}
      >
        {email}
      </Text>
      <Text
        style={{
          marginTop: DesignTokens.spacing.xs,
          fontSize: DesignTokens.typography.caption.size,
          color: DesignTokens.colors.text.tertiary,
          textAlign: 'right',
          writingDirection: 'rtl',
          width: '100%',
        }}
      >
        חבר מאז {getMemberSinceDate()} · מסלול{' '}
        {subscriptionLoading ? '...' : (planName ?? 'חינמי')}
      </Text>
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
        <MainDrawerScreenHeader title="פרופיל והגדרות" onMenuPress={openMainDrawer} />
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: DesignTokens.spacing.xl }}
        >
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
            {/* App LTR tree + forceRTL: אל תסמכו על isRTL — row-reverse שומר אווטאר בימין */}
            <View
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                width: '100%',
                paddingTop: DesignTokens.spacing.md,
                gap: DesignTokens.spacing.md,
              }}
            >
              {profileAvatar}
              {profileTextBlock}
            </View>
          </UICard>

          <View style={{ paddingHorizontal: DesignTokens.spacing.base, marginTop: DesignTokens.spacing.md }}>
            <SettingsSectionTitle title="אישי" />
            <SettingsGlassCard>
              {personalItems.map((item, index) => (
                <ProfileMenuRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
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
              <ToggleRow
                title="התראות מערכת"
                subtitle="התראות כלליות של האפליקציה"
                value={systemNotifs}
                disabled={notifLoading}
                onToggle={toggleSystemNotifs}
                theme={theme}
                tokens={DesignTokens}
              />
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: DesignTokens.colors.border.divider,
                  marginHorizontal: DesignTokens.spacing.base,
                }}
              />
              <ToggleRow
                title="התראות תוכן"
                subtitle="חדשות והודעות צ׳אט"
                value={contentNotifs}
                disabled={notifLoading}
                onToggle={toggleContentNotifs}
                theme={theme}
                tokens={DesignTokens}
              />
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: DesignTokens.colors.border.divider,
                  marginHorizontal: DesignTokens.spacing.base,
                }}
              />
              <ProfileMenuRow
                title="עוד הגדרות התראות"
                subtitle="צלילים, רעידות ופירוט"
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
                  subtitle={item.subtitle}
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
                      subtitle={item.subtitle}
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
                  subtitle={item.subtitle}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  showDivider={index < supportItems.length - 1}
                />
              ))}
            </SettingsGlassCard>

            <SettingsSectionTitle title="משפטי" />
            <SettingsGlassCard>
              {legalItems.map((item, index) => (
                <ProfileMenuRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle}
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  showDivider={index < legalItems.length - 1}
                />
              ))}
            </SettingsGlassCard>

            <SettingsSectionTitle title="חשבון" />
            <SettingsGlassCard style={{ marginBottom: DesignTokens.spacing.md }}>
              {dangerItems.map((item, index) => (
                <SettingsActionRow
                  key={item.id}
                  title={item.title}
                  subtitle={item.subtitle ?? ''}
                  danger
                  onPress={() => {
                    void HapticFeedback.impactLight();
                    item.onPress();
                  }}
                  showDivider={index < dangerItems.length - 1}
                />
              ))}
            </SettingsGlassCard>

            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => {
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
              }}
              style={{
                marginTop: DesignTokens.spacing.sm,
                marginBottom: DesignTokens.spacing['3xl'],
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 52,
                paddingVertical: DesignTokens.spacing.md,
                paddingHorizontal: DesignTokens.spacing.xl,
                borderRadius: DesignTokens.borderRadius.full,
                overflow: 'hidden',
                backgroundColor: `${DesignTokens.colors.danger.main}1A`,
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: `${DesignTokens.colors.danger.main}55`,
              }}
            >
              <Text
                style={{
                  fontSize: DesignTokens.typography.body.size,
                  fontWeight: DesignTokens.typography.buttonSmall.weight as any,
                  lineHeight: DesignTokens.typography.body.lineHeight,
                  color: DesignTokens.colors.danger.main,
                  textAlign: 'center',
                }}
              >
                התנתקות
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </RNSafeAreaView>
    </View>
  );
}

function ToggleRow({
  title,
  subtitle,
  value,
  disabled,
  onToggle,
  theme,
  tokens,
}: {
  title: string;
  subtitle: string;
  value: boolean;
  disabled?: boolean;
  onToggle: (v: boolean) => void;
  theme: any;
  tokens: any;
}) {
  return (
    <View
      style={{
        // עץ האפליקציה LTR — switch ראשון = שמאל ויזואלי (כמו בצילום RTL הרצוי)
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: tokens.spacing.md,
        paddingHorizontal: tokens.spacing.base,
      }}
    >
      <Switch
        value={value}
        disabled={disabled}
        onValueChange={onToggle}
        trackColor={{ false: theme.switchTrackOff, true: tokens.colors.primary.main }}
        thumbColor={value ? tokens.colors.text.primary : theme.switchThumbOff}
        ios_backgroundColor={theme.switchTrackOff}
        style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
      />
      <View style={{ flex: 1, marginLeft: tokens.spacing.sm }}>
        <Text
          style={{
            fontSize: tokens.typography.body.size,
            fontWeight: '600',
            color: tokens.colors.text.primary,
            textAlign: 'right',
            writingDirection: 'rtl',
          }}
        >
          {title}
        </Text>
        <Text
          style={{
            fontSize: tokens.typography.bodySmall.size,
            color: tokens.colors.text.tertiary,
            textAlign: 'right',
            writingDirection: 'rtl',
            marginTop: 2,
          }}
        >
          {subtitle}
        </Text>
      </View>
    </View>
  );
}
