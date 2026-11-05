import { TEXT_END, TEXT_START, dirIcon } from '../../lib/i18n/direction';
import i18n from '../../lib/i18n';
import { appLocale } from '../../lib/i18n/locale';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { HapticFeedback } from '../../utils/hapticFeedback';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { legacyAlert } from '../../utils/appDialog';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import UICard from '../../components/ui/UICard';
import { UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { ChatSessionBackdrop } from '../../components/chat/ChatSessionBackdrop';
import { supabase } from '../../services/supabase';
import type { JournalStackParamList } from '../../navigation/JournalStack';
import {
  JOURNAL_LAYOUT,
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalCaption2Style,
  journalCaptionStyle,
  journalCardMetricValueSecondaryStyle,
  journalCardMetricValueStyle,
  journalCardTitleStyle,
  journalPhysicalRightText,
  journalRow,
  journalRtlContent,
} from './journalLayout';
import type { Trade } from './tradeTypes';
import {
  parseJournalDetails,
  moodLabel,
  timeframeLabel,
  formatTradeDurationHebrew,
  MISTAKE_OPTIONS,
} from './tradeJournalConstants';
import { brandfetchTickerLogoUri } from '../../utils/brandfetch';
import { getTradingViewTradeChartHTML } from '../Markets/embeds/tradingViewEmbeds';
import ExportTradeImage from '../../components/Journal/ExportTradeImage';
import TradeShareButton from '../../components/Journal/TradeShareButton';

type Nav = NativeStackNavigationProp<JournalStackParamList, 'TradeDetail'>;
type Route = RouteProp<JournalStackParamList, 'TradeDetail'>;

function fmtUsd(n: number, decimals = 2) {
  const abs = Math.abs(n);
  return `$${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs)}`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(appLocale(), {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function InfoRow({
  label,
  value,
  valueColor,
  tokens,
  last,
}: {
  label: string;
  value: string;
  valueColor?: string;
  tokens: ReturnType<typeof useDesignTokens>;
  last?: boolean;
}) {
  return (
    <View
      style={{
        ...journalRow,
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
        borderBottomWidth: last ? 0 : 1,
        borderBottomColor: tokens.colors.border.divider,
      }}
    >
      <Text
        style={{
          fontSize: JOURNAL_TYPE.groupLabel.fontSize,
          fontWeight: JOURNAL_TYPE.groupLabel.fontWeight,
          lineHeight: JOURNAL_TYPE.groupLabel.lineHeight,
          color: tokens.colors.text.secondary,
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          ...journalCardTitleStyle,
          color: valueColor ?? tokens.colors.text.primary,
          textAlign: TEXT_END,
          writingDirection: 'ltr',
          direction: 'ltr',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SectionCard({
  title,
  icon,
  children,
  tokens,
}: {
  title: string;
  icon?: string;
  children: React.ReactNode;
  tokens: ReturnType<typeof useDesignTokens>;
}) {
  return (
    <UICard
      variant="soft"
      glassIntensity="light"
      padding="md"
      style={{ marginBottom: JOURNAL_LAYOUT.cardStackGap }}
    >
      <View
        style={{
          ...journalRow,
          alignItems: 'center',
          marginBottom: JOURNAL_LAYOUT.cardTitleToBodyGap,
        }}
      >
        {icon ? (
          <View style={{ marginLeft: 12 }}>
            <Ionicons name={icon as any} size={20} color={tokens.colors.text.primary} />
          </View>
        ) : null}
        <Text
          style={{
            ...journalCardTitleStyle,
            color: tokens.colors.text.primary,
            flex: 1,
            width: undefined,
          }}
        >
          {title}
        </Text>
      </View>
      {children}
    </UICard>
  );
}

function SymbolLogo({ symbol, size }: { symbol: string; size: number }) {
  const tokens = useDesignTokens();
  const [failed, setFailed] = useState(false);
  const uri = !failed ? brandfetchTickerLogoUri(symbol) : null;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: tokens.colors.background.primary,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={{ width: size, height: size }}
          contentFit="cover"
          transition={120}
          cachePolicy="memory-disk"
          recyclingKey={symbol}
          onError={() => setFailed(true)}
        />
      ) : (
        <Text
          style={{ fontSize: size * 0.28, fontWeight: '700', color: '#fff' }}
          numberOfLines={1}
        >
          {symbol.slice(0, 4).toUpperCase()}
        </Text>
      )}
    </View>
  );
}

export default function TradeDetailScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { tradeId } = route.params;

  const [trade, setTrade] = useState<Trade | null>(null);
  const [loading, setLoading] = useState(true);
  const [showExportImage, setShowExportImage] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .maybeSingle();
    if (!error && data) setTrade(data as Trade);
    setLoading(false);
  }, [tradeId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDelete = useCallback(() => {
    if (!trade) return;
    legacyAlert(i18n.t('auto.screens__Journal__TradeDetailScreen.s1'), i18n.t('auto.screens__Journal__TradeDetailScreen.s2', { v0: trade.symbol }), [
      { text: i18n.t('auto.screens__Journal__TradeDetailScreen.s3'), style: 'cancel' },
      {
        text: i18n.t('auto.screens__Journal__TradeDetailScreen.s4'),
        style: 'destructive',
        onPress: async () => {
          void HapticFeedback.error();
          await supabase.from('trades').delete().eq('id', trade.id);
          navigation.goBack();
        },
      },
    ]);
  }, [trade, navigation]);

  const openShare = useCallback(() => {
    if (!trade) return;
    void HapticFeedback.impactLight();
    // שיתוף טרייד לצ׳אט / לציוצים הוסר — רק שיתוף כתמונה
    setShowExportImage(true);
  }, [trade]);

  const details = useMemo(() => {
    if (!trade) return null;
    return parseJournalDetails(trade.journal_details);
  }, [trade]);

  const riskReward = useMemo(() => {
    if (!trade || !trade.stop_loss || !trade.target_price) return null;
    const risk = Math.abs(trade.entry_price - trade.stop_loss);
    const reward = Math.abs(trade.target_price - trade.entry_price);
    if (risk <= 0) return null;
    return reward / risk;
  }, [trade]);

  const chartHtml = useMemo(() => {
    if (!trade) return null;
    return getTradingViewTradeChartHTML(trade.symbol, trade.entry_date, trade.exit_date);
  }, [trade]);

  if (loading || !trade) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ChatSessionBackdrop />
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  const isProfit = trade.pnl >= 0;
  const pnlColor = isProfit ? tokens.colors.primary.main : tokens.colors.text.danger;
  const directionColor =
    trade.direction === 'long' ? tokens.colors.primary.main : tokens.colors.text.danger;

  let returnPct = 0;
  if (trade.return_percentage != null) {
    returnPct = trade.return_percentage;
  } else if (trade.entry_price > 0) {
    returnPct =
      trade.direction === 'long'
        ? ((trade.exit_price - trade.entry_price) / trade.entry_price) * 100
        : ((trade.entry_price - trade.exit_price) / trade.entry_price) * 100;
  }

  const mistakeLabels =
    details?.mistakes?.map(
      (id) => MISTAKE_OPTIONS.find((m) => m.id === id)?.label ?? id
    ) ?? [];

  const hasRiskData = trade.stop_loss || trade.target_price || riskReward != null;

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', ...journalRtlContent }}>
      <ChatSessionBackdrop />
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        {/* Header */}
        <View
          style={{
            ...journalRow,
            alignItems: 'center',
            paddingHorizontal: tokens.layout.screenPadding,
            paddingVertical: 10,
            gap: 10,
          }}
        >
          <DayNavBlurButton
            onPress={() => navigation.goBack()}
            size={36}
            accessibilityLabel={i18n.t('auto.screens__Journal__TradeDetailScreen.s5')}
          >
            <Ionicons name={dirIcon('chevron-forward')} size={20} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
          <View
            style={{
              flex: 1,
              ...journalRow,
              alignItems: 'center',
              gap: 8,
            }}
          >
            <SymbolLogo symbol={trade.symbol} size={34} />
            <Text
              style={{
                ...journalCardTitleStyle,
                color: tokens.colors.text.primary,
                flexShrink: 1,
                width: undefined,
              }}
            >
              {trade.symbol}
            </Text>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: tokens.colors.background.primary,
              }}
            >
              <Text style={{ fontSize: JOURNAL_TYPE.caption2.fontSize, fontWeight: JOURNAL_TYPE.caption2.fontWeight, lineHeight: JOURNAL_TYPE.caption2.lineHeight, color: directionColor }}>
                {trade.direction === 'long' ? 'Long' : 'Short'}
              </Text>
            </View>
            {trade.strategy_name ? (
              <View
                style={{
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: tokens.colors.background.primary,
                  flexShrink: 1,
                }}
              >
                <Text
                  style={{
                    fontSize: JOURNAL_TYPE.caption2.fontSize,
                    fontWeight: '600',
                    lineHeight: JOURNAL_TYPE.caption2.lineHeight,
                    color: tokens.colors.text.tertiary,
                  }}
                  numberOfLines={1}
                >
                  {trade.strategy_name}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ ...journalRow, alignItems: 'center', gap: 8 }}>
            <TradeShareButton
              onPress={openShare}
              size={36}
              accessibilityLabel={i18n.t('auto.screens__Journal__TradeDetailScreen.s6')}
            />
            <TouchableOpacity
              onPress={() => {
                void HapticFeedback.warning();
                handleDelete();
              }}
              hitSlop={10}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: 'rgba(255,60,60,0.10)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="trash-outline" size={18} color={tokens.colors.text.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingBottom: 60 }}
          showsVerticalScrollIndicator={false}
        >
          {/* TradingView Chart */}
          {chartHtml ? (
            <UICard
              variant="soft"
              glassIntensity="light"
              padding="none"
              style={{
                borderRadius: UI_CARD_RADIUS,
                marginHorizontal: tokens.layout.screenPadding,
                marginBottom: JOURNAL_LAYOUT.cardStackGap,
                overflow: 'hidden',
                height: 260,
              }}
            >
              <WebView
                key={`chart-${trade.id}`}
                source={{ html: chartHtml }}
                style={{ flex: 1, backgroundColor: 'transparent' }}
                javaScriptEnabled
                domStorageEnabled
                thirdPartyCookiesEnabled
                sharedCookiesEnabled
                originWhitelist={['*']}
                mixedContentMode="always"
                allowsInlineMediaPlayback
                scrollEnabled={false}
              />
            </UICard>
          ) : null}

          <View style={{ paddingHorizontal: tokens.layout.screenPadding }}>
            {/* P&L Hero */}
            <UICard
              variant="soft"
              glassIntensity="light"
              padding="md"
              style={{ marginBottom: JOURNAL_LAYOUT.cardStackGap, marginTop: JOURNAL_LAYOUT.cardStackGap }}
            >
              <View
                style={{
                  ...journalRow,
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <View>
                  <Text
                    style={{
                      ...journalCaption2Style,
                      color: tokens.colors.text.tertiary,
                      marginBottom: 4,
                    }}
                  >
                    {isProfit ? i18n.t('auto.screens__Journal__TradeDetailScreen.s7') : i18n.t('auto.screens__Journal__TradeDetailScreen.s8')}
                  </Text>
                  <Text
                    style={{
                      ...journalCardMetricValueStyle,
                      color: pnlColor,
                      textAlign: TEXT_START,
                    }}
                  >
                    {isProfit ? '+' : '-'}
                    {fmtUsd(trade.pnl)}
                  </Text>
                  <Text
                    style={{
                      ...journalCardMetricValueSecondaryStyle,
                      color: pnlColor,
                      textAlign: TEXT_START,
                      marginTop: JOURNAL_LAYOUT.cardMetricLabelToValueGap,
                    }}
                  >
                    {returnPct >= 0 ? '+' : ''}
                    {returnPct.toFixed(2)}%
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <View
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 12,
                      backgroundColor: isProfit
                        ? 'rgba(0,200,5,0.12)'
                        : 'rgba(255,60,60,0.12)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: JOURNAL_TYPE.caption.fontSize,
                        fontWeight: JOURNAL_TYPE.caption.fontWeight,
                        lineHeight: JOURNAL_TYPE.caption.lineHeight,
                        color: pnlColor,
                      }}
                    >
                      {isProfit ? '✓ Win' : '✗ Loss'}
                    </Text>
                  </View>
                  <Text
                    style={{
                      ...journalCaptionStyle,
                      color: tokens.colors.text.tertiary,
                    }}
                  >
                    {formatTradeDurationHebrew(trade.entry_date, trade.exit_date)}
                  </Text>
                </View>
              </View>
            </UICard>

            {/* Risk Management */}
            {hasRiskData ? (
              <SectionCard title={i18n.t('auto.screens__Journal__TradeDetailScreen.s9')} icon="shield-outline" tokens={tokens}>
                {trade.stop_loss ? (
                  <InfoRow
                    label="Stop Loss"
                    value={fmtUsd(trade.stop_loss)}
                    valueColor={tokens.colors.text.danger}
                    tokens={tokens}
                  />
                ) : null}
                {trade.target_price ? (
                  <InfoRow
                    label="Target Price"
                    value={fmtUsd(trade.target_price)}
                    valueColor={tokens.colors.primary.main}
                    tokens={tokens}
                  />
                ) : null}
                {riskReward != null ? (
                  <InfoRow
                    label="Risk / Reward"
                    value={`1 : ${riskReward.toFixed(2)}`}
                    valueColor={
                      riskReward >= 2
                        ? tokens.colors.primary.main
                        : riskReward >= 1
                        ? tokens.colors.text.secondary
                        : tokens.colors.text.danger
                    }
                    tokens={tokens}
                    last
                  />
                ) : null}
              </SectionCard>
            ) : null}

            {/* Trade Info */}
            <SectionCard title={i18n.t('auto.screens__Journal__TradeDetailScreen.s10')} icon="list-outline" tokens={tokens}>
              <InfoRow label={i18n.t('auto.screens__Journal__TradeDetailScreen.s11')} value={fmtUsd(trade.entry_price)} tokens={tokens} />
              <InfoRow label={i18n.t('auto.screens__Journal__TradeDetailScreen.s12')} value={fmtUsd(trade.exit_price)} tokens={tokens} />
              <InfoRow label={i18n.t('auto.screens__Journal__TradeDetailScreen.s13')} value={String(trade.quantity)} tokens={tokens} />
              <InfoRow
                label={i18n.t('auto.screens__Journal__TradeDetailScreen.s14')}
                value={fmtUsd(trade.entry_price * trade.quantity, 0)}
                tokens={tokens}
              />
              <InfoRow
                label={i18n.t('auto.screens__Journal__TradeDetailScreen.s15')}
                value={fmtDate(trade.entry_date)}
                tokens={tokens}
              />
              <InfoRow
                label={i18n.t('auto.screens__Journal__TradeDetailScreen.s16')}
                value={fmtDate(trade.exit_date)}
                tokens={tokens}
                last={!(trade.tags?.length)}
              />
              {(trade.tags?.length ?? 0) > 0 ? (
                <View
                  style={{
                    ...journalRow,
                    flexWrap: 'wrap',
                    gap: 6,
                    paddingTop: 10,
                  }}
                >
                  {(trade.tags ?? []).map((tag) => (
                    <View
                      key={tag}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 999,
                        backgroundColor: tokens.colors.background.primary,
                      }}
                    >
                      <Text
                        style={{
                          ...journalCaptionStyle,
                          color: tokens.colors.text.secondary,
                        }}
                      >
                        {tag}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </SectionCard>

            {/* Journal Details */}
            {details &&
            (details.timeframe ||
              details.mood_before ||
              details.mood_after ||
              details.followed_plan != null ||
              details.strategy_type ||
              details.entry_reason ||
              details.exit_reason) ? (
              <SectionCard title={i18n.t('auto.screens__Journal__TradeDetailScreen.s17')} icon="journal-outline" tokens={tokens}>
                {details.timeframe ? (
                  <InfoRow
                    label={i18n.t('auto.screens__Journal__TradeDetailScreen.s18')}
                    value={timeframeLabel(details.timeframe)}
                    tokens={tokens}
                  />
                ) : null}
                {details.mood_before ? (
                  <InfoRow
                    label={i18n.t('auto.screens__Journal__TradeDetailScreen.s19')}
                    value={moodLabel(details.mood_before)}
                    tokens={tokens}
                  />
                ) : null}
                {details.mood_after ? (
                  <InfoRow
                    label={i18n.t('auto.screens__Journal__TradeDetailScreen.s20')}
                    value={moodLabel(details.mood_after)}
                    tokens={tokens}
                  />
                ) : null}
                {details.followed_plan != null ? (
                  <InfoRow
                    label={i18n.t('auto.screens__Journal__TradeDetailScreen.s21')}
                    value={details.followed_plan ? i18n.t('auto.screens__Journal__TradeDetailScreen.s22') : i18n.t('auto.screens__Journal__TradeDetailScreen.s23')}
                    valueColor={
                      details.followed_plan
                        ? tokens.colors.primary.main
                        : tokens.colors.text.danger
                    }
                    tokens={tokens}
                  />
                ) : null}
                {details.strategy_type ? (
                  <InfoRow label={i18n.t('auto.screens__Journal__TradeDetailScreen.s24')} value={details.strategy_type} tokens={tokens} />
                ) : null}
                {details.entry_reason ? (
                  <View
                    style={{
                      paddingVertical: 15,
                      paddingHorizontal: JOURNAL_LAYOUT.cardPadding,
                      borderBottomWidth: details.exit_reason ? 1 : 0,
                      borderBottomColor: tokens.colors.border.divider,
                    }}
                  >
                    <Text
                      style={{
                        ...journalCaption2Style,
                        color: tokens.colors.text.tertiary,
                        marginBottom: 4,
                      }}
                    >{i18n.t('auto.screens__Journal__TradeDetailScreen.s25')}</Text>
                    <Text
                      style={{
                        ...journalBodyTextStyle,
                        color: tokens.colors.text.primary,
                      }}
                    >
                      {details.entry_reason}
                    </Text>
                  </View>
                ) : null}
                {details.exit_reason ? (
                  <View style={{ paddingVertical: 10 }}>
                    <Text
                      style={{
                        ...journalCaption2Style,
                        color: tokens.colors.text.tertiary,
                        marginBottom: 4,
                      }}
                    >{i18n.t('auto.screens__Journal__TradeDetailScreen.s26')}</Text>
                    <Text
                      style={{
                        ...journalBodyTextStyle,
                        color: tokens.colors.text.primary,
                      }}
                    >
                      {details.exit_reason}
                    </Text>
                  </View>
                ) : null}
              </SectionCard>
            ) : null}

            {/* Mistakes */}
            {mistakeLabels.length > 0 ? (
              <SectionCard
                title={i18n.t('auto.screens__Journal__TradeDetailScreen.s27', { v0: mistakeLabels.length })}
                icon="warning-outline"
                tokens={tokens}
              >
                <View
                  style={{ ...journalRow, flexWrap: 'wrap', gap: 8 }}
                >
                  {mistakeLabels.map((label) => (
                    <View
                      key={label}
                      style={{
                        paddingHorizontal: 12,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: tokens.colors.background.primary,
                      }}
                    >
                      <Text
                        style={{
                          ...journalCaptionStyle,
                          fontWeight: '600',
                          color: tokens.colors.text.danger,
                        }}
                      >
                        {label}
                      </Text>
                    </View>
                  ))}
                </View>
              </SectionCard>
            ) : null}

            {/* Notes */}
            {trade.notes ? (
              <SectionCard title={i18n.t('auto.screens__Journal__TradeDetailScreen.s28')} icon="document-text-outline" tokens={tokens}>
                <Text
                  style={{
                    ...journalBodyTextStyle,
                    color: tokens.colors.text.primary,
                  }}
                >
                  {trade.notes}
                </Text>
              </SectionCard>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>


      <ExportTradeImage
        trade={trade}
        visible={showExportImage}
        onClose={() => setShowExportImage(false)}
      />
    </View>
  );
}
