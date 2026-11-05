import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { appLocale } from '../../lib/i18n/locale';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  RefreshControl,
  Modal,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Receipt, RefreshCw, Ban, Zap, Search } from 'lucide-react-native';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import UICard from '../../components/ui/UICard';
import DesignTokens, { useDesignTokens } from '../../components/ui/DesignTokens';
import { formFieldShellStyle } from '../../components/ui/formControl';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import {
  adminBody,
  adminCaption,
  adminCaption2,
  adminCardSubtitle,
  adminCardTitle,
  adminHebrewText,
  adminMetric,
  adminMetricLabel,
  adminMetricSecondary,
  adminPhysicalRightText,
} from '../../components/admin/adminType';
import {
  AdminSectionLabel,
  AdminFilterChip,
  AdminSegmentedBar,
  AdminBadge,
  AdminSurface,
  AdminLoadingState,
  AdminErrorState,
  AdminDeniedState,
  AdminEmptyState,
} from '../../components/admin';
import {
  adminService,
  type AdminPaymentTransaction,
  type AdminUserSubscription,
} from '../../services/admin';
import { SUBSCRIPTION_PLANS } from '../../services/paymentService';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useIsAdmin } from '../../hooks/useIsAdmin';

type TabKey = 'history' | 'active' | 'upcoming';

const TX_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s1') },
  { key: 'success', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s2') },
  { key: 'pending_charge', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s3') },
  { key: 'pending', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s4') },
  { key: 'failed', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s5') },
  { key: 'refunded', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s6') },
];

const STATUS_HE: Record<string, string> = {
  success: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s2'),
  pending: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s4'),
  pending_charge: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s3'),
  failed: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s5'),
  refunded: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s6'),
  cancelled: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s7'),
  active: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s8'),
  expired: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s9'),
};

/** סדר: ראשון במערך = ימין (row-reverse) — מנויים פעילים ראשי */
const TABS: { id: TabKey; label: string }[] = [
  { id: 'active', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s10') },
  { id: 'history', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s11') },
  { id: 'upcoming', label: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s12') },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(appLocale());
  } catch {
    return iso;
  }
}

function fmtDay(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(appLocale());
  } catch {
    return iso;
  }
}

function planLabel(planId: string | null | undefined) {
  if (!planId) return '—';
  const known = (SUBSCRIPTION_PLANS as Record<string, { name?: string }>)[planId];
  return known?.name || planId;
}

function planPrice(planId: string | null | undefined): number | null {
  if (!planId) return null;
  const known = (SUBSCRIPTION_PLANS as Record<string, { price?: number }>)[planId];
  return typeof known?.price === 'number' ? known.price : null;
}

function userLabel(user?: { email?: string | null; display_name?: string | null; full_name?: string | null } | null, fallbackId?: string | null) {
  return user?.display_name || user?.full_name || user?.email || (fallbackId ? `${fallbackId.slice(0, 8)}…` : '—');
}

function statusColor(status: string, tokens: ReturnType<typeof useDesignTokens>) {
  switch (status) {
    case 'success':
    case 'active':
      return tokens.colors.primary.main;
    case 'failed':
      return tokens.colors.danger.main;
    case 'refunded':
    case 'cancelled':
    case 'expired':
      return tokens.colors.text.tertiary;
    case 'pending':
    case 'pending_charge':
      return tokens.colors.warning.main;
    default:
      return tokens.colors.secondary.main;
  }
}

export default function AdminPaymentsScreen({ navigation, route }: any) {
  const tokens = useDesignTokens();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();

  const initialTab: TabKey =
    route?.params?.tab === 'history'
      ? 'history'
      : route?.params?.tab === 'upcoming'
        ? 'upcoming'
        : 'active';
  const initialUserId = route?.params?.userId ? String(route.params.userId) : '';
  const initialQuery = route?.params?.query ? String(route.params.query) : '';
  const initialEmail = route?.params?.email ? String(route.params.email) : '';

  const [tab, setTab] = useState<TabKey>(initialTab);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [txRows, setTxRows] = useState<AdminPaymentTransaction[]>([]);
  const [subRows, setSubRows] = useState<AdminUserSubscription[]>([]);
  const [upcomingRows, setUpcomingRows] = useState<AdminUserSubscription[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const [monthSummary, setMonthSummary] = useState({
    total: 0,
    success: 0,
    failed: 0,
    pending: 0,
    revenue: 0,
  });
  const [status, setStatus] = useState('');
  const [query, setQuery] = useState(initialQuery || initialEmail);
  const [userIdFilter] = useState(initialUserId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<Awaited<
    ReturnType<typeof adminService.getPaymentTransaction>
  > | null>(null);

  const loadOverview = useCallback(async () => {
    try {
      const res = await adminService.getBillingOverview({
        userId: userIdFilter || undefined,
      });
      setMonthSummary(res.month);
      setUpcomingRows(res.upcoming);
      return;
    } catch {
      /* fallback below — מסך עדיין שימושי בלי overview */
    }

    try {
      const res = await adminService.listUserSubscriptions({
        page: 1,
        pageSize: 40,
        status: 'active',
        userId: userIdFilter || undefined,
      });
      const horizon = Date.now() + 60 * 864e5;
      const upcoming = res.subscriptions
        .filter((s) => s.auto_renew && s.expires_at && new Date(s.expires_at).getTime() <= horizon)
        .map((s) => ({
          ...s,
          next_cycle_at: s.next_cycle_at || s.expires_at,
        }))
        .sort((a, b) => {
          const ta = a.next_cycle_at ? new Date(a.next_cycle_at).getTime() : 0;
          const tb = b.next_cycle_at ? new Date(b.next_cycle_at).getTime() : 0;
          return ta - tb;
        });
      setUpcomingRows(upcoming);
    } catch {
      /* ignore */
    }
  }, [userIdFilter]);

  const load = useCallback(
    async (opts?: { page?: number; keep?: boolean }) => {
      const nextPage = opts?.page ?? 1;
      try {
        if (!opts?.keep) setError(null);
        if (tab === 'history') {
          const res = await adminService.listPaymentTransactions({
            page: nextPage,
            pageSize: 30,
            status: status || undefined,
            query: query.trim() || undefined,
            userId: userIdFilter || undefined,
          });
          setTxRows(res.transactions);
          setTotal(res.total);
          setPage(res.page);
        } else if (tab === 'active') {
          const res = await adminService.listUserSubscriptions({
            page: nextPage,
            pageSize: 30,
            status: 'active',
            query: query.trim() || undefined,
            userId: userIdFilter || undefined,
          });
          setSubRows(res.subscriptions);
          setTotal(res.total);
          setPage(res.page);
        }
        await loadOverview();
      } catch (e) {
        setError(e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s13'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [tab, status, query, userIdFilter, loadOverview],
  );

  useEffect(() => {
    if (!adminLoading && isAdmin) {
      setLoading(true);
      void load({ page: 1 });
    } else if (!adminLoading && !isAdmin) {
      setLoading(false);
    }
  }, [adminLoading, isAdmin, load]);

  const openDetail = async (id: string) => {
    setDetailId(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await adminService.getPaymentTransaction(id);
      setDetail(res);
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s14'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s15'));
      setDetailId(null);
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async () => {
    if (!detailId) return;
    setDetailLoading(true);
    try {
      setDetail(await adminService.getPaymentTransaction(detailId));
      void load({ page, keep: true });
    } catch (e) {
      legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s14'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s16'));
    } finally {
      setDetailLoading(false);
    }
  };

  const runRefund = () => {
    if (!detailId) return;
    legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s17'), i18n.t('auto.screens__Admin__AdminPaymentsScreen.s18'), [
      { text: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s19'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s20'),
        style: 'destructive',
        onPress: async () => {
          setBusyId(detailId);
          try {
            const res = await adminService.refundPayment(detailId);
            if (!res.success) {
              void HapticFeedback.error();
              legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s14'), res.description || res.error || i18n.t('auto.screens__Admin__AdminPaymentsScreen.s21'));
            } else {
              void HapticFeedback.success();
              legacyAlert(
                i18n.t('auto.screens__Admin__AdminPaymentsScreen.s22'),
                i18n.t('auto.screens__Admin__AdminPaymentsScreen.s23', { v0: res.newDocumentNumber ?? '—', v1: res.newDocumentType ?? '—' }),
              );
            }
            await refreshDetail();
          } catch (e) {
            void HapticFeedback.error();
            legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s14'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s21'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const runCharge = () => {
    if (!detailId) return;
    legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s24'), i18n.t('auto.screens__Admin__AdminPaymentsScreen.s25'), [
      { text: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s19'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Admin__AdminPaymentsScreen.s26'),
        onPress: async () => {
          setBusyId(detailId);
          try {
            const res = await adminService.chargeDeferred(detailId);
            if (!res.success) {
              void HapticFeedback.error();
              legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s14'), res.description || res.error || i18n.t('auto.screens__Admin__AdminPaymentsScreen.s27'));
            } else {
              void HapticFeedback.success();
              legacyAlert(
                i18n.t('auto.screens__Admin__AdminPaymentsScreen.s22'),
                i18n.t('auto.screens__Admin__AdminPaymentsScreen.s28', { v0: res.tranzactionId ?? '—', v1: res.documentNumber ?? '—', v2: res.documentType ?? '—' }),
              );
            }
            await refreshDetail();
          } catch (e) {
            void HapticFeedback.error();
            legacyAlert(i18n.t('auto.screens__Admin__AdminPaymentsScreen.s14'), e instanceof Error ? e.message : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s27'));
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const switchTab = (next: TabKey) => {
    if (next === tab) return;
    setTab(next);
    setStatus('');
    setPage(1);
    setLoading(true);
  };

  const filteredUpcoming = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return upcomingRows;
    return upcomingRows.filter((s) => {
      const email = s.user?.email?.toLowerCase() || '';
      const name = (s.user?.display_name || s.user?.full_name || '').toLowerCase();
      const plan = (s.plan_id || '').toLowerCase();
      return email.includes(q) || name.includes(q) || plan.includes(q) || s.user_id.includes(q);
    });
  }, [upcomingRows, query]);

  const header = (
    <ChatSubScreenHeader
      title={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s29')}
      onBack={() => {
        void HapticFeedback.impactLight();
        navigation.goBack();
      }}
    />
  );

  if (adminLoading || loading) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <AdminLoadingState
          label={
            tab === 'history'
              ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s30')
              : tab === 'active'
                ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s31')
                : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s32')
          }
        />
      </SafeAreaView>
    );
  }

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        {header}
        <AdminDeniedState />
      </SafeAreaView>
    );
  }

  const listPad = {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 48,
    flexGrow: 1,
  } as const;

  const listHeader = (
    <View style={styles.listHeader}>
      <AdminSectionLabel>{i18n.t('auto.screens__Admin__AdminPaymentsScreen.s33')}</AdminSectionLabel>
      <AdminSurface padding="md">
        <View style={styles.kpiFeatured}>
          <Text style={[styles.kpiFeaturedLabel, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Admin__AdminPaymentsScreen.s34')}</Text>
          <Text
            style={[styles.kpiFeaturedValue, { color: tokens.colors.text.primary }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {`₪${monthSummary.revenue.toLocaleString(appLocale())}`}
          </Text>
        </View>

        <View style={styles.kpiRow}>
          <KpiCell label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s35')} value={String(monthSummary.success)} />
          <KpiCell label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s36')} value={String(monthSummary.failed)} />
          <KpiCell label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s37')} value={String(monthSummary.pending)} />
        </View>
      </AdminSurface>

      <View style={styles.tabBarWrap}>
        <AdminSegmentedBar
          options={TABS}
          value={tab}
          onChange={switchTab}
          accessibilityGroupLabel={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s38')}
        />
      </View>

      {userIdFilter ? (
        <Text style={[styles.hint, { color: tokens.colors.warning.main, marginBottom: tokens.spacing.sm }]}>
          {i18n.t('auto.screens__Admin__AdminPaymentsScreen.s39')} {initialEmail || userIdFilter.slice(0, 8)}…
        </Text>
      ) : null}

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
          onSubmitEditing={() => {
            setLoading(true);
            void load({ page: 1 });
          }}
          placeholder={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s40')}
          placeholderTextColor={tokens.colors.text.tertiary}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: tokens.colors.text.primary }]}
        />
        <Search size={18} color={tokens.colors.text.tertiary} strokeWidth={2} />
      </View>

      {tab === 'history' ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
          contentContainerStyle={styles.filterScrollContent}
        >
          {TX_STATUS_FILTERS.map((f) => (
            <AdminFilterChip
              key={`st-${f.key || 'all'}`}
              label={f.label}
              active={status === f.key}
              onPress={() => setStatus(f.key)}
            />
          ))}
        </ScrollView>
      ) : null}

      <Text style={[styles.countText, { color: tokens.colors.text.secondary }]}>
        {tab === 'history'
          ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s41', { v0: total })
          : tab === 'active'
            ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s42', { v0: total })
            : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s43', { v0: filteredUpcoming.length })}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header}

      {error ? (
        <View style={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingTop: tokens.spacing.sm }}>
          <AdminErrorState
            message={error}
            onRetry={() => {
              setLoading(true);
              void load({ page: 1 });
            }}
          />
        </View>
      ) : null}

      {tab === 'history' ? (
        <FlatList
          data={txRows}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={listPad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load({ page });
              }}
              tintColor={tokens.colors.primary.main}
            />
          }
          ListEmptyComponent={
            <AdminEmptyState title={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s44')} subtitle={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s45')} />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.impactLight();
                void openDetail(item.id);
              }}
              activeOpacity={0.8}
            >
              <BillingRowCard
                user={userLabel(item.user, item.user_id)}
                plan={planLabel(item.plan_id)}
                amount={`₪${item.amount}`}
                statusLabel={STATUS_HE[item.status] || item.status}
                statusColor={statusColor(item.status, tokens)}
                dateLabel={fmtDate(item.created_at)}
                nextBillingLabel="—"
                extra={
                  item.cardcom_document_number != null
                    ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s46', { v0: item.cardcom_document_number })
                    : item.hasToken
                      ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s47')
                      : undefined
                }
              />
            </TouchableOpacity>
          )}
          ListFooterComponent={
            total > txRows.length ? (
              <TouchableOpacity
                onPress={() => {
                  setLoading(true);
                  void load({ page: page + 1 });
                }}
                style={styles.loadMore}
              >
                <Text style={[styles.loadMoreText, { color: tokens.colors.primary.main }]}>{i18n.t('auto.screens__Admin__AdminPaymentsScreen.s48')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      ) : tab === 'active' ? (
        <FlatList
          data={subRows}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={listPad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void load({ page });
              }}
              tintColor={tokens.colors.primary.main}
            />
          }
          ListEmptyComponent={
            <AdminEmptyState title={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s49')} subtitle={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s50')} />
          }
          renderItem={({ item }) => {
            const price = planPrice(item.plan_id);
            return (
              <BillingRowCard
                user={userLabel(item.user, item.user_id)}
                plan={planLabel(item.plan_id)}
                amount={price != null ? `₪${price}` : '—'}
                statusLabel={STATUS_HE[item.status] || item.status}
                statusColor={statusColor(item.status, tokens)}
                dateLabel={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s51', { v0: fmtDay(item.starts_at) })}
                nextBillingLabel={
                  item.auto_renew && item.next_cycle_at
                    ? fmtDay(item.next_cycle_at)
                    : item.expires_at
                      ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s52', { v0: fmtDay(item.expires_at) })
                      : '—'
                }
                extra={
                  item.auto_renew
                    ? item.hasToken
                      ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s53')
                      : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s54')
                    : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s55')
                }
              />
            );
          }}
          ListFooterComponent={
            total > subRows.length ? (
              <TouchableOpacity
                onPress={() => {
                  setLoading(true);
                  void load({ page: page + 1 });
                }}
                style={styles.loadMore}
              >
                <Text style={[styles.loadMoreText, { color: tokens.colors.primary.main }]}>{i18n.t('auto.screens__Admin__AdminPaymentsScreen.s48')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      ) : (
        <FlatList
          data={filteredUpcoming}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={listHeader}
          contentContainerStyle={listPad}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadOverview().finally(() => setRefreshing(false));
              }}
              tintColor={tokens.colors.primary.main}
            />
          }
          ListEmptyComponent={
            <AdminEmptyState
              title={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s56')}
              subtitle={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s57')}
            />
          }
          renderItem={({ item }) => {
            const price = planPrice(item.plan_id);
            return (
              <BillingRowCard
                user={userLabel(item.user, item.user_id)}
                plan={planLabel(item.plan_id)}
                amount={price != null ? `₪${price}` : '—'}
                statusLabel={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s58')}
                statusColor={tokens.colors.warning.main}
                dateLabel={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s52', { v0: fmtDay(item.expires_at) })}
                nextBillingLabel={fmtDay(item.next_cycle_at || item.expires_at)}
                extra={item.hasToken ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s59') : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s60')}
              />
            );
          }}
        />
      )}

      <Modal
        visible={!!detailId}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setDetailId(null)}
      >
        <SafeAreaView style={[styles.root, styles.modalRoot]} edges={['top', 'bottom']}>
          <ChatSubScreenHeader
            title={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s61')}
            onBack={() => {
              setDetailId(null);
              setDetail(null);
            }}
          />
          {detailLoading || !detail ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              <ActivityIndicator color={tokens.colors.primary.main} />
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalScroll}>
              <AdminSectionLabel>{i18n.t('auto.screens__Admin__AdminPaymentsScreen.s62')}</AdminSectionLabel>
              <UICard
                variant="soft"
                padding="md"
                style={{ marginBottom: APP_LAYOUT.cardStackGap }}
              >
                <DetailLine label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s63')} value={detail.user?.email || detail.transaction.user_id || '—'} />
                <DetailLine label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s64')} value={planLabel(detail.transaction.plan_id)} />
                <DetailLine label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s65')} value={`₪${detail.transaction.amount}`} />
                <DetailLine
                  label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s66')}
                  value={STATUS_HE[detail.transaction.status] || detail.transaction.status}
                />
                <DetailLine label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s67')} value={fmtDate(detail.transaction.created_at)} />
                <DetailLine
                  label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s68')}
                  value={
                    detail.transaction.cardcom_document_number != null
                      ? `${detail.transaction.cardcom_document_number} (${detail.transaction.cardcom_document_type || '—'})`
                      : '—'
                  }
                />
                <DetailLine
                  label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s47')}
                  value={detail.transaction.cardcom_token_present || detail.transaction.hasToken ? i18n.t('auto.screens__Admin__AdminPaymentsScreen.s69') : i18n.t('auto.screens__Admin__AdminPaymentsScreen.s70')}
                />
                <DetailLine label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s71')} value={detail.transaction.id} />
              </UICard>

              <AdminSectionLabel>{i18n.t('auto.screens__Admin__AdminPaymentsScreen.s72')}</AdminSectionLabel>
              <View style={styles.actionsCol}>
                <ActionButton
                  icon={Ban}
                  label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s17')}
                  disabled={!detail.actions.canRefund || busyId === detailId}
                  busy={busyId === detailId}
                  onPress={runRefund}
                  color={tokens.colors.danger.main}
                />
                <ActionButton
                  icon={Zap}
                  label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s24')}
                  disabled={!detail.actions.canChargeDeferred || busyId === detailId}
                  busy={busyId === detailId}
                  onPress={runCharge}
                  color={tokens.colors.primary.main}
                />
                <ActionButton
                  icon={RefreshCw}
                  label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s73')}
                  disabled={busyId === detailId}
                  busy={false}
                  onPress={() => void refreshDetail()}
                  color={tokens.colors.text.secondary}
                />
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function KpiCell({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.kpiCell}>
      <Text style={[styles.kpiLabel, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
        {label}
      </Text>
      <Text
        style={[styles.kpiValue, { color: tokens.colors.text.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>
    </View>
  );
}

function BillingRowCard({
  user,
  plan,
  amount,
  statusLabel,
  statusColor: badgeColor,
  dateLabel,
  nextBillingLabel,
  extra,
}: {
  user: string;
  plan: string;
  amount: string;
  statusLabel: string;
  statusColor: string;
  dateLabel: string;
  nextBillingLabel: string;
  extra?: string;
}) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="soft"
      padding="md"
      style={{ marginBottom: APP_LAYOUT.cardStackGap }}
    >
      <View style={styles.rowTop}>
        <Text
          style={[styles.rowUser, { color: tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          {user}
        </Text>
        <AdminBadge label={statusLabel} color={badgeColor} />
      </View>

      <View style={styles.metaGrid}>
        <MetaPair label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s64')} value={plan} />
        <MetaPair label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s65')} value={amount} emphasize />
        <MetaPair label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s67')} value={dateLabel} />
        <MetaPair label={i18n.t('auto.screens__Admin__AdminPaymentsScreen.s74')} value={nextBillingLabel} />
      </View>

      {extra ? (
        <Text style={[styles.hint, { color: tokens.colors.text.muted, marginTop: 8 }]}>
          {extra}
        </Text>
      ) : null}
    </UICard>
  );
}

function MetaPair({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.metaPair}>
      <Text style={[styles.metaLabel, { color: tokens.colors.text.tertiary }]}>{label}</Text>
      <Text
        style={[
          styles.metaValue,
          { color: emphasize ? tokens.colors.primary.main : tokens.colors.text.primary },
        ]}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function DetailLine({ label, value }: { label: string; value: string }) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.detailLine}>
      <Text style={[styles.detailLabel, { color: tokens.colors.text.tertiary }]}>{label}</Text>
      <Text selectable style={[styles.detailValue, { color: tokens.colors.text.primary }]}>
        {value}
      </Text>
    </View>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onPress,
  disabled,
  busy,
  color,
}: {
  icon: typeof Receipt;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  color: string;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.8}
      style={[
        styles.actionBtn,
        {
          borderColor: `${color}55`,
          backgroundColor: `${color}18`,
          opacity: disabled ? 0.4 : 1,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={color} />
      ) : (
        <>
          <Icon size={18} color={color} strokeWidth={2.4} />
          <Text style={[styles.actionBtnLabel, { color }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  modalRoot: {
    backgroundColor: 'transparent',
  },
  modalScroll: {
    padding: DesignTokens.spacing.md,
    paddingBottom: 32,
  },
  listHeader: {
    marginBottom: 4,
  },
  tabBarWrap: {
    marginBottom: APP_LAYOUT.cardStackGap,
  },
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
  filterScroll: {
    direction: 'rtl',
    marginBottom: DesignTokens.spacing.md,
  },
  filterScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
  },
  kpiFeatured: {
    width: '100%',
    alignItems: 'flex-end',
  },
  kpiFeaturedLabel: {
    ...adminPhysicalRightText,
    ...adminMetricLabel,
  },
  kpiFeaturedValue: {
    ...adminPhysicalRightText,
    ...adminMetric,
    marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
    fontVariant: ['tabular-nums'],
  },
  kpiRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
  },
  kpiCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  kpiValue: {
    ...adminMetricSecondary,
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  kpiLabel: {
    ...adminMetricLabel,
    textAlign: 'center',
    writingDirection: TEXT_DIR,
  },
  countText: {
    ...adminHebrewText,
    ...adminCaption,
    marginBottom: APP_LAYOUT.stackGapSmall,
  },
  rowTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  rowUser: {
    ...adminHebrewText,
    ...adminCardTitle,
    flex: 1,
    minWidth: 0,
  },
  metaGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaPair: {
    width: '47%',
    minWidth: 0,
  },
  metaLabel: {
    ...adminHebrewText,
    ...adminCaption2,
  },
  metaValue: {
    ...adminHebrewText,
    ...adminCardSubtitle,
    marginTop: 2,
  },
  detailLine: {
    marginBottom: 10,
  },
  detailLabel: {
    ...adminHebrewText,
    ...adminCaption2,
  },
  detailValue: {
    ...adminHebrewText,
    ...adminBody,
    marginTop: 2,
  },
  actionsCol: {
    gap: 10,
  },
  actionBtn: {
    borderWidth: 0,
    borderRadius: 999,
    paddingVertical: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnLabel: {
    ...adminHebrewText,
    ...adminBody,
  },
  loadMore: {
    padding: 14,
    alignItems: 'center',
  },
  loadMoreText: {
    ...adminHebrewText,
    ...adminCardTitle,
  },
  hint: {
    ...adminHebrewText,
    ...adminCaption,
  },
});
