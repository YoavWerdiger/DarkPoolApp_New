import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import UICard from '../../components/ui/UICard';
import DesignTokens, { useDesignTokens } from '../../components/ui/DesignTokens';
import {
  AdminSectionLabel,
  AdminFilterChip,
  AdminBadge,
  AdminLoadingState,
  AdminEmptyState,
} from '../../components/admin';
import {
  adminService,
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
];

export default function AdminUsersScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<AdminUserFilter>('all');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true);
    try {
      const res = await adminService.listUsers({ query, filter, page: 1, pageSize: 40 });
      setUsers(res.users);
      setTotal(res.total);
    } catch (e) {
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'טעינת משתמשים נכשלה');
    } finally {
      setLoading(false);
    }
  }, [query, filter]);

  useEffect(() => {
    const t = setTimeout(() => {
      void load();
    }, query ? 320 : 0);
    return () => clearTimeout(t);
  }, [load, query]);

  const patchUserLocally = (userId: string, patch: Partial<AdminUserRow>) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...patch } : u)));
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

      <View style={{ paddingHorizontal: tokens.spacing.base, paddingTop: tokens.spacing.sm }}>
        <UICard
          variant="inputGlass"
          padding="none"
          style={{
            borderRadius: tokens.borderRadius.xl,
            marginBottom: tokens.spacing.md,
            borderWidth: 1,
            borderColor: chatPalette.glassBorder,
          }}
        >
          <View style={styles.searchRow}>
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
            <Search size={18} color={tokens.colors.text.tertiary} strokeWidth={2.2} />
          </View>
        </UICard>

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

        <View style={styles.countRow}>
          <Text style={[styles.countText, { color: tokens.colors.text.tertiary }]}>
            {total} משתמשים
          </Text>
          <AdminSectionLabel style={{ marginBottom: 0 }}>רשימה</AdminSectionLabel>
        </View>
      </View>

      {loading ? (
        <AdminLoadingState label="טוען משתמשים..." />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: tokens.spacing.base,
            paddingTop: 4,
            paddingBottom: 48,
          }}
          ListEmptyComponent={
            <AdminEmptyState
              title="לא נמצאו משתמשים"
              subtitle="נסו לשנות את החיפוש או הסינון"
            />
          }
          renderItem={({ item }) => {
            const name = item.display_name || item.full_name || 'משתמש';
            const busy = busyId === item.id;
            const introRows = formatIntroDataRows(item.intro_data);
            return (
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="none"
                style={{
                  marginBottom: 10,
                  borderRadius: tokens.borderRadius.xl,
                  borderWidth: 1,
                  borderColor: chatPalette.glassBorder,
                  padding: tokens.spacing.md,
                }}
              >
                <View style={styles.userTop}>
                  {item.profile_picture ? (
                    <Image source={{ uri: item.profile_picture }} style={styles.avatar} />
                  ) : (
                    <View
                      style={[
                        styles.avatar,
                        {
                          backgroundColor: tokens.colors.primary.dim,
                          borderColor: `${tokens.colors.primary.main}44`,
                          alignItems: 'center',
                          justifyContent: 'center',
                        },
                      ]}
                    >
                      <Text style={{ color: tokens.colors.primary.main, fontWeight: '800', fontSize: 16 }}>
                        {name.charAt(0)}
                      </Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.userName, { color: tokens.colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={[styles.userEmail, { color: tokens.colors.text.tertiary }]}
                      numberOfLines={1}
                    >
                      {item.email}
                    </Text>
                    <View style={styles.badgeRow}>
                      <AdminBadge
                        label={roleLabel(item.subscription_role)}
                        color={roleColor(item.subscription_role)}
                      />
                      {item.is_muted ? (
                        <AdminBadge label="מושתק" color={tokens.colors.danger.main} />
                      ) : null}
                      {item.is_suspended ? (
                        <AdminBadge label="מושעה" color={tokens.colors.warning.main} />
                      ) : null}
                    </View>
                  </View>
                </View>

                {introRows.length > 0 ? (
                  <View
                    style={[
                      styles.introBlock,
                      { borderTopColor: tokens.colors.border.divider },
                    ]}
                  >
                    <Text
                      style={[
                        styles.introTitle,
                        { color: tokens.colors.text.tertiary },
                      ]}
                    >
                      שאלון קליטה
                    </Text>
                    {introRows.map((row) => (
                      <View key={row.key} style={styles.introRow}>
                        <Text
                          style={[styles.introField, { color: tokens.colors.text.tertiary }]}
                        >
                          {row.fieldLabel}
                        </Text>
                        <Text
                          style={[styles.introValue, { color: tokens.colors.text.primary }]}
                          numberOfLines={2}
                        >
                          {row.valueLabel}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}

                <View style={[styles.actionsRow, { borderTopColor: tokens.colors.border.divider }]}>
                  <ActionBtn
                    busy={busy}
                    active={item.is_muted}
                    activeLabel="בטל השתקה"
                    idleLabel="השתק"
                    variant={item.is_muted ? 'glass' : 'destructive'}
                    onPress={() => confirmMute(item)}
                  />
                  <ActionBtn
                    busy={busy}
                    active={item.is_suspended}
                    activeLabel="בטל השעיה"
                    idleLabel="השעה"
                    variant={item.is_suspended ? 'glass' : 'warning'}
                    onPress={() => confirmSuspend(item)}
                  />
                </View>

                <View style={styles.secondaryActions}>
                  <PillBtn
                    busy={busy}
                    label="תשלומים ומנויים"
                    variant="glass"
                    onPress={() => {
                      void HapticFeedback.impactLight();
                      navigation.navigate('AdminPayments', {
                        userId: item.id,
                        email: item.email,
                        tab: 'active',
                      });
                    }}
                  />
                  <PillBtn
                    busy={busy}
                    label={isPremiumRole(item.subscription_role) ? 'הסר פרימיום' : 'הענק פרימיום'}
                    variant={isPremiumRole(item.subscription_role) ? 'destructive' : 'primary'}
                    onPress={() => confirmPremium(item)}
                  />
                  <PillBtn
                    busy={busy}
                    label="איפוס סיסמה"
                    variant="glass"
                    onPress={() => confirmResetPassword(item)}
                  />
                  <PillBtn
                    busy={busy}
                    label="מחק"
                    variant="destructive"
                    onPress={() => confirmDelete(item)}
                  />
                </View>
              </UICard>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

type ActionVariant = 'primary' | 'glass' | 'destructive' | 'warning';

function resolveActionColors(variant: ActionVariant, tokens: ReturnType<typeof useDesignTokens>) {
  switch (variant) {
    case 'primary':
      return {
        color: tokens.colors.primary.main,
        border: `${tokens.colors.primary.main}66`,
        bg: tokens.colors.primary.dim,
      };
    case 'destructive':
      return {
        color: tokens.colors.danger.main,
        border: `${tokens.colors.danger.main}55`,
        bg: `${tokens.colors.danger.main}14`,
      };
    case 'warning':
      return {
        color: tokens.colors.warning.main,
        border: `${tokens.colors.warning.main}55`,
        bg: `${tokens.colors.warning.main}14`,
      };
    case 'glass':
    default:
      return {
        color: tokens.colors.text.secondary,
        border: chatPalette.glassBorder,
        bg: 'rgba(255,255,255,0.04)',
      };
  }
}

function ActionBtn({
  busy,
  active,
  activeLabel,
  idleLabel,
  variant,
  onPress,
}: {
  busy: boolean;
  active: boolean;
  activeLabel: string;
  idleLabel: string;
  variant: ActionVariant;
  onPress: () => void;
}) {
  const tokens = useDesignTokens();
  const colors = resolveActionColors(variant, tokens);
  return (
    <TouchableOpacity
      disabled={busy}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.actionBtn,
        {
          borderColor: colors.border,
          backgroundColor: active ? `${colors.color}22` : colors.bg,
          opacity: busy ? 0.5 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.color} />
      ) : (
        <Text style={{ color: colors.color, fontWeight: '700', fontSize: 13 }}>
          {active ? activeLabel : idleLabel}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function PillBtn({
  busy,
  label,
  variant,
  onPress,
}: {
  busy: boolean;
  label: string;
  variant: ActionVariant;
  onPress: () => void;
}) {
  const tokens = useDesignTokens();
  const colors = resolveActionColors(variant, tokens);
  return (
    <TouchableOpacity
      disabled={busy}
      onPress={onPress}
      activeOpacity={0.75}
      style={[
        styles.pillBtn,
        {
          borderColor: colors.border,
          backgroundColor: colors.bg,
          opacity: busy ? 0.5 : 1,
        },
      ]}
    >
      <Text style={{ color: colors.color, fontWeight: '700', fontSize: 12 }} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  searchRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    ...DesignTokens.rtlText,
    fontSize: 15,
    padding: 0,
  },
  filters: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  countRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    ...DesignTokens.rtlText,
  },
  userTop: {
    flexDirection: 'row-reverse',
    gap: 12,
    alignItems: 'center',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  userName: {
    fontWeight: '700',
    ...DesignTokens.rtlText,
    fontSize: 15,
  },
  userEmail: {
    textAlign: 'right',
    fontSize: 12,
    marginTop: 2,
  },
  badgeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  introBlock: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 6,
  },
  introTitle: {
    ...DesignTokens.rtlText,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  introRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  introField: {
    fontSize: 12,
    fontWeight: '600',
    ...DesignTokens.rtlText,
    flexShrink: 0,
  },
  introValue: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: DesignTokens.borderRadius.button,
    paddingVertical: 11,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 42,
  },
  secondaryActions: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  pillBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.borderRadius.button,
    paddingVertical: 9,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
});
