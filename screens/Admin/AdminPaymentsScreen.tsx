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
import { chatPalette } from '../../components/chat/chatDesignTokens';
import UICard from '../../components/ui/UICard';
import DesignTokens, { useDesignTokens } from '../../components/ui/DesignTokens';
import {
  AdminSectionLabel,
  AdminFilterChip,
  AdminBadge,
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
import { MarketsEmbedSwitcher } from '../Markets/components/MarketsEmbedSwitcher';
import type { SegmentedOption } from '../Markets/components/MarketsSegmentedControl';
import { legacyAlert } from '../../utils/appDialog';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useIsAdmin } from '../../hooks/useIsAdmin';

type TabKey = 'history' | 'active' | 'upcoming';

const TX_STATUS_FILTERS: { key: string; label: string }[] = [
  { key: '', label: 'הכל' },
  { key: 'success', label: 'שולם' },
  { key: 'pending_charge', label: 'ממתין לחיוב' },
  { key: 'pending', label: 'ממתין' },
  { key: 'failed', label: 'נכשל' },
  { key: 'refunded', label: 'הוחזר' },
];

const STATUS_HE: Record<string, string> = {
  success: 'שולם',
  pending: 'ממתין',
  pending_charge: 'ממתין לחיוב',
  failed: 'נכשל',
  refunded: 'הוחזר',
  cancelled: 'בוטל',
  active: 'פעיל',
  expired: 'פג תוקף',
};

/** סדר: ראשון במערך = ימין (row-reverse ב־MarketsEmbedSwitcher) — מנויים פעילים ראשי */
const TABS: SegmentedOption<TabKey>[] = [
  { id: 'active', label: 'מנויים פעילים' },
  { id: 'history', label: 'היסטוריית תשלומים' },
  { id: 'upcoming', label: 'חיובים קרובים' },
];

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('he-IL');
  } catch {
    return iso;
  }
}

function fmtDay(iso: string | null | undefined) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('he-IL');
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
  const [activeCount, setActiveCount] = useState(0);

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
      setActiveCount(res.activeSubscriptions);
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
      setActiveCount(res.total);
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
        setError(e instanceof Error ? e.message : 'שגיאה בטעינה');
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
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'טעינה נכשלה');
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
      legacyAlert('שגיאה', e instanceof Error ? e.message : 'רענון נכשל');
    } finally {
      setDetailLoading(false);
    }
  };

  const runRefund = () => {
    if (!detailId) return;
    legacyAlert('החזר מלא', 'לבצע ביטול מסמך (CancelDoc) והחזר מלא?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'החזר',
        style: 'destructive',
        onPress: async () => {
          setBusyId(detailId);
          try {
            const res = await adminService.refundPayment(detailId);
            if (!res.success) {
              void HapticFeedback.error();
              legacyAlert('שגיאה', res.description || res.error || 'ההחזר נכשל');
            } else {
              void HapticFeedback.success();
              legacyAlert(
                'הצלחה',
                `החזר בוצע.\nמסמך חדש: ${res.newDocumentNumber ?? '—'} (${res.newDocumentType ?? '—'})`,
              );
            }
            await refreshDetail();
          } catch (e) {
            void HapticFeedback.error();
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'ההחזר נכשל');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const runCharge = () => {
    if (!detailId) return;
    legacyAlert('חיוב דחוי', 'לבצע Charge עם הטוקן השמור?', [
      { text: 'ביטול', style: 'cancel' },
      {
        text: 'חייב',
        onPress: async () => {
          setBusyId(detailId);
          try {
            const res = await adminService.chargeDeferred(detailId);
            if (!res.success) {
              void HapticFeedback.error();
              legacyAlert('שגיאה', res.description || res.error || 'החיוב נכשל');
            } else {
              void HapticFeedback.success();
              legacyAlert(
                'הצלחה',
                `חויב בהצלחה.\nTranzactionId: ${res.tranzactionId ?? '—'}\nמסמך: ${res.documentNumber ?? '—'} (${res.documentType ?? '—'})`,
              );
            }
            await refreshDetail();
          } catch (e) {
            void HapticFeedback.error();
            legacyAlert('שגיאה', e instanceof Error ? e.message : 'החיוב נכשל');
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
      title="בקרת תשלומים ומנויים"
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
              ? 'טוען היסטוריית תשלומים...'
              : tab === 'active'
                ? 'טוען מנויים פעילים...'
                : 'טוען חיובים קרובים...'
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
    paddingHorizontal: tokens.spacing.md,
    paddingTop: tokens.spacing.sm,
    paddingBottom: 48,
    flexGrow: 1,
  } as const;

  const listHeader = (
    <View style={styles.listHeader}>
      <AdminSectionLabel>סיכום החודש</AdminSectionLabel>
      <UICard
        variant="glass"
        glassIntensity="light"
        padding="md"
        style={{
          borderRadius: tokens.borderRadius.xl,
          borderWidth: 1,
          borderColor: chatPalette.glassBorder,
          marginBottom: tokens.spacing.md,
        }}
      >
        <View style={styles.kpiFeatured}>
          <Text style={[styles.kpiFeaturedLabel, { color: tokens.colors.text.tertiary }]}>
            הכנסה
          </Text>
          <Text
            style={[styles.kpiFeaturedValue, { color: tokens.colors.primary.main }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
          >
            {`₪${monthSummary.revenue.toLocaleString('he-IL')}`}
          </Text>
          <View style={styles.kpiMetaRow}>
            <Text style={[styles.kpiMeta, { color: tokens.colors.text.tertiary }]}>
              {monthSummary.total} חיובים החודש
            </Text>
            <Text style={[styles.kpiMetaDot, { color: tokens.colors.text.muted }]}>·</Text>
            <Text style={[styles.kpiMeta, { color: tokens.colors.primary.main }]}>
              {activeCount} מנויים פעילים
            </Text>
          </View>
        </View>

        <View style={[styles.kpiDivider, { backgroundColor: tokens.colors.border.divider }]} />

        <View style={styles.kpiRow}>
          <KpiCell label="שולמו" value={String(monthSummary.success)} />
          <KpiCell label="נכשלו" value={String(monthSummary.failed)} />
          <KpiCell label="ממתינים" value={String(monthSummary.pending)} />
        </View>
      </UICard>

      <View style={styles.tabBarWrap} accessibilityRole="tablist">
        <MarketsEmbedSwitcher
          options={TABS}
          value={tab}
          onChange={switchTab}
          accessibilityGroupLabel="בקרת תשלומים"
        />
      </View>

      {userIdFilter ? (
        <Text style={[styles.hint, { color: tokens.colors.warning.main, fontSize: 12, marginBottom: tokens.spacing.sm }]}>
          מסונן לפי משתמש: {initialEmail || userIdFilter.slice(0, 8)}…
        </Text>
      ) : null}

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
            onSubmitEditing={() => {
              setLoading(true);
              void load({ page: 1 });
            }}
            placeholder="חיפוש לפי אימייל / שם / מסלול"
            placeholderTextColor={tokens.colors.text.tertiary}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            style={[styles.searchInput, { color: tokens.colors.text.primary }]}
          />
          <Search size={18} color={tokens.colors.text.tertiary} strokeWidth={2.2} />
        </View>
      </UICard>

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

      <View style={styles.countRow}>
        <AdminSectionLabel style={styles.sectionLabelInline}>
          {tab === 'history' ? 'היסטוריה' : tab === 'active' ? 'מנויים פעילים' : 'מחזורי חיוב'}
        </AdminSectionLabel>
        <Text
          style={[
            styles.countText,
            {
              color:
                tab === 'active'
                  ? tokens.colors.primary.main
                  : tokens.colors.text.tertiary,
              fontWeight: tab === 'active' ? '700' : '600',
            },
          ]}
        >
          {tab === 'history'
            ? `${total} תשלומים`
            : tab === 'active'
              ? `${total} מנויים פעילים`
              : `${filteredUpcoming.length} חיובים קרובים (עד 60 יום)`}
        </Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {header}

      {error ? (
        <View style={{ paddingHorizontal: tokens.spacing.md, paddingTop: tokens.spacing.sm }}>
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
            <AdminEmptyState title="אין תשלומים" subtitle="עדיין לא נרשמו חיובים" />
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
                    ? `מסמך ${item.cardcom_document_number}`
                    : item.hasToken
                      ? 'טוקן שמור'
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
                <Text style={[styles.loadMoreText, { color: tokens.colors.primary.main }]}>טען עוד</Text>
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
            <AdminEmptyState title="אין מנויים פעילים" subtitle="אין רשומות פעילות כרגע" />
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
                dateLabel={`התחלה ${fmtDay(item.starts_at)}`}
                nextBillingLabel={
                  item.auto_renew && item.next_cycle_at
                    ? fmtDay(item.next_cycle_at)
                    : item.expires_at
                      ? `תפוגה ${fmtDay(item.expires_at)}`
                      : '—'
                }
                extra={
                  item.auto_renew
                    ? item.hasToken
                      ? 'חידוש אוטומטי · טוקן'
                      : 'חידוש אוטומטי'
                    : 'ללא חידוש אוטומטי'
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
                <Text style={[styles.loadMoreText, { color: tokens.colors.primary.main }]}>טען עוד</Text>
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
              title="אין חיובים קרובים"
              subtitle="אין מנויים עם חידוש אוטומטי ב־60 הימים הקרובים"
            />
          }
          renderItem={({ item }) => {
            const price = planPrice(item.plan_id);
            return (
              <BillingRowCard
                user={userLabel(item.user, item.user_id)}
                plan={planLabel(item.plan_id)}
                amount={price != null ? `₪${price}` : '—'}
                statusLabel="לחיוב בקרוב"
                statusColor={tokens.colors.warning.main}
                dateLabel={`תפוגה ${fmtDay(item.expires_at)}`}
                nextBillingLabel={fmtDay(item.next_cycle_at || item.expires_at)}
                extra={item.hasToken ? 'טוקן מוכן לחיוב' : 'חסר טוקן'}
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
            title="פרטי תשלום"
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
              <AdminSectionLabel>סיכום</AdminSectionLabel>
              <UICard
                variant="glass"
                glassIntensity="light"
                padding="md"
                style={{
                  borderRadius: tokens.borderRadius.xl,
                  borderWidth: 1,
                  borderColor: chatPalette.glassBorder,
                  marginBottom: tokens.spacing.md,
                }}
              >
                <DetailLine label="משתמש" value={detail.user?.email || detail.transaction.user_id || '—'} />
                <DetailLine label="מסלול" value={planLabel(detail.transaction.plan_id)} />
                <DetailLine label="סכום" value={`₪${detail.transaction.amount}`} />
                <DetailLine
                  label="סטטוס"
                  value={STATUS_HE[detail.transaction.status] || detail.transaction.status}
                />
                <DetailLine label="תאריך" value={fmtDate(detail.transaction.created_at)} />
                <DetailLine
                  label="מסמך"
                  value={
                    detail.transaction.cardcom_document_number != null
                      ? `${detail.transaction.cardcom_document_number} (${detail.transaction.cardcom_document_type || '—'})`
                      : '—'
                  }
                />
                <DetailLine
                  label="טוקן שמור"
                  value={detail.transaction.cardcom_token_present || detail.transaction.hasToken ? 'כן' : 'לא'}
                />
                <DetailLine label="מזהה עסקה" value={detail.transaction.id} />
              </UICard>

              <AdminSectionLabel>פעולות</AdminSectionLabel>
              <View style={styles.actionsCol}>
                <ActionButton
                  icon={Ban}
                  label="החזר מלא"
                  disabled={!detail.actions.canRefund || busyId === detailId}
                  busy={busyId === detailId}
                  onPress={runRefund}
                  color={tokens.colors.danger.main}
                />
                <ActionButton
                  icon={Zap}
                  label="חיוב דחוי"
                  disabled={!detail.actions.canChargeDeferred || busyId === detailId}
                  busy={busyId === detailId}
                  onPress={runCharge}
                  color={tokens.colors.primary.main}
                />
                <ActionButton
                  icon={RefreshCw}
                  label="רענון"
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
      <Text
        style={[styles.kpiValue, { color: tokens.colors.text.primary }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
      >
        {value}
      </Text>
      <Text style={[styles.kpiLabel, { color: tokens.colors.text.tertiary }]} numberOfLines={1}>
        {label}
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
      variant="glass"
      glassIntensity="light"
      padding="md"
      style={{
        borderRadius: tokens.borderRadius.xl,
        borderWidth: 1,
        borderColor: chatPalette.glassBorder,
        marginBottom: 10,
      }}
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
        <MetaPair label="מסלול" value={plan} />
        <MetaPair label="סכום" value={amount} emphasize />
        <MetaPair label="תאריך" value={dateLabel} />
        <MetaPair label="חיוב הבא" value={nextBillingLabel} />
      </View>

      {extra ? (
        <Text style={[styles.hint, { color: tokens.colors.text.muted, marginTop: 8, fontSize: 12 }]}>
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
    backgroundColor: '#0A0E0A',
  },
  modalScroll: {
    padding: DesignTokens.spacing.md,
    paddingBottom: 32,
  },
  listHeader: {
    marginBottom: 4,
  },
  sectionLabelInline: {
    marginBottom: 0,
  },
  tabBarWrap: {
    marginBottom: DesignTokens.spacing.md,
  },
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
    alignItems: 'flex-end',
    gap: 4,
  },
  kpiFeaturedLabel: {
    fontSize: 12,
    fontWeight: '600',
    ...DesignTokens.rtlText,
  },
  kpiFeaturedValue: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    ...DesignTokens.rtlText,
  },
  kpiRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: 10,
  },
  kpiCell: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    ...DesignTokens.rtlText,
  },
  kpiLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  kpiDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  kpiMetaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 2,
  },
  kpiMeta: {
    fontSize: 12,
    fontWeight: '700',
    ...DesignTokens.rtlText,
  },
  kpiMetaDot: {
    fontSize: 12,
  },
  countRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: DesignTokens.spacing.sm,
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    ...DesignTokens.rtlText,
  },
  rowTop: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  rowUser: {
    fontWeight: '800',
    fontSize: 15,
    flex: 1,
    minWidth: 0,
    ...DesignTokens.rtlText,
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
    fontSize: 11,
    ...DesignTokens.rtlText,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
    ...DesignTokens.rtlText,
  },
  detailLine: {
    marginBottom: 10,
  },
  detailLabel: {
    fontSize: 11,
    ...DesignTokens.rtlText,
  },
  detailValue: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '600',
    ...DesignTokens.rtlText,
  },
  actionsCol: {
    gap: 10,
  },
  actionBtn: {
    borderWidth: 1,
    borderRadius: DesignTokens.borderRadius.button,
    paddingVertical: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  actionBtnLabel: {
    fontWeight: '800',
    fontSize: 15,
    ...DesignTokens.rtlText,
  },
  loadMore: {
    padding: 14,
    alignItems: 'center',
  },
  loadMoreText: {
    fontWeight: '700',
    ...DesignTokens.rtlText,
  },
  hint: {
    ...DesignTokens.rtlText,
    lineHeight: 18,
  },
});
