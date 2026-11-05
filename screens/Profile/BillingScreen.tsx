import i18n from '../../lib/i18n';
import { appLocale } from '../../lib/i18n/locale';
import { legacyAlert, showAppConfirm } from '../../utils/appDialog';
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowLeftRight,
  BadgeCheck,
  Ban,
  Calendar,
  CreditCard,
  Layers,
  Receipt,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react-native';
import { ChevronLeft } from '../../lib/i18n/dirIcons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import {
  paymentService,
  isSubscriptionCheckoutEnabled,
  type PaymentHistoryItem,
} from '../../services/paymentService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  SettingsGlassCard,
  SettingsSectionTitle,
} from '../../components/profile/ProfileSettingsUI';
import {
  settingsBodyType,
  settingsHebrewText,
  settingsMetaType,
  settingsRowSubtitleStyle,
  settingsRowType,
} from '../../components/profile/settingsType';
import { cardcomDocumentTypeLabelHe } from '../../utils/cardcomDocumentLabels';
import {
  formatBillingDateHe,
  formatPaymentMethodLabel,
  formatPlanPriceHe,
  isInactiveSubscriptionStatus,
  isPaidSubscriptionActive,
  resolveNextBilling,
  subscriptionStatusLabelHe,
  type NextBillingInfo,
} from '../../utils/billingDisplay';
import { appQueryKeys } from '../../lib/appQueryKeys';

export default function BillingScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    planName,
    planId,
    isPremium,
    isLoading: subLoading,
    status,
    expiresAt,
    autoRenew,
    cardLast4,
    cardBrand,
    hasPaymentToken,
    planPrice,
    planPeriod,
    refetch: refetchSub,
  } = useSubscription();

  const checkoutReady = isSubscriptionCheckoutEnabled();
  const userId = user?.id;

  const historyQuery = useQuery({
    queryKey: appQueryKeys.userPaymentHistory(userId ?? 'anon'),
    queryFn: () => paymentService.getPaymentHistory(userId as string),
    enabled: !!userId,
    staleTime: 60 * 1000,
  });

  const history = historyQuery.data ?? [];
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const isPaidActive = isPaidSubscriptionActive({ planId, status, isPremium });
  const isInactivePaid =
    Boolean(planId && planId !== 'free') && isInactiveSubscriptionStatus(status);
  const showSubscriptionCard = isPaidActive || isInactivePaid;

  const statusLabel = subscriptionStatusLabelHe(status, isPaidActive);
  const priceLabel = formatPlanPriceHe(planPrice, planPeriod);
  const nextBilling = resolveNextBilling({
    expiresAt,
    autoRenew,
    isPaidActive,
    status,
  });
  const paymentMethodLabel = formatPaymentMethodLabel({
    last4: cardLast4,
    brand: cardBrand,
    hasToken: hasPaymentToken,
  });

  const planValue = planTrackLabel(planId, planName, showSubscriptionCard);
  const goToPlans = () => {
    void HapticFeedback.medium();
    navigation.navigate('SubscriptionPlans');
  };
  const planActionLabel = isPaidActive
    ? i18n.t('auto.screens__Profile__BillingScreen.s1')
    : isInactivePaid
      ? i18n.t('auto.screens__Profile__BillingScreen.s2')
      : i18n.t('auto.screens__Profile__BillingScreen.s3');
  const planNote = !showSubscriptionCard
    ? i18n.t('auto.screens__Profile__BillingScreen.s4')
    : isInactivePaid && checkoutReady
      ? i18n.t('auto.screens__Profile__BillingScreen.s5')
      : null;

  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      refetchSub();
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.userPaymentHistory(userId),
        }),
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.userSubscription(userId),
        }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [userId, refetchSub, queryClient]);

  const openInvoice = async (tx: PaymentHistoryItem) => {
    void HapticFeedback.impactLight();
    const existing = (tx.document_url || tx.cardcom_document_url || '').trim();
    const docType = tx.document_type || tx.cardcom_document_type;
    const docNumber = tx.document_number ?? tx.cardcom_document_number;
    const typeLabel = cardcomDocumentTypeLabelHe(docType);

    const goPreview = (url: string) => {
      navigation.navigate('InvoiceDocumentPreview', {
        url,
        documentType: docType,
        documentNumber: docNumber,
        title: typeLabel || i18n.t('auto.screens__Profile__BillingScreen.s6'),
      });
    };

    if (existing.startsWith('http')) {
      goPreview(existing);
      return;
    }

    if (docNumber == null) {
      legacyAlert(
        i18n.t('auto.screens__Profile__BillingScreen.s7'),
        i18n.t('auto.screens__Profile__BillingScreen.s8'),
      );
      return;
    }

    setOpeningId(tx.id);
    try {
      const result = await paymentService.resolveInvoiceDocumentUrl(tx.id);
      if (result.url) {
        queryClient.setQueryData<PaymentHistoryItem[]>(
          appQueryKeys.userPaymentHistory(userId ?? 'anon'),
          (prev) =>
            (prev ?? []).map((row) =>
              row.id === tx.id
                ? {
                    ...row,
                    document_url: result.url,
                    cardcom_document_url: result.url,
                  }
                : row,
            ),
        );
        goPreview(result.url);
        return;
      }
      legacyAlert(
        i18n.t('auto.screens__Profile__BillingScreen.s9'),
        i18n.t('auto.screens__Profile__BillingScreen.s10', { v0: docNumber, v1: typeLabel ? ` (${typeLabel})` : '', v2: result.error ||
          'קישור להורדה אינו זמין כרגע. אם צוין אימייל בתשלום — בדקו את תיבת הדואר, או פנו לתמיכה עם מספר המסמך.' }),
      );
    } finally {
      setOpeningId(null);
    }
  };

  const onCancelSubscription = async () => {
    void HapticFeedback.selection();
    const ok = await showAppConfirm(
      i18n.t('auto.screens__Profile__BillingScreen.s11'),
      i18n.t('auto.screens__Profile__BillingScreen.s12'),
      {
        confirmText: i18n.t('auto.screens__Profile__BillingScreen.s13'),
        cancelText: i18n.t('auto.screens__Profile__BillingScreen.s14'),
        destructive: true,
      },
    );
    if (!ok) return;

    setCancelling(true);
    try {
      const success = await paymentService.cancelSubscription();
      if (!success) {
        legacyAlert(i18n.t('auto.screens__Profile__BillingScreen.s15'), i18n.t('auto.screens__Profile__BillingScreen.s16'));
        return;
      }
      await onRefresh();
      legacyAlert(i18n.t('auto.screens__Profile__BillingScreen.s17'), i18n.t('auto.screens__Profile__BillingScreen.s18'));
    } finally {
      setCancelling(false);
    }
  };

  const detailRows = buildDetailRows({
    showSubscriptionCard,
    statusLabel,
    priceLabel,
    planId,
    isPaidActive,
    autoRenew,
    nextBilling,
    expiresAt,
    isInactivePaid,
    paymentMethodLabel,
    warningColor: tokens.colors.warning.main,
    dangerColor: tokens.colors.text.danger,
    onCancel: () => void onCancelSubscription(),
    cancelling,
  });

  if (subLoading || (historyQuery.isLoading && !historyQuery.data)) {
    return (
      <SafeAreaView
        style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}
        edges={['top', 'bottom']}
      >
        <ChatSubScreenHeader
          title={i18n.t('auto.screens__Profile__BillingScreen.s19')}
          onBack={() => {
            void HapticFeedback.impactLight();
            navigation.goBack();
          }}
        />
        <View style={styles.loadingWrap}>
          <ActivityIndicator color={tokens.colors.primary.main} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}
      edges={['top', 'bottom']}
    >
      <ChatSubScreenHeader
        title={i18n.t('auto.screens__Profile__BillingScreen.s19')}
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={tokens.colors.primary.main}
          />
        }
      >
        <SettingsSectionTitle
          title={i18n.t('auto.screens__Profile__BillingScreen.s20')}
          style={{ color: tokens.colors.text.secondary }}
        />
        <SettingsGlassCard>
          <View style={styles.planCard}>
            {!checkoutReady ? (
              <Text style={[styles.banner, { color: tokens.colors.warning.main }]}>{i18n.t('auto.screens__Profile__BillingScreen.s21')}</Text>
            ) : null}
            <View style={styles.planTitleRow}>
              {showSubscriptionCard && priceLabel ? (
                <Text
                  style={[styles.planPrice, { color: tokens.colors.text.secondary }]}
                  numberOfLines={1}
                >
                  {priceLabel}
                </Text>
              ) : (
                <View style={styles.planPriceSpacer} />
              )}
              <View style={styles.planNameGroup}>
                <Text
                  style={[styles.planName, { color: tokens.colors.text.primary }]}
                  numberOfLines={1}
                >
                  {planValue}
                </Text>
                <View style={styles.leadingIcon}>
                  <Layers size={20} color={tokens.colors.text.primary} strokeWidth={2} />
                </View>
              </View>
            </View>
            {planNote ? (
              <Text style={[styles.planNote, { color: tokens.colors.text.secondary }]}>
                {planNote}
              </Text>
            ) : null}
          </View>
          {detailRows.map((row, index) => (
            <View key={row.key}>
              <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
              <FactLine
                icon={row.icon}
                label={row.label}
                value={row.value ?? ''}
                valueColor={row.valueColor}
              />
            </View>
          ))}
        </SettingsGlassCard>

        <SettingsSectionTitle
          title={i18n.t('auto.screens__Profile__BillingScreen.s22')}
          style={{ color: tokens.colors.text.secondary }}
        />
        <SettingsGlassCard>
          <BillingLine icon={ArrowLeftRight} label={planActionLabel} onPress={goToPlans} />
          {isPaidActive ? (
            <View>
              <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
              <BillingLine
                icon={Ban}
                label={i18n.t('auto.screens__Profile__BillingScreen.s11')}
                labelColor={tokens.colors.text.danger}
                onPress={() => void onCancelSubscription()}
                busy={cancelling}
              />
            </View>
          ) : null}
        </SettingsGlassCard>

        <SettingsSectionTitle
          title={i18n.t('auto.screens__Profile__BillingScreen.s23')}
          style={{ color: tokens.colors.text.secondary }}
        />
        <SettingsGlassCard>
          {history.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Text style={[styles.fieldLabel, { color: tokens.colors.text.primary }]}>{i18n.t('auto.screens__Profile__BillingScreen.s24')}</Text>
              <Text style={[styles.fieldNote, { color: tokens.colors.text.secondary }]}>{i18n.t('auto.screens__Profile__BillingScreen.s25')}</Text>
            </View>
          ) : (
            history.map((tx, index) => {
              const docNumber = tx.document_number ?? tx.cardcom_document_number;
              const docUrl = (tx.document_url || tx.cardcom_document_url || '').trim();
              const hasOpenable = Boolean(docUrl) || docNumber != null;

              return (
                <View key={tx.id}>
                  <BillingLine
                    icon={Receipt}
                    label={
                      tx.created_at
                        ? new Date(tx.created_at).toLocaleDateString(appLocale())
                        : '—'
                    }
                    note={tx.amount != null ? `₪${tx.amount}` : undefined}
                    busy={openingId === tx.id}
                    onPress={hasOpenable ? () => void openInvoice(tx) : undefined}
                  />
                  {index < history.length - 1 ? (
                    <View
                      style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]}
                    />
                  ) : null}
                </View>
              );
            })
          )}
        </SettingsGlassCard>
      </ScrollView>
    </SafeAreaView>
  );
}

type DetailRow = {
  key: string;
  icon: LucideIcon;
  label: string;
  value?: string;
  note?: string | null;
  valueColor?: string;
  labelColor?: string;
  onPress?: () => void;
  busy?: boolean;
};

function planTrackLabel(
  planId: string | null | undefined,
  planName: string | null | undefined,
  paid: boolean,
): string {
  if (!paid || !planId || planId === 'free') return i18n.t('auto.screens__Profile__BillingScreen.s26');
  if (planId === 'monthly') return i18n.t('auto.screens__Profile__BillingScreen.s27');
  if (planId === 'quarterly') return i18n.t('auto.screens__Profile__BillingScreen.s28');
  if (planId === 'yearly') return i18n.t('auto.screens__Profile__BillingScreen.s29');
  const name = (planName ?? '').trim();
  if (!name) return i18n.t('auto.screens__Profile__BillingScreen.s30');
  return name.startsWith('מסלול') ? name : i18n.t('auto.screens__Profile__BillingScreen.s31', { v0: name });
}

function buildDetailRows(opts: {
  showSubscriptionCard: boolean;
  statusLabel: string;
  priceLabel: string | null;
  planId: string | null;
  isPaidActive: boolean;
  autoRenew: boolean | null;
  nextBilling: NextBillingInfo | null;
  expiresAt: string | null;
  isInactivePaid: boolean;
  paymentMethodLabel: string;
  warningColor: string;
  dangerColor: string;
  onCancel: () => void;
  cancelling: boolean;
}): DetailRow[] {
  if (!opts.showSubscriptionCard) return [];

  const rows: DetailRow[] = [
    { key: 'status', icon: BadgeCheck, label: i18n.t('auto.screens__Profile__BillingScreen.s32'), value: opts.statusLabel },
  ];

  if (opts.isPaidActive && opts.autoRenew != null) {
    rows.push({
      key: 'renew',
      icon: RefreshCw,
      label: i18n.t('auto.screens__Profile__BillingScreen.s33'),
      value: opts.autoRenew ? i18n.t('auto.screens__Profile__BillingScreen.s34') : i18n.t('auto.screens__Profile__BillingScreen.s35'),
    });
  }

  if (opts.nextBilling) {
    const charge = nextChargeRow(opts.nextBilling, opts.expiresAt);
    rows.push({
      key: 'next',
      icon: Calendar,
      label: charge.label,
      value: charge.value,
      note: opts.nextBilling.secondary,
      valueColor:
        !opts.nextBilling.hasDate && opts.isInactivePaid ? opts.warningColor : undefined,
    });
  }

  if (opts.isPaidActive) {
    rows.push({
      key: 'method',
      icon: CreditCard,
      label: i18n.t('auto.screens__Profile__BillingScreen.s36'),
      value: opts.paymentMethodLabel,
    });
  }

  return rows;
}

function nextChargeRow(
  next: NextBillingInfo,
  expiresAt: string | null | undefined,
): { label: string; value: string } {
  const dateLabel = formatBillingDateHe(expiresAt);
  if (dateLabel && next.primary.includes(dateLabel)) {
    return {
      // «בתוקף עד» — בכל שפה (הטקסט מגיע מ-billingDisplay המתורגם)
      label: next.primary.includes('בתוקף') ||
        next.primary.startsWith(i18n.t('auto.utils__billingDisplay.s17', { v0: '' }).trim()) ? i18n.t('auto.screens__Profile__BillingScreen.s37') : i18n.t('auto.screens__Profile__BillingScreen.s38'),
      value: dateLabel,
    };
  }
  if (next.primary === 'אין חיוב הבא' || next.primary === i18n.t('auto.utils__billingDisplay.s9')) {
    return { label: i18n.t('auto.screens__Profile__BillingScreen.s38'), value: i18n.t('auto.screens__Profile__BillingScreen.s39') };
  }
  return { label: i18n.t('auto.screens__Profile__BillingScreen.s38'), value: next.primary };
}

function FactLine({
  icon: Icon,
  label,
  value,
  valueColor,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  valueColor?: string;
}) {
  const tokens = useDesignTokens();
  return (
    <View style={styles.factRow}>
      <Text
        style={[styles.factValue, { color: valueColor ?? tokens.colors.text.primary }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <View style={styles.factLabelGroup}>
        <Text style={[styles.factLabel, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
          {label}
        </Text>
        <View style={styles.leadingIcon}>
          <Icon size={20} color={tokens.colors.text.primary} strokeWidth={2} />
        </View>
      </View>
    </View>
  );
}

function BillingLine({
  icon: Icon,
  label,
  value,
  note,
  valueColor,
  labelColor,
  onPress,
  busy,
}: Omit<DetailRow, 'key' | 'icon'> & { icon?: LucideIcon }) {
  const tokens = useDesignTokens();
  const detail = [value, note].filter(Boolean).join(' · ');
  const iconColor = labelColor ?? tokens.colors.text.primary;
  const body = (
    <>
      {onPress ? (
        busy ? (
          <ActivityIndicator size="small" color={tokens.colors.text.tertiary} />
        ) : (
          <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
        )
      ) : null}
      <View style={styles.labelCol}>
        <Text
          style={[styles.fieldLabel, { color: labelColor ?? tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            style={[
              styles.fieldNote,
              { color: valueColor ?? tokens.colors.text.secondary },
            ]}
            numberOfLines={2}
          >
            {detail}
          </Text>
        ) : null}
      </View>
      {Icon ? (
        <View style={styles.leadingIcon}>
          <Icon size={20} color={iconColor} strokeWidth={2} />
        </View>
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        disabled={busy}
        style={styles.line}
      >
        {body}
      </TouchableOpacity>
    );
  }

  return <View style={styles.line}>{body}</View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: APP_LAYOUT.sectionHeaderToContent,
    paddingBottom: 48,
  },
  planCard: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
  },
  banner: {
    ...settingsHebrewText,
    ...settingsBodyType,
    marginBottom: APP_LAYOUT.cardStackGap,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: APP_LAYOUT.cardStackGap,
  },
  planNameGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  planName: {
    ...settingsHebrewText,
    fontSize: settingsRowType.fontSize,
    fontWeight: settingsRowType.fontWeight,
    lineHeight: settingsRowType.lineHeight,
    flexShrink: 1,
  },
  planPrice: {
    ...settingsHebrewText,
    ...settingsBodyType,
    flexShrink: 1,
    textAlign: 'left',
  },
  planPriceSpacer: {
    flex: 1,
  },
  planNote: {
    ...settingsHebrewText,
    ...settingsBodyType,
    marginTop: APP_LAYOUT.groupLabelToContent,
  },
  factRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
    gap: APP_LAYOUT.cardStackGap,
  },
  factLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  factLabel: {
    ...settingsHebrewText,
    ...settingsMetaType,
    flexShrink: 0,
  },
  factValue: {
    ...settingsHebrewText,
    ...settingsBodyType,
    flexShrink: 1,
    textAlign: 'left',
  },
  fieldLabel: {
    ...settingsHebrewText,
    ...settingsRowType,
  },
  fieldNote: {
    ...settingsHebrewText,
    ...settingsRowSubtitleStyle,
  },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
  },
  labelCol: {
    flex: 1,
    minWidth: 0,
  },
  leadingIcon: {
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    marginHorizontal: APP_LAYOUT.cardPadding,
  },
  emptyBlock: {
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 12,
  },
});
