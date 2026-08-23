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
  type TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { chatPalette } from '../../components/chat/chatDesignTokens';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { useSubscription } from '../../hooks/useSubscription';
import {
  paymentService,
  isSubscriptionCheckoutEnabled,
  type PaymentHistoryItem,
  SUBSCRIPTION_PLANS,
} from '../../services/paymentService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { SettingsSectionTitle } from '../../components/profile/ProfileSettingsUI';
import {
  cardcomDocumentTypeLabelHe,
  paymentStatusLabelHe,
} from '../../utils/cardcomDocumentLabels';
import {
  formatPaymentMethodLabel,
  formatPlanPriceHe,
  isInactiveSubscriptionStatus,
  isPaidSubscriptionActive,
  resolveNextBilling,
  subscriptionStatusLabelHe,
} from '../../utils/billingDisplay';
import { appQueryKeys } from '../../lib/appQueryKeys';

const rtlText: TextStyle = {
  textAlign: 'right',
  writingDirection: 'rtl',
};

export default function BillingScreen({ navigation }: any) {
  const tokens = useDesignTokens();
  const ty = tokens.typography;
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

  const sectionTitleStyle: TextStyle = {
    fontSize: ty.titleXs.size,
    fontWeight: ty.fontWeight.bold as TextStyle['fontWeight'],
    letterSpacing: ty.titleXs.letterSpacing,
    lineHeight: ty.titleXs.lineHeight,
  };

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
        title: typeLabel || 'קבלה / חשבונית',
      });
    };

    if (existing.startsWith('http')) {
      goPreview(existing);
      return;
    }

    if (docNumber == null) {
      legacyAlert(
        'חשבונית',
        'אין מספר מסמך לעסקה זו. אם חויבתם — פנו לתמיכה עם תאריך וסכום התשלום.',
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
        'מספר מסמך',
        `מסמך מס׳ ${docNumber}${typeLabel ? ` (${typeLabel})` : ''}.\n${
          result.error ||
          'קישור להורדה אינו זמין כרגע. אם צוין אימייל בתשלום — בדקו את תיבת הדואר, או פנו לתמיכה עם מספר המסמך.'
        }`,
      );
    } finally {
      setOpeningId(null);
    }
  };

  const goToPlans = () => {
    void HapticFeedback.medium();
    navigation.navigate('SubscriptionPlans');
  };

  const onCancelSubscription = async () => {
    void HapticFeedback.selection();
    const ok = await showAppConfirm(
      'ביטול המנוי',
      'המנוי יבוטל והחשבון יחזור למסלול החינמי. פעולה זו אינה ניתנת לביטול אוטומטי.',
      {
        confirmText: 'ביטול מנוי',
        cancelText: 'השאר מנוי',
        destructive: true,
      },
    );
    if (!ok) return;

    setCancelling(true);
    try {
      const success = await paymentService.cancelSubscription();
      if (!success) {
        legacyAlert('שגיאה', 'לא ניתן לבטל את המנוי כרגע. נסו שוב או פנו לתמיכה.');
        return;
      }
      await onRefresh();
      legacyAlert('המנוי בוטל', 'החשבון חזר למסלול החינמי.');
    } finally {
      setCancelling(false);
    }
  };

  if (subLoading || (historyQuery.isLoading && !historyQuery.data)) {
    return (
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <ChatSubScreenHeader
          title="מנוי וחיובים"
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
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <ChatSubScreenHeader
        title="מנוי וחיובים"
        onBack={() => {
          void HapticFeedback.impactLight();
          navigation.goBack();
        }}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.base,
          paddingTop: tokens.spacing.md,
          paddingBottom: 48,
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={tokens.colors.primary.main}
          />
        }
      >
        {!checkoutReady ? (
          <UICard
            variant="glass"
            glassIntensity="light"
            padding="none"
            style={[
              styles.bannerCard,
              {
                borderColor: `${tokens.colors.warning.main}44`,
                backgroundColor: `${tokens.colors.warning.main}12`,
                marginBottom: tokens.spacing.md,
                borderRadius: tokens.borderRadius.lg,
              },
            ]}
          >
            <Text
              style={{
                color: tokens.colors.warning.main,
                ...rtlText,
                fontSize: ty.footnote.size,
                fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                lineHeight: ty.footnote.lineHeight,
                letterSpacing: ty.footnote.letterSpacing,
              }}
            >
              תשלום בקרוב — סליקת Cardcom עדיין לא מחוברת.
            </Text>
          </UICard>
        ) : null}

        {showSubscriptionCard ? (
          <>
            <SettingsSectionTitle title="המנוי שלך" style={sectionTitleStyle} />
            <GlassSection style={{ marginBottom: tokens.spacing.lg }}>
              <InfoRow
                label="מסלול"
                value={planName ?? planId ?? 'מנוי'}
                emphasize
              />
              <RowDivider color={tokens.colors.border.divider} />
              <InfoRow label="סטטוס" value={statusLabel} />
              {priceLabel ? (
                <>
                  <RowDivider color={tokens.colors.border.divider} />
                  <InfoRow label="מחיר" value={priceLabel} />
                </>
              ) : null}
              {isPaidActive && autoRenew != null ? (
                <>
                  <RowDivider color={tokens.colors.border.divider} />
                  <InfoRow
                    label="חידוש אוטומטי"
                    value={autoRenew ? 'פעיל' : 'כבוי'}
                  />
                </>
              ) : null}
            </GlassSection>

            <SettingsSectionTitle title="החיוב הבא" style={sectionTitleStyle} />
            <GlassSection style={{ marginBottom: tokens.spacing.lg }}>
              {nextBilling ? (
                <View style={styles.blockPad}>
                  <Text
                    style={{
                      color: nextBilling.hasDate
                        ? tokens.colors.text.primary
                        : isInactivePaid
                          ? tokens.colors.warning.main
                          : tokens.colors.text.secondary,
                      fontSize: ty.body.size,
                      fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                      letterSpacing: ty.body.letterSpacing,
                      lineHeight: ty.body.lineHeight,
                      ...rtlText,
                    }}
                  >
                    {nextBilling.primary}
                  </Text>
                  {nextBilling.secondary ? (
                    <Text
                      style={{
                        color: isInactivePaid
                          ? tokens.colors.text.secondary
                          : tokens.colors.text.tertiary,
                        fontSize: ty.footnote.size,
                        fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                        letterSpacing: ty.footnote.letterSpacing,
                        lineHeight: ty.footnote.lineHeight,
                        ...rtlText,
                        marginTop: tokens.spacing.xs,
                      }}
                    >
                      {nextBilling.secondary}
                    </Text>
                  ) : null}
                </View>
              ) : null}
            </GlassSection>

            {isPaidActive ? (
              <>
                <SettingsSectionTitle title="אמצעי תשלום" style={sectionTitleStyle} />
                <GlassSection style={{ marginBottom: tokens.spacing.lg }}>
                  <View style={styles.blockPad}>
                    <Text
                      style={{
                        color: tokens.colors.text.primary,
                        fontSize: ty.body.size,
                        fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                        letterSpacing: ty.body.letterSpacing,
                        lineHeight: ty.body.lineHeight,
                        ...rtlText,
                      }}
                    >
                      {paymentMethodLabel}
                    </Text>
                    <Text
                      style={{
                        color: tokens.colors.text.tertiary,
                        fontSize: ty.footnote.size,
                        fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                        letterSpacing: ty.footnote.letterSpacing,
                        lineHeight: ty.footnote.lineHeight,
                        ...rtlText,
                        marginTop: tokens.spacing.xs,
                      }}
                    >
                      עדכון אמצעי תשלום — בקרוב
                    </Text>
                  </View>
                </GlassSection>
              </>
            ) : (
              <TouchableOpacity
                onPress={goToPlans}
                activeOpacity={0.85}
                style={{
                  backgroundColor: tokens.colors.primary.main,
                  borderRadius: tokens.borderRadius.full,
                  paddingVertical: tokens.spacing.md,
                  paddingHorizontal: tokens.spacing.base,
                  marginBottom: tokens.spacing.lg,
                  alignItems: 'center',
                }}
              >
                <Text
                  style={{
                    color: '#000',
                    fontSize: ty.callout.size,
                    fontWeight: ty.fontWeight.bold as TextStyle['fontWeight'],
                    letterSpacing: ty.callout.letterSpacing,
                    lineHeight: ty.callout.lineHeight,
                    textAlign: 'center',
                    writingDirection: 'rtl',
                  }}
                >
                  חידוש מנוי
                </Text>
                <Text
                  style={{
                    color: 'rgba(0,0,0,0.55)',
                    fontSize: ty.caption.size,
                    fontWeight: ty.caption.weight,
                    letterSpacing: ty.caption.letterSpacing,
                    lineHeight: ty.caption.lineHeight,
                    marginTop: 2,
                    textAlign: 'center',
                    writingDirection: 'rtl',
                  }}
                >
                  {checkoutReady
                    ? 'תשלום מאובטח להסרת ההגבלה'
                    : 'צפייה במסלולים — תשלום בקרוב'}
                </Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <>
            <SettingsSectionTitle title="המנוי שלך" style={sectionTitleStyle} />
            <GlassSection style={{ marginBottom: tokens.spacing.lg }}>
              <View style={styles.blockPad}>
                <Text
                  style={{
                    color: tokens.colors.text.primary,
                    fontSize: ty.body.size,
                    fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                    letterSpacing: ty.body.letterSpacing,
                    lineHeight: ty.body.lineHeight,
                    ...rtlText,
                  }}
                >
                  מסלול חינמי
                </Text>
                <Text
                  style={{
                    color: tokens.colors.text.secondary,
                    fontSize: ty.footnote.size,
                    fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                    letterSpacing: ty.footnote.letterSpacing,
                    lineHeight: ty.footnote.lineHeight,
                    ...rtlText,
                    marginTop: tokens.spacing.sm,
                  }}
                >
                  יש לך גישה לתכנים הציבוריים. שדרוג פותח קהילה, חדשות בזמן אמת,
                  רשימות מעקב והלווייתנים.
                </Text>
              </View>
            </GlassSection>

            <TouchableOpacity
              onPress={goToPlans}
              activeOpacity={0.85}
              style={{
                backgroundColor: tokens.colors.primary.main,
                borderRadius: tokens.borderRadius.full,
                paddingVertical: tokens.spacing.md,
                paddingHorizontal: tokens.spacing.base,
                marginBottom: tokens.spacing.lg,
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: '#000',
                  fontSize: ty.callout.size,
                  fontWeight: ty.fontWeight.bold as TextStyle['fontWeight'],
                  letterSpacing: ty.callout.letterSpacing,
                  lineHeight: ty.callout.lineHeight,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                שדרג מסלול
              </Text>
              <Text
                style={{
                  color: 'rgba(0,0,0,0.55)',
                  fontSize: ty.caption.size,
                  fontWeight: ty.caption.weight,
                  letterSpacing: ty.caption.letterSpacing,
                  lineHeight: ty.caption.lineHeight,
                  marginTop: 2,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                {checkoutReady
                  ? 'בחירת מסלול ותשלום מאובטח'
                  : 'צפייה במסלולים — תשלום בקרוב'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        <SettingsSectionTitle title="חשבוניות ותשלומים" style={sectionTitleStyle} />
        <GlassSection style={{ marginBottom: tokens.spacing.lg }}>
          {history.length === 0 ? (
            <View style={styles.blockPad}>
              <Text
                style={{
                  color: tokens.colors.text.primary,
                  ...rtlText,
                  fontSize: ty.callout.size,
                  fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                  lineHeight: ty.callout.lineHeight,
                }}
              >
                אין תשלומים עדיין
              </Text>
              <Text
                style={{
                  color: tokens.colors.text.tertiary,
                  ...rtlText,
                  fontSize: ty.footnote.size,
                  fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                  letterSpacing: ty.footnote.letterSpacing,
                  lineHeight: ty.footnote.lineHeight,
                  marginTop: tokens.spacing.xs,
                }}
              >
                לאחר רכישת מנוי מוצלחת יופיעו כאן תאריך, סכום, סטטוס ומספר מסמך.
              </Text>
            </View>
          ) : (
            history.map((tx, idx) => {
              const docType = tx.document_type || tx.cardcom_document_type;
              const docNumber = tx.document_number ?? tx.cardcom_document_number;
              const docUrl = (tx.document_url || tx.cardcom_document_url || '').trim();
              const typeLabel = cardcomDocumentTypeLabelHe(docType);
              const hasOpenable = Boolean(docUrl) || docNumber != null;
              const busy = openingId === tx.id;
              const planLabel =
                (tx.plan_id &&
                  SUBSCRIPTION_PLANS[tx.plan_id as keyof typeof SUBSCRIPTION_PLANS]
                    ?.name) ||
                tx.plan_id ||
                null;

              return (
                <View
                  key={tx.id}
                  style={{
                    paddingHorizontal: tokens.spacing.base,
                    paddingVertical: tokens.spacing.md,
                    borderBottomWidth:
                      idx < history.length - 1 ? StyleSheet.hairlineWidth : 0,
                    borderBottomColor: tokens.colors.border.divider,
                  }}
                >
                  <View
                    style={{
                      flexDirection: 'row-reverse',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                    }}
                  >
                    <Text
                      style={{
                        color: tokens.colors.text.primary,
                        fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                        fontSize: ty.body.size,
                        lineHeight: ty.body.lineHeight,
                        ...rtlText,
                        flexShrink: 0,
                      }}
                    >
                      ₪{tx.amount ?? '—'}
                    </Text>
                    <Text
                      style={{
                        color: tokens.colors.text.secondary,
                        fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                        fontSize: ty.footnote.size,
                        lineHeight: ty.footnote.lineHeight,
                        ...rtlText,
                        flex: 1,
                      }}
                    >
                      {paymentStatusLabelHe(tx.status)}
                    </Text>
                  </View>
                  <Text
                    style={{
                      color: tokens.colors.text.tertiary,
                      ...rtlText,
                      fontSize: ty.footnote.size,
                      fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                      letterSpacing: ty.footnote.letterSpacing,
                      lineHeight: ty.footnote.lineHeight,
                      marginTop: tokens.spacing.xs,
                    }}
                  >
                    {tx.created_at
                      ? new Date(tx.created_at).toLocaleDateString('he-IL')
                      : '—'}
                    {planLabel ? ` · ${planLabel}` : ''}
                  </Text>
                  {docNumber != null || typeLabel ? (
                    <Text
                      style={{
                        color: tokens.colors.text.secondary,
                        ...rtlText,
                        fontSize: ty.footnote.size,
                        fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                        letterSpacing: ty.footnote.letterSpacing,
                        lineHeight: ty.footnote.lineHeight,
                        marginTop: tokens.spacing.xs,
                      }}
                    >
                      {typeLabel || 'מסמך'}
                      {docNumber != null ? ` · מס׳ ${docNumber}` : ''}
                    </Text>
                  ) : (
                    <Text
                      style={{
                        color: tokens.colors.text.muted,
                        ...rtlText,
                        fontSize: ty.footnote.size,
                        fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
                        marginTop: tokens.spacing.xs,
                      }}
                    >
                      מסמך בהכנה
                    </Text>
                  )}
                  {hasOpenable ? (
                    <TouchableOpacity
                      onPress={() => void openInvoice(tx)}
                      disabled={busy}
                      activeOpacity={0.75}
                      style={{
                        marginTop: tokens.spacing.sm,
                        alignSelf: 'flex-end',
                        paddingVertical: 6,
                        paddingHorizontal: 12,
                        borderRadius: tokens.borderRadius.full,
                        borderWidth: 1,
                        borderColor: chatPalette.glassBorder,
                        backgroundColor: `${tokens.colors.primary.main}14`,
                        opacity: busy ? 0.6 : 1,
                      }}
                    >
                      {busy ? (
                        <ActivityIndicator
                          size="small"
                          color={tokens.colors.primary.main}
                        />
                      ) : (
                        <Text
                          style={{
                            color: tokens.colors.primary.main,
                            fontWeight: ty.buttonSmall.weight,
                            fontSize: ty.buttonSmall.size,
                            letterSpacing: ty.buttonSmall.letterSpacing,
                            lineHeight: ty.buttonSmall.lineHeight,
                            writingDirection: 'rtl',
                            textAlign: 'center',
                          }}
                        >
                          {docUrl ? 'הצג קבלה' : 'פרטי מסמך'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })
          )}
        </GlassSection>

        {isPaidActive ? (
          <>
            <TouchableOpacity
              onPress={goToPlans}
              activeOpacity={0.85}
              style={{
                borderRadius: tokens.borderRadius.full,
                paddingVertical: tokens.spacing.md,
                paddingHorizontal: tokens.spacing.base,
                marginBottom: tokens.spacing.md,
                alignItems: 'center',
                borderWidth: 1,
                borderColor: chatPalette.glassBorder,
                backgroundColor: `${tokens.colors.primary.main}12`,
              }}
            >
              <Text
                style={{
                  color: tokens.colors.primary.main,
                  fontSize: ty.callout.size,
                  fontWeight: ty.fontWeight.bold as TextStyle['fontWeight'],
                  lineHeight: ty.callout.lineHeight,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                שנה / שדרג מסלול
              </Text>
              <Text
                style={{
                  color: tokens.colors.text.tertiary,
                  fontSize: ty.caption.size,
                  fontWeight: ty.caption.weight,
                  letterSpacing: ty.caption.letterSpacing,
                  lineHeight: ty.caption.lineHeight,
                  marginTop: 2,
                  textAlign: 'center',
                  writingDirection: 'rtl',
                }}
              >
                {checkoutReady
                  ? 'מעבר לבחירת מסלולים'
                  : 'צפייה במסלולים — תשלום בקרוב'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => void onCancelSubscription()}
              disabled={cancelling}
              activeOpacity={0.75}
              style={{
                borderRadius: tokens.borderRadius.full,
                paddingVertical: tokens.spacing.md,
                paddingHorizontal: tokens.spacing.base,
                alignItems: 'center',
                opacity: cancelling ? 0.55 : 1,
              }}
            >
              {cancelling ? (
                <ActivityIndicator color={tokens.colors.text.danger} />
              ) : (
                <Text
                  style={{
                    color: tokens.colors.text.danger,
                    fontSize: ty.callout.size,
                    fontWeight: ty.fontWeight.semibold as TextStyle['fontWeight'],
                    lineHeight: ty.callout.lineHeight,
                    textAlign: 'center',
                    writingDirection: 'rtl',
                  }}
                >
                  ביטול המנוי
                </Text>
              )}
            </TouchableOpacity>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function GlassSection({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      style={[
        {
          borderRadius: tokens.borderRadius.lg,
          borderWidth: 1,
          borderColor: chatPalette.glassBorder,
          overflow: 'hidden',
        },
        style,
      ]}
    >
      {children}
    </UICard>
  );
}

function InfoRow({
  label,
  value,
  emphasize,
}: {
  label: string;
  value: string;
  emphasize?: boolean;
}) {
  const tokens = useDesignTokens();
  const ty = tokens.typography;
  return (
    <View style={styles.infoRow}>
      {/*
        App.tsx: direction 'ltr' — למרות forceRTL, 'row' שם ילד ראשון בשמאל.
        לכן row-reverse: תווית (ראשונה) בימין, ערך בשמאל.
      */}
      <Text
        style={{
          color: tokens.colors.text.tertiary,
          fontWeight: ty.fontWeight.medium as TextStyle['fontWeight'],
          fontSize: ty.footnote.size,
          letterSpacing: ty.footnote.letterSpacing,
          lineHeight: ty.footnote.lineHeight,
          textAlign: 'right',
          writingDirection: 'rtl',
          flexShrink: 0,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: tokens.colors.text.primary,
          fontWeight: (emphasize
            ? ty.fontWeight.semibold
            : ty.fontWeight.medium) as TextStyle['fontWeight'],
          fontSize: emphasize ? ty.body.size : ty.callout.size,
          letterSpacing: emphasize ? ty.body.letterSpacing : ty.callout.letterSpacing,
          lineHeight: emphasize ? ty.body.lineHeight : ty.callout.lineHeight,
          textAlign: 'left',
          writingDirection: 'rtl',
          flex: 1,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function RowDivider({ color }: { color: string }) {
  return (
    <View
      style={{
        height: StyleSheet.hairlineWidth,
        backgroundColor: color,
        marginHorizontal: 16,
      }}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loadingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  blockPad: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  infoRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    // App direction LTR: row-reverse → תווית (ילד 1) בימין, ערך (ילד 2) בשמאל
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
});
