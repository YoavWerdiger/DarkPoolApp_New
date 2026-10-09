import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  Award,
  Ban,
  ClipboardList,
  CreditCard,
  KeyRound,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX, ShieldCheck } from 'lucide-react-native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { ProfileMenuRow, SettingsSwitchRow } from '../../components/profile/ProfileSettingsUI';
import UIButton from '../../components/ui/UIButton';
import { UserNameRow, badgeSizeForLineHeight } from '../../components/ui/badges/UserBadges';
import { formatDaysCount, rankColor, rankForPaidDays } from '../../components/ui/badges/userRank';
import { setUserBadgesCache } from '../../hooks/useUserBadges';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  adminBody,
  adminCaption,
  adminCardSubtitle,
  adminCardTitle,
  adminHebrewText,
  adminPhysicalRightText,
} from '../../components/admin/adminType';
import { APP_TYPE } from '../../components/ui/appType';
import {
  AdminFilterChip,
  AdminBadge,
  AdminLoadingState,
  AdminEmptyState,
  AdminSurface,
} from '../../components/admin';
import {
  adminService,
  type AdminUserBadgeDetails,
  type AdminUserFilter,
  type AdminUserRow,
} from '../../services/admin';
import { formatIntroDataRows } from '../../constants/onboardingQuestionnaire';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';

const FILTERS: { key: AdminUserFilter; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'premium', label: 'פרימיום' },
  { key: 'muted', label: 'מושתקים' },
  { key: 'suspended', label: 'מושעים' },
  { key: 'verified', label: 'מאומתים' },
];

/** ותק אפקטיבי — כמו get_user_badges: null כשאין תשלום ואין התאמה חיובית */
function effectivePaidDays(d: AdminUserBadgeDetails | undefined): number | null {
  if (!d) return null;
  if (d.computed_days == null && d.adjustment_days <= 0) return null;
  return Math.max(0, (d.computed_days ?? 0) + d.adjustment_days);
}

export default function AdminUsersScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AdminUserFilter>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [openIntroId, setOpenIntroId] = useState<string | null>(null);
  const [openTenureId, setOpenTenureId] = useState<string | null>(null);
  const [badgeDetails, setBadgeDetails] = useState<Record<string, AdminUserBadgeDetails>>({});
  const { user: me } = useAuth();

  const loadBadgeDetails = useCallback(async (ids: string[]) => {
    try {
      const rows = await adminService.badgeDetails(ids);
      setBadgeDetails((prev) => {
        const next = { ...prev };
        for (const r of rows) next[r.user_id] = r;
        return next;
      });
    } catch {
      // לא חוסם את הרשימה
    }
  }, []);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      if (filter === 'verified') {
        const rows = await adminService.listVerifiedUsers(query, 40);
        setUsers(rows);
        setTotal(rows.length);
        void loadBadgeDetails(rows.map((u) => u.id));
      } else {
        const res = await adminService.listUsers({ query, filter, page: 1, pageSize: 40 });
        setUsers(res.users);
        setTotal(res.total);
        void loadBadgeDetails(res.users.map((u) => u.id));
      }
    } catch (e) {
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'טעינת משתמשים נכשלה');
    } finally {
      setLoading(false);
    }
  }, [query, filter, loadBadgeDetails]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, query ? 320 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const patchUserLocally = (userId: string, patch: Partial<AdminUserRow>) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
  };

  const toggleVerified = async (user: AdminUserRow, next: boolean) => {
    setBusyId(user.id);
    try {
      await adminService.setVerified(user.id, next);
      setBadgeDetails((prev) => {
        const cur = prev[user.id];
        if (!cur) return prev;
        return { ...prev, [user.id]: { ...cur, is_verified: next } };
      });
      setUserBadgesCache(user.id, { isVerified: next });
      void HapticFeedback.success();
    } catch (e) {
      void HapticFeedback.error();
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
    } finally {
      setBusyId(null);
    }
  };

  const saveTenureAdjustment = async (user: AdminUserRow, days: number) => {
    setBusyId(user.id);
    try {
      await adminService.setTenureAdjustment(user.id, days);
      const cur = badgeDetails[user.id];
      const updated: AdminUserBadgeDetails = cur
        ? { ...cur, adjustment_days: days }
        : { user_id: user.id, is_verified: false, verified_at: null, computed_days: null, adjustment_days: days };
      setBadgeDetails((prev) => ({ ...prev, [user.id]: updated }));
      setUserBadgesCache(user.id, { paidDays: effectivePaidDays(updated) });
      void HapticFeedback.success();
    } catch (e) {
      void HapticFeedback.error();
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
    } finally {
      setBusyId(null);
    }
  };

  const isPremiumRole = (role: string | null) =>
    ['plus_user', 'premium_user', 'vip_user'].includes(String(role || ''));

  const confirmMute = (user: AdminUserRow) => {
    const next = !user.is_muted;
    legacyAlert(
      next ? 'השתקת משתמש' : 'ביטול השתקה',
      next
        ? `להשתיק את ${user.display_name || user.full_name || user.email}?`
        : `לבטל השתקה עבור ${user.display_name || user.full_name || user.email}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: next ? 'השתק' : 'בטל השתקה',
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(user.id);
            try {
              await adminService.setMute(user.id, next, next ? 'השתקה ממנהל' : undefined);
              patchUserLocally(user.id, {
                is_muted: next,
                muted_reason: next ? 'השתקה ממנהל' : null,
              });
              void HapticFeedback.success();
              await load({ silent: true });
            } catch (e) {
              legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const confirmSuspend = (user: AdminUserRow) => {
    const next = !user.is_suspended;
    legacyAlert(
      next ? 'השעיית משתמש' : 'ביטול השעיה',
      next
        ? `להשעות את ${user.display_name || user.full_name || user.email}?`
        : `לבטל השעיה עבור ${user.display_name || user.full_name || user.email}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: next ? 'השעה' : 'בטל השעיה',
          style: next ? 'destructive' : 'default',
          onPress: async () => {
            setBusyId(user.id);
            try {
              await adminService.setSuspend(user.id, next, next ? 'השעיה ממנהל' : undefined);
              patchUserLocally(user.id, {
                is_suspended: next,
                suspended_reason: next ? 'השעיה ממנהל' : null,
              });
              void HapticFeedback.success();
              await load({ silent: true });
            } catch (e) {
              legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const confirmPremium = (user: AdminUserRow) => {
    const grant = !isPremiumRole(user.subscription_role);
    legacyAlert(
      grant ? 'הענקת פרימיום' : 'הסרת פרימיום',
      grant
        ? `להעניק פרימיום ל־${user.display_name || user.full_name || user.email}?`
        : `להסיר פרימיום מ־${user.display_name || user.full_name || user.email}?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: grant ? 'הענק' : 'הסר',
          style: grant ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(user.id);
            try {
              await adminService.setPremium(user.id, grant);
              patchUserLocally(user.id, {
                subscription_role: grant ? 'premium_user' : 'free_user',
                subscription_plan: grant ? 'premium' : 'free',
              });
              void HapticFeedback.success();
              await load({ silent: true });
            } catch (e) {
              legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  /** הרשאת ניהול באפליקציה — השרת מאפשר רק לסופר-אדמין */
  const confirmAppAdmin = (user: AdminUserRow) => {
    const role = String(user.subscription_role || '').toLowerCase();
    const makeAdmin = role !== 'admin';
    const who = user.display_name || user.full_name || user.email;
    legacyAlert(
      makeAdmin ? 'הרשאת מנהל' : 'הסרת הרשאת מנהל',
      makeAdmin
        ? `לתת ל־${who} גישה לפאנל המנהלים ולכל פעולות הניהול?`
        : `להסיר מ־${who} את הרשאות הניהול?`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: makeAdmin ? 'הפוך למנהל' : 'הסר',
          style: makeAdmin ? 'default' : 'destructive',
          onPress: async () => {
            setBusyId(user.id);
            try {
              const res = await adminService.setAppAdmin(user.id, makeAdmin);
              patchUserLocally(user.id, { subscription_role: res.role });
              void HapticFeedback.success();
            } catch (e) {
              void HapticFeedback.error();
              legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const confirmResetPassword = (user: AdminUserRow) => {
    legacyAlert('איפוס סיסמה', `ליצור קישור איפוס עבור ${user.email}?`, [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'צור קישור',
        onPress: async () => {
          setBusyId(user.id);
          try {
            const res = await adminService.resetPassword(user.id);
            void HapticFeedback.success();
            legacyAlert(
              'קישור מוכן',
              res.actionLink
                ? `נשלח ליומן אדמין. קישור:\n${res.actionLink}`
                : `נוצר קישור ל־${res.email}`,
            );
          } catch (e) {
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'פעולה נכשלה');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const confirmDelete = (user: AdminUserRow) => {
    legacyAlert(
      'מחיקת משתמש',
      `למחוק לצמיתות את ${user.display_name || user.full_name || user.email}? פעולה בלתי הפיכה.`,
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק',
          style: 'destructive',
          onPress: async () => {
            setBusyId(user.id);
            try {
              await adminService.deleteUser(user.id);
              void HapticFeedback.warning();
              await load({ silent: true });
            } catch (e) {
              legacyAlert('שגיאה', e instanceof Error ? e.message : 'מחיקה נכשלה');
            } finally {
              setBusyId(null);
            }
          },
        },
      ],
    );
  };

  const roleLabel = (role: string | null) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return 'מנהל';
      case 'vip_user':
        return 'VIP';
      case 'premium_user':
      case 'plus_user':
        return 'פרימיום';
      default:
        return 'חינמי';
    }
  };

  const roleColor = (role: string | null) => {
    switch (role) {
      case 'admin':
      case 'super_admin':
        return tokens.colors.primary.main;
      case 'vip_user':
        return tokens.colors.warning.main;
      case 'premium_user':
      case 'plus_user':
        return tokens.colors.secondary.main;
      default:
        return tokens.colors.text.tertiary;
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ChatSubScreenHeader
        title="ניהול משתמשים"
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />

      <View style={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingTop: tokens.spacing.sm }}>
        <View
          style={[
            formFieldShellStyle({ tokens, focused: false }),
            styles.searchShell,
            { marginBottom: APP_LAYOUT.cardStackGap },
          ]}
        >
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="חיפוש בשם / אימייל / טלפון"
            placeholderTextColor={tokens.colors.text.tertiary}
            style={[styles.searchInput, { color: tokens.colors.text.primary }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          <Search size={18} color={tokens.colors.text.tertiary} strokeWidth={2} />
        </View>

        <View style={styles.filters}>
          {FILTERS.map((f) => (
            <AdminFilterChip
              key={f.key}
              label={f.label}
              active={filter === f.key}
              onPress={() => setFilter(f.key)}
            />
          ))}
        </View>

        <Text style={[styles.countText, { color: tokens.colors.text.primary }]}>
          {total} משתמשים
        </Text>
      </View>

      {loading ? (
        <AdminLoadingState label="טוען משתמשים..." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
            paddingTop: 4,
            paddingBottom: 48,
          }}
          ListEmptyComponent={
            <AdminEmptyState
              title="לא נמצאו משתמשים"
              subtitle="נסו לשנות את החיפוש או הסינון"
            />
          }
          renderItem={({ item }) => (
            <UserCard
              item={item}
              busy={busyId === item.id}
              introOpen={openIntroId === item.id}
              onToggleIntro={() =>
                setOpenIntroId((current) => (current === item.id ? null : item.id))
              }
              badges={badgeDetails[item.id]}
              isSelf={item.id === me?.id}
              tenureOpen={openTenureId === item.id}
              onToggleTenure={() =>
                setOpenTenureId((current) => (current === item.id ? null : item.id))
              }
              onToggleVerified={(next) => {
                if (busyId === item.id) return;
                void toggleVerified(item, next);
              }}
              onSaveTenure={(days) => {
                if (busyId === item.id) return;
                void saveTenureAdjustment(item, days);
              }}
              roleLabel={roleLabel(item.subscription_role)}
              roleColor={roleColor(item.subscription_role)}
              premium={isPremiumRole(item.subscription_role)}
              onMute={() => confirmMute(item)}
              onSuspend={() => confirmSuspend(item)}
              onPremium={() => confirmPremium(item)}
              onResetPassword={() => confirmResetPassword(item)}
              onAppAdmin={
                String(item.subscription_role || '').toLowerCase() === 'super_admin'
                  ? undefined
                  : () => confirmAppAdmin(item)
              }
              onDelete={() => confirmDelete(item)}
              onPayments={() => {
                void HapticFeedback.impactLight();
                navigation.navigate('AdminPayments', {
                  userId: item.id,
                  email: item.email,
                  tab: 'active',
                });
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

function UserCard({
  item,
  busy,
  introOpen,
  onToggleIntro,
  badges,
  isSelf,
  tenureOpen,
  onToggleTenure,
  onToggleVerified,
  onSaveTenure,
  roleLabel,
  roleColor,
  premium,
  onMute,
  onSuspend,
  onPremium,
  onResetPassword,
  onAppAdmin,
  onDelete,
  onPayments,
}: {
  item: AdminUserRow;
  busy: boolean;
  introOpen: boolean;
  onToggleIntro: () => void;
  badges?: AdminUserBadgeDetails;
  isSelf: boolean;
  tenureOpen: boolean;
  onToggleTenure: () => void;
  onToggleVerified: (next: boolean) => void;
  onSaveTenure: (days: number) => void;
  roleLabel: string;
  roleColor: string;
  premium: boolean;
  onMute: () => void;
  onSuspend: () => void;
  onPremium: () => void;
  onResetPassword: () => void;
  onAppAdmin?: () => void;
  onDelete: () => void;
  onPayments: () => void;
}) {
  const tokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const name = item.display_name || item.full_name || 'משתמש';
  const introRows = formatIntroDataRows(item.intro_data);
  const paidDays = effectivePaidDays(badges);
  const rank = rankForPaidDays(paidDays);
  const [adjustDraft, setAdjustDraft] = useState('');
  useEffect(() => {
    if (tenureOpen) setAdjustDraft(String(badges?.adjustment_days ?? 0));
  }, [tenureOpen, badges?.adjustment_days]);
  const parsedAdjust = /^-?\d{1,5}$/.test(adjustDraft.trim()) ? Number(adjustDraft.trim()) : null;
  const guard = (action: () => void) => () => {
    if (busy) return;
    action();
  };

  return (
    <AdminSurface style={busy ? { opacity: 0.55 } : undefined}>
      <View style={styles.userTop}>
        {item.profile_picture ? (
          <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
        ) : (
          <View
            style={[
              styles.avatar,
              {
                backgroundColor: tokens.colors.background.tertiary,
                alignItems: 'center',
                justifyContent: 'center',
              },
            ]}
          >
            <Text style={[adminCardTitle, { color: tokens.colors.text.primary }]}>
              {name.charAt(0)}
            </Text>
          </View>
        )}
        <View style={{ flex: 1 }}>
          <UserNameRow userId={item.id} size={badgeSizeForLineHeight(APP_TYPE.cardTitle.lineHeight)}>
            <Text style={[styles.userName, { color: tokens.colors.text.primary }]} numberOfLines={1}>
              {name}
            </Text>
          </UserNameRow>
          <Text style={[styles.userEmail, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
            {item.email}
          </Text>
          <View style={styles.badgeRow}>
            <AdminBadge label={roleLabel} color={roleColor} />
            {item.is_muted ? <AdminBadge label="מושתק" color={tokens.colors.danger.main} /> : null}
            {item.is_suspended ? (
              <AdminBadge label="מושעה" color={tokens.colors.warning.main} />
            ) : null}
            {busy ? <ActivityIndicator size="small" color={tokens.colors.text.secondary} /> : null}
          </View>
        </View>
      </View>

      <View style={[styles.rule, { backgroundColor: tokens.colors.border.divider }]} />

      {introRows.length > 0 ? (
        <>
          <ProfileMenuRow
            title="שאלון קליטה"
            icon={ClipboardList}
            showDivider={!introOpen}
            onPress={onToggleIntro}
          />
          {introOpen
            ? introRows.map((row, index) => (
                <View key={row.key}>
                  <View style={styles.introRow}>
                    <Text style={[styles.introField, { color: tokens.colors.text.primary }]}>
                      {row.fieldLabel}
                    </Text>
                    <Text style={[styles.introValue, { color: tokens.colors.text.secondary }]}>
                      {row.valueLabel}
                    </Text>
                  </View>
                  <View
                    style={[
                      index < introRows.length - 1 ? styles.ruleInset : styles.rule,
                      { backgroundColor: tokens.colors.border.divider },
                    ]}
                  />
                </View>
              ))
            : null}
        </>
      ) : null}
      <SettingsSwitchRow
        title="משתמש מאומת"
        value={!!badges?.is_verified}
        disabled={busy || isSelf || !badges}
        onValueChange={onToggleVerified}
      />
      <ProfileMenuRow
        title={
          paidDays != null
            ? `ותק מנוי · ${formatDaysCount(paidDays)}`
            : 'ותק מנוי · ללא'
        }
        icon={Award}
        showDivider={!tenureOpen}
        onPress={onToggleTenure}
      />
      {tenureOpen ? (
        <View style={styles.tenureBox}>
          <Text style={[styles.introValue, { color: tokens.colors.text.secondary, marginTop: 0 }]}>
            {badges?.computed_days != null
              ? `מחושב מתשלומים: ${formatDaysCount(badges.computed_days)}`
              : 'אין תשלומים במערכת'}
          </Text>
          <Text style={[styles.introField, { color: tokens.colors.text.primary, marginTop: 10 }]}>
            התאמה ידנית (ימים, אפשר שלילי)
          </Text>
          <View style={styles.tenureInputRow}>
            <UIButton
              title="שמור"
              variant="primary"
              size="sm"
              disabled={busy || parsedAdjust == null || parsedAdjust === (badges?.adjustment_days ?? 0)}
              onPress={() => {
                if (parsedAdjust != null) onSaveTenure(parsedAdjust);
              }}
            />
            <View style={[formFieldShellStyle({ tokens, focused: false }), styles.tenureInputShell]}>
              <TextInput
                value={adjustDraft}
                onChangeText={setAdjustDraft}
                keyboardType="numbers-and-punctuation"
                placeholder="0"
                placeholderTextColor={tokens.colors.text.tertiary}
                style={[styles.searchInput, { color: tokens.colors.text.primary }]}
              />
            </View>
          </View>
        </View>
      ) : null}
      {tenureOpen ? <View style={[styles.rule, { backgroundColor: tokens.colors.border.divider }]} /> : null}
      <ProfileMenuRow
        title={item.is_muted ? 'בטל השתקה' : 'השתק'}
        icon={item.is_muted ? Volume2 : VolumeX}
        onPress={guard(onMute)}
      />
      <ProfileMenuRow
        title={item.is_suspended ? 'בטל השעיה' : 'השעה'}
        icon={Ban}
        onPress={guard(onSuspend)}
      />
      <ProfileMenuRow title="תשלומים ומנויים" icon={CreditCard} onPress={guard(onPayments)} />
      <ProfileMenuRow
        title={premium ? 'הסר פרימיום' : 'הענק פרימיום'}
        icon={Sparkles}
        onPress={guard(onPremium)}
      />
      {onAppAdmin ? (
        <ProfileMenuRow
          title={String(item.subscription_role || '').toLowerCase() === 'admin' ? 'הסר הרשאת מנהל' : 'הפוך למנהל'}
          icon={ShieldCheck}
          onPress={guard(onAppAdmin)}
        />
      ) : null}
      <ProfileMenuRow title="איפוס סיסמה" icon={KeyRound} onPress={guard(onResetPassword)} />
      <ProfileMenuRow title="מחק" icon={Trash2} danger showDivider={false} onPress={guard(onDelete)} />
    </AdminSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  searchShell: {
    flexDirection: 'row-reverse',
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    ...adminHebrewText,
    ...adminBody,
    padding: 0,
  },
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  countText: {
    ...adminPhysicalRightText,
    fontSize: APP_TYPE.pageTitle.fontSize,
    fontWeight: APP_TYPE.pageTitle.fontWeight,
    lineHeight: APP_TYPE.pageTitle.lineHeight,
    letterSpacing: APP_TYPE.pageTitle.letterSpacing,
    marginBottom: APP_LAYOUT.sectionHeaderToContent,
  },
  userTop: {
    flexDirection: 'row-reverse',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: APP_LAYOUT.cardPadding,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 0,
  },
  userName: {
    ...adminHebrewText,
    ...adminCardTitle,
  },
  userEmail: {
    ...adminHebrewText,
    ...adminCaption,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  rule: {
    height: StyleSheet.hairlineWidth,
  },
  ruleInset: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: APP_LAYOUT.cardPadding,
  },
  tenureBox: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  tenureInputRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
    alignSelf: 'stretch',
  },
  tenureInputShell: {
    flex: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    minHeight: 44,
  },
  introRow: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
    alignItems: 'flex-end',
  },
  introField: {
    ...adminHebrewText,
    ...adminCardTitle,
  },
  introValue: {
    ...adminHebrewText,
    ...adminCardSubtitle,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
});
