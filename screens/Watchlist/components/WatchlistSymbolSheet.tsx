import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  useBottomSheetClose,
} from '../../../components/ui/BottomSheet/BottomSheet';
import { sheetContentBottomPadding } from '../../../components/ui/BottomSheet/sheetGlass';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  DayNavBlurButton,
  DAY_NAV_BUTTON_SIZE,
} from '../../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { MarketsTradingView } from '../../Markets/components/MarketsTradingView';
import { getTradingViewSymbolChartHTML } from '../../Markets/embeds/tradingViewEmbeds';
import type {
  WatchlistItemPatch,
  WatchlistRowData,
} from '../../../services/watchlist/watchlistTypes';
import {
  DAILY_CHANGE_PRESETS,
  ENTRY_GAIN_PRESETS,
  ENTRY_LOSS_PRESETS,
  PRICE_MOVE_PRESETS,
  addThreshold,
  parseThresholdList,
  toggleThreshold,
} from '../../../services/watchlist/watchlistAlertThresholds';

type Props = {
  visible: boolean;
  row: WatchlistRowData | null;
  notes: string;
  onChangeNotes: (v: string) => void;
  onClose: () => void;
  onSaveNotes: () => void | Promise<void>;
  onRemove: () => void;
  onPatch: (itemId: string, patch: WatchlistItemPatch) => Promise<void>;
  onAddToJournal: (payload: {
    symbol: string;
    entryPrice?: number | null;
    notes?: string | null;
  }) => void;
};

const CHART_HEIGHT = 280;
const DIVIDER = 'rgba(255, 255, 255, 0.08)';
/**
 * שיט גבוה (גרף + התראות מרובות).
 * fitContent + snapPoints = מעוגן לתחתית בגובה ה-snap (בלי אזור off-screen
 * שחותך את ה-footer). לא fitContent בלבד בלי flex — וגם לא snapPoints
 * על container בגובה מסך מלא בלי פיצוי.
 */
const SHEET_SNAP = 0.92;

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatSigned(n: number | null | undefined, digits = 2): string {
  if (n == null || !Number.isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(digits)}`;
}

function formatVolume(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function WatchlistSymbolSheet({
  visible,
  row,
  notes,
  onChangeNotes,
  onClose,
  onSaveNotes,
  onRemove,
  onPatch,
  onAddToJournal,
}: Props) {
  const symbol = row?.item?.symbol ?? '';

  return (
    <BottomSheet
      isOpen={visible && !!row && !!symbol}
      onClose={onClose}
      snapPoints={[SHEET_SNAP]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      useGlassBackground
      topCornerRadius={28}
      avoidKeyboard
      contentPaddingBottom={0}
    >
      {row && symbol ? (
        <Body
          row={row}
          symbol={symbol}
          notes={notes}
          onChangeNotes={onChangeNotes}
          onClose={onClose}
          onSaveNotes={onSaveNotes}
          onRemove={onRemove}
          onPatch={onPatch}
          onAddToJournal={onAddToJournal}
        />
      ) : null}
    </BottomSheet>
  );
}

function Body({
  row,
  symbol,
  notes,
  onChangeNotes,
  onClose,
  onSaveNotes,
  onRemove,
  onPatch,
  onAddToJournal,
}: {
  row: WatchlistRowData;
  symbol: string;
  notes: string;
  onChangeNotes: (v: string) => void;
  onClose: () => void;
  onSaveNotes: () => void | Promise<void>;
  onRemove: () => void;
  onPatch: (itemId: string, patch: WatchlistItemPatch) => Promise<void>;
  onAddToJournal: (payload: {
    symbol: string;
    entryPrice?: number | null;
    notes?: string | null;
  }) => void;
}) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const animatedClose = useBottomSheetClose();
  const styles = useStyles();
  /** Footer מנהל את ה-safe-area — BottomSheet עם contentPaddingBottom={0} */
  const footerPadBottom = useMemo(
    () => sheetContentBottomPadding(insets.bottom),
    [insets.bottom]
  );

  const [entryText, setEntryText] = useState('');
  const [targetText, setTargetText] = useState('');
  const [alertAbovePrices, setAlertAbovePrices] = useState<number[]>([]);
  const [alertBelowPrices, setAlertBelowPrices] = useState<number[]>([]);
  const [alertChangePcts, setAlertChangePcts] = useState<number[]>([]);
  const [entryGainPcts, setEntryGainPcts] = useState<number[]>([]);
  const [entryLossPcts, setEntryLossPcts] = useState<number[]>([]);
  const [alertAboveText, setAlertAboveText] = useState('');
  const [alertBelowText, setAlertBelowText] = useState('');
  const [alertPctText, setAlertPctText] = useState('');
  const [entryGainText, setEntryGainText] = useState('');
  const [entryLossText, setEntryLossText] = useState('');
  const [alertsOn, setAlertsOn] = useState(false);
  const [alertDayHigh, setAlertDayHigh] = useState(false);
  const [alertWeekHigh, setAlertWeekHigh] = useState(false);
  const [alertWeekLow, setAlertWeekLow] = useState(false);
  const [alert52wHigh, setAlert52wHigh] = useState(false);
  const [alert52wLow, setAlert52wLow] = useState(false);
  const [alertTargetHit, setAlertTargetHit] = useState(false);
  const [alertEarnings, setAlertEarnings] = useState(false);
  const [savingMeta, setSavingMeta] = useState(false);

  useEffect(() => {
    const item = row.item;
    setEntryText(item.entry_price != null ? String(item.entry_price) : '');
    setTargetText(item.target_price != null ? String(item.target_price) : '');
    setAlertAbovePrices(
      parseThresholdList(item.alert_above_prices, item.alert_above)
    );
    setAlertBelowPrices(
      parseThresholdList(item.alert_below_prices, item.alert_below)
    );
    setAlertChangePcts(
      parseThresholdList(item.alert_change_pcts, item.alert_change_pct)
    );
    setEntryGainPcts(
      parseThresholdList(item.alert_entry_gain_pcts, item.alert_entry_gain_pct)
    );
    setEntryLossPcts(
      parseThresholdList(item.alert_entry_loss_pcts, item.alert_entry_loss_pct)
    );
    setAlertAboveText('');
    setAlertBelowText('');
    setAlertPctText('');
    setEntryGainText('');
    setEntryLossText('');
    setAlertsOn(!!item.alerts_enabled);
    setAlertDayHigh(!!item.alert_day_high);
    setAlertWeekHigh(!!item.alert_week_high);
    setAlertWeekLow(!!item.alert_week_low);
    setAlert52wHigh(!!item.alert_52w_high);
    setAlert52wLow(!!item.alert_52w_low);
    setAlertTargetHit(!!item.alert_target_hit);
    setAlertEarnings(!!item.alert_earnings);
  }, [row.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const company = row.item.company_name?.trim() || '';
  const chartHtml = useMemo(
    () => getTradingViewSymbolChartHTML(symbol),
    [symbol]
  );

  const up = (row.changePct ?? 0) > 0.005;
  const down = (row.changePct ?? 0) < -0.005;
  const tone = up
    ? tokens.colors.primary.main
    : down
      ? tokens.colors.text.danger
      : tokens.colors.text.tertiary;
  const toneSoft = up
    ? tokens.colors.primary.dim
    : down
      ? 'rgba(255, 68, 68, 0.14)'
      : 'rgba(255,255,255,0.06)';

  const handleClose = useCallback(() => {
    if (animatedClose) animatedClose();
    else onClose();
  }, [animatedClose, onClose]);

  const enableAlerts = useCallback(() => {
    setAlertsOn(true);
  }, []);

  const saveAll = useCallback(async () => {
    setSavingMeta(true);
    try {
      let nextAbove = alertAbovePrices;
      let nextBelow = alertBelowPrices;
      let nextChange = alertChangePcts;
      let nextGain = entryGainPcts;
      let nextLoss = entryLossPcts;

      const pendingAbove = parseNum(alertAboveText);
      const pendingBelow = parseNum(alertBelowText);
      const pendingChange = parseNum(alertPctText);
      const pendingGain = parseNum(entryGainText);
      const pendingLoss = parseNum(entryLossText);
      if (pendingAbove != null) nextAbove = addThreshold(nextAbove, pendingAbove);
      if (pendingBelow != null) nextBelow = addThreshold(nextBelow, pendingBelow);
      if (pendingChange != null) nextChange = addThreshold(nextChange, pendingChange);
      if (pendingGain != null) nextGain = addThreshold(nextGain, pendingGain);
      if (pendingLoss != null) nextLoss = addThreshold(nextLoss, pendingLoss);

      await onPatch(row.item.id, {
        entry_price: parseNum(entryText),
        target_price: parseNum(targetText),
        alert_above_prices: nextAbove,
        alert_below_prices: nextBelow,
        alert_change_pcts: nextChange,
        alert_entry_gain_pcts: nextGain,
        alert_entry_loss_pcts: nextLoss,
        alerts_enabled: alertsOn,
        alert_day_high: alertDayHigh,
        alert_week_high: alertWeekHigh,
        alert_week_low: alertWeekLow,
        alert_52w_high: alert52wHigh,
        alert_52w_low: alert52wLow,
        alert_target_hit: alertTargetHit,
        alert_earnings: alertEarnings,
      });
      setAlertAbovePrices(nextAbove);
      setAlertBelowPrices(nextBelow);
      setAlertChangePcts(nextChange);
      setEntryGainPcts(nextGain);
      setEntryLossPcts(nextLoss);
      setAlertAboveText('');
      setAlertBelowText('');
      setAlertPctText('');
      setEntryGainText('');
      setEntryLossText('');
      await Promise.resolve(onSaveNotes());
      void HapticFeedback.success();
    } finally {
      setSavingMeta(false);
    }
  }, [
    onPatch,
    onSaveNotes,
    row.item.id,
    entryText,
    targetText,
    alertAbovePrices,
    alertBelowPrices,
    alertChangePcts,
    entryGainPcts,
    entryLossPcts,
    alertAboveText,
    alertBelowText,
    alertPctText,
    entryGainText,
    entryLossText,
    alertsOn,
    alertDayHigh,
    alertWeekHigh,
    alertWeekLow,
    alert52wHigh,
    alert52wLow,
    alertTargetHit,
    alertEarnings,
  ]);

  const togglePreset = useCallback(
    (key: string, value: boolean) => {
      void HapticFeedback.selection();
      if (!alertsOn && value) setAlertsOn(true);
      switch (key) {
        case 'day_high':
          setAlertDayHigh(value);
          break;
        case 'week_high':
          setAlertWeekHigh(value);
          break;
        case 'week_low':
          setAlertWeekLow(value);
          break;
        case 'y52_high':
          setAlert52wHigh(value);
          break;
        case 'y52_low':
          setAlert52wLow(value);
          break;
        case 'target':
          setAlertTargetHit(value);
          break;
        case 'earnings':
          setAlertEarnings(value);
          break;
        default:
          break;
      }
    },
    [alertsOn]
  );

  const presets: Array<{ key: string; label: string; on: boolean }> = [
    { key: 'week_high', label: 'שיא שבועי', on: alertWeekHigh },
    { key: 'week_low', label: 'שפל שבועי', on: alertWeekLow },
    { key: 'y52_high', label: 'שיא 52ש׳', on: alert52wHigh },
    { key: 'y52_low', label: 'שפל 52ש׳', on: alert52wLow },
    { key: 'day_high', label: 'שיא יומי', on: alertDayHigh },
    { key: 'target', label: 'הגעה ליעד', on: alertTargetHit },
    { key: 'earnings', label: 'דיווח קרוב', on: alertEarnings },
  ];

  const dayRows = [
    { label: 'פתיחה', value: formatPrice(row.open) },
    { label: 'גבוה', value: formatPrice(row.dayHigh) },
    { label: 'נמוך', value: formatPrice(row.dayLow) },
    { label: 'סגירה קודמת', value: formatPrice(row.previousClose) },
    { label: 'ווליום', value: formatVolume(row.volume) },
    { label: 'שיא שבועי', value: formatPrice(row.weekHigh) },
    { label: 'שפל שבועי', value: formatPrice(row.weekLow) },
    { label: 'שיא 52ש׳', value: formatPrice(row.high52) },
    { label: 'שפל 52ש׳', value: formatPrice(row.low52) },
  ];

  const eventBits: string[] = [];
  if (row.earningsDate) eventBits.push(`דיווח רווח ${row.earningsDate}`);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <DayNavBlurButton
          onPress={() => {
            void HapticFeedback.selection();
            handleClose();
          }}
          size={DAY_NAV_BUTTON_SIZE}
          glassIntensity="subtle"
          accessibilityLabel="סגור"
        >
          <Ionicons
            name="chevron-forward"
            size={22}
            color={tokens.colors.text.primary}
          />
        </DayNavBlurButton>

        <View style={styles.identity}>
          <TickerLogo symbol={symbol} size={40} />
          <View style={styles.identityText}>
            <Text style={styles.symbol}>{symbol}</Text>
            {company ? (
              <Text style={styles.company} numberOfLines={1}>
                {company}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.pctBadge, { backgroundColor: toneSoft }]}>
          <Text style={[styles.pctBadgeText, { color: tone }]}>
            {formatSigned(row.changePct)}%
          </Text>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.quoteStrip}>
          <Text style={styles.lastPrice}>{formatPrice(row.price)}</Text>
          <Text style={[styles.dayChange, { color: tone }]}>
            {formatSigned(row.change)}
          </Text>
          {row.vsEntryPct != null ? (
            <Text style={styles.vsHint}>
              מול כניסה {formatSigned(row.vsEntryPct)}%
            </Text>
          ) : null}
          {row.vsTargetPct != null ? (
            <Text style={styles.vsHint}>
              ליעד {formatSigned(row.vsTargetPct)}%
            </Text>
          ) : null}
        </View>

        {eventBits.length > 0 ? (
          <View style={styles.eventRow}>
            {eventBits.map((b) => (
              <Text key={b} style={styles.eventChip}>
                {b}
              </Text>
            ))}
          </View>
        ) : null}

        <UICard
          variant="blur"
          glassIntensity="subtle"
          padding="none"
          style={styles.journalCta}
          contentContainerStyle={styles.journalCtaInner}
          onPress={() => {
            void HapticFeedback.selection();
            onAddToJournal({
              symbol,
              entryPrice: row.price ?? row.item.entry_price,
              notes: notes || row.item.notes,
            });
          }}
          accessibilityLabel={`פתח עסקה ביומן עבור ${symbol}`}
        >
          <Text style={styles.journalCtaTitle}>פתח ביומן</Text>
        </UICard>

        <UICard
          variant="blur"
          glassIntensity="subtle"
          padding="none"
          style={styles.chartCard}
          contentContainerStyle={styles.chartInner}
        >
          <MarketsTradingView
            html={chartHtml}
            instanceKey={`watchlist-sheet-${symbol}`}
            height={CHART_HEIGHT}
            containerStyle={styles.chartWebView}
            loadingBackgroundColor="transparent"
          />
        </UICard>

        <UICard variant="blur" glassIntensity="subtle" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>נתוני היום</Text>
          {dayRows.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.metaRow,
                index < dayRows.length - 1 && styles.metaRowBorder,
              ]}
            >
              <Text style={styles.metaLabel}>{item.label}</Text>
              <Text style={styles.metaValue}>{item.value}</Text>
            </View>
          ))}
        </UICard>

        <UICard variant="blur" glassIntensity="subtle" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>ייחוס ויעד</Text>
          <View style={styles.fieldRow}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>מחיר כניסה</Text>
              <TextInput
                style={styles.fieldInput}
                value={entryText}
                onChangeText={setEntryText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tokens.colors.text.muted}
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>יעד</Text>
              <TextInput
                style={styles.fieldInput}
                value={targetText}
                onChangeText={setTargetText}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={tokens.colors.text.muted}
              />
            </View>
          </View>
        </UICard>

        <UICard variant="blur" glassIntensity="subtle" padding="md" style={styles.card}>
          <View style={styles.alertHeader}>
            <Text style={styles.sectionTitle}>התראות</Text>
            <Switch
              value={alertsOn}
              onValueChange={(v) => {
                void HapticFeedback.selection();
                setAlertsOn(v);
              }}
              trackColor={{
                false: 'rgba(255,255,255,0.12)',
                true: tokens.colors.primary.dim,
              }}
              thumbColor={
                alertsOn ? tokens.colors.primary.main : tokens.colors.text.tertiary
              }
            />
          </View>

          <Text style={styles.presetLabel}>תבניות</Text>
          <View style={styles.presetGrid}>
            {presets.map((p) => (
              <Pressable
                key={p.key}
                style={[styles.presetBtn, p.on && styles.presetBtnOn]}
                onPress={() => togglePreset(p.key, !p.on)}
              >
                <Text style={[styles.presetText, p.on && styles.presetTextOn]}>
                  {p.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[styles.presetLabel, { marginTop: 14 }]}>
            רווח מהכניסה +% · אפשר כמה
          </Text>
          <View style={styles.presetGrid}>
            {ENTRY_GAIN_PRESETS.map((pct) => {
              const on = entryGainPcts.some((n) => Math.abs(n - pct) < 1e-9);
              return (
                <Pressable
                  key={`gain-${pct}`}
                  style={[styles.presetBtn, on && styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setEntryGainPcts((prev) => toggleThreshold(prev, pct));
                    enableAlerts();
                  }}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>
                    +{pct}%
                  </Text>
                </Pressable>
              );
            })}
            {entryGainPcts
              .filter((pct) => !ENTRY_GAIN_PRESETS.some((p) => Math.abs(p - pct) < 1e-9))
              .map((pct) => (
                <Pressable
                  key={`gain-custom-${pct}`}
                  style={[styles.presetBtn, styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setEntryGainPcts((prev) => toggleThreshold(prev, pct));
                  }}
                >
                  <Text style={[styles.presetText, styles.presetTextOn]}>
                    +{pct}% ×
                  </Text>
                </Pressable>
              ))}
          </View>
          <View style={[styles.fieldRow, { marginTop: 8 }]}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>מותאם אישית</Text>
              <TextInput
                style={styles.fieldInput}
                value={entryGainText}
                onChangeText={setEntryGainText}
                onSubmitEditing={() => {
                  const n = parseNum(entryGainText);
                  if (n == null) return;
                  setEntryGainPcts((prev) => addThreshold(prev, n));
                  setEntryGainText('');
                  enableAlerts();
                }}
                keyboardType="decimal-pad"
                placeholder="הוסף %…"
                placeholderTextColor={tokens.colors.text.muted}
                returnKeyType="done"
              />
            </View>
            <Pressable
              style={styles.addChipBtn}
              onPress={() => {
                const n = parseNum(entryGainText);
                if (n == null) return;
                void HapticFeedback.selection();
                setEntryGainPcts((prev) => addThreshold(prev, n));
                setEntryGainText('');
                enableAlerts();
              }}
            >
              <Text style={styles.addChipBtnText}>הוסף</Text>
            </Pressable>
          </View>

          <Text style={[styles.presetLabel, { marginTop: 14 }]}>
            הפסד מהכניסה −% · אפשר כמה
          </Text>
          <View style={styles.presetGrid}>
            {ENTRY_LOSS_PRESETS.map((pct) => {
              const on = entryLossPcts.some((n) => Math.abs(n - pct) < 1e-9);
              return (
                <Pressable
                  key={`loss-${pct}`}
                  style={[styles.presetBtn, on && styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setEntryLossPcts((prev) => toggleThreshold(prev, pct));
                    enableAlerts();
                  }}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>
                    −{pct}%
                  </Text>
                </Pressable>
              );
            })}
            {entryLossPcts
              .filter((pct) => !ENTRY_LOSS_PRESETS.some((p) => Math.abs(p - pct) < 1e-9))
              .map((pct) => (
                <Pressable
                  key={`loss-custom-${pct}`}
                  style={[styles.presetBtn, styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setEntryLossPcts((prev) => toggleThreshold(prev, pct));
                  }}
                >
                  <Text style={[styles.presetText, styles.presetTextOn]}>
                    −{pct}% ×
                  </Text>
                </Pressable>
              ))}
          </View>
          <View style={[styles.fieldRow, { marginTop: 8 }]}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>מותאם אישית</Text>
              <TextInput
                style={styles.fieldInput}
                value={entryLossText}
                onChangeText={setEntryLossText}
                onSubmitEditing={() => {
                  const n = parseNum(entryLossText);
                  if (n == null) return;
                  setEntryLossPcts((prev) => addThreshold(prev, n));
                  setEntryLossText('');
                  enableAlerts();
                }}
                keyboardType="decimal-pad"
                placeholder="הוסף %…"
                placeholderTextColor={tokens.colors.text.muted}
                returnKeyType="done"
              />
            </View>
            <Pressable
              style={styles.addChipBtn}
              onPress={() => {
                const n = parseNum(entryLossText);
                if (n == null) return;
                void HapticFeedback.selection();
                setEntryLossPcts((prev) => addThreshold(prev, n));
                setEntryLossText('');
                enableAlerts();
              }}
            >
              <Text style={styles.addChipBtnText}>הוסף</Text>
            </Pressable>
          </View>

          <Text style={[styles.presetLabel, { marginTop: 14 }]}>
            מעל מחיר · אפשר כמה
          </Text>
          <View style={styles.presetGrid}>
            {PRICE_MOVE_PRESETS.map((pct) => {
              const base = row.price;
              if (base == null || !Number.isFinite(base)) return null;
              const level = Number((base * (1 + pct / 100)).toFixed(2));
              const on = alertAbovePrices.some((n) => Math.abs(n - level) < 0.005);
              return (
                <Pressable
                  key={`above-pct-${pct}`}
                  style={[styles.presetBtn, on && styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setAlertAbovePrices((prev) => toggleThreshold(prev, level));
                    enableAlerts();
                  }}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>
                    +{pct}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {alertAbovePrices.length > 0 ? (
            <View style={styles.presetGrid}>
              {alertAbovePrices.map((level) => (
                <Pressable
                  key={`above-${level}`}
                  style={[styles.presetBtn, styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setAlertAbovePrices((prev) => toggleThreshold(prev, level));
                  }}
                >
                  <Text style={[styles.presetText, styles.presetTextOn]}>
                    {formatPrice(level)} ×
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={[styles.fieldRow, { marginTop: 8 }]}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>מחיר מותאם</Text>
              <TextInput
                style={styles.fieldInput}
                value={alertAboveText}
                onChangeText={setAlertAboveText}
                onSubmitEditing={() => {
                  const n = parseNum(alertAboveText);
                  if (n == null) return;
                  setAlertAbovePrices((prev) => addThreshold(prev, n));
                  setAlertAboveText('');
                  enableAlerts();
                }}
                keyboardType="decimal-pad"
                placeholder="הוסף מחיר…"
                placeholderTextColor={tokens.colors.text.muted}
                returnKeyType="done"
              />
            </View>
            <Pressable
              style={styles.addChipBtn}
              onPress={() => {
                const n = parseNum(alertAboveText);
                if (n == null) return;
                void HapticFeedback.selection();
                setAlertAbovePrices((prev) => addThreshold(prev, n));
                setAlertAboveText('');
                enableAlerts();
              }}
            >
              <Text style={styles.addChipBtnText}>הוסף</Text>
            </Pressable>
          </View>

          <Text style={[styles.presetLabel, { marginTop: 14 }]}>
            מתחת למחיר · אפשר כמה
          </Text>
          <View style={styles.presetGrid}>
            {PRICE_MOVE_PRESETS.map((pct) => {
              const base = row.price;
              if (base == null || !Number.isFinite(base)) return null;
              const level = Number((base * (1 - pct / 100)).toFixed(2));
              const on = alertBelowPrices.some((n) => Math.abs(n - level) < 0.005);
              return (
                <Pressable
                  key={`below-pct-${pct}`}
                  style={[styles.presetBtn, on && styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setAlertBelowPrices((prev) => toggleThreshold(prev, level));
                    enableAlerts();
                  }}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>
                    −{pct}%
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {alertBelowPrices.length > 0 ? (
            <View style={styles.presetGrid}>
              {alertBelowPrices.map((level) => (
                <Pressable
                  key={`below-${level}`}
                  style={[styles.presetBtn, styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setAlertBelowPrices((prev) => toggleThreshold(prev, level));
                  }}
                >
                  <Text style={[styles.presetText, styles.presetTextOn]}>
                    {formatPrice(level)} ×
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={[styles.fieldRow, { marginTop: 8 }]}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>מחיר מותאם</Text>
              <TextInput
                style={styles.fieldInput}
                value={alertBelowText}
                onChangeText={setAlertBelowText}
                onSubmitEditing={() => {
                  const n = parseNum(alertBelowText);
                  if (n == null) return;
                  setAlertBelowPrices((prev) => addThreshold(prev, n));
                  setAlertBelowText('');
                  enableAlerts();
                }}
                keyboardType="decimal-pad"
                placeholder="הוסף מחיר…"
                placeholderTextColor={tokens.colors.text.muted}
                returnKeyType="done"
              />
            </View>
            <Pressable
              style={styles.addChipBtn}
              onPress={() => {
                const n = parseNum(alertBelowText);
                if (n == null) return;
                void HapticFeedback.selection();
                setAlertBelowPrices((prev) => addThreshold(prev, n));
                setAlertBelowText('');
                enableAlerts();
              }}
            >
              <Text style={styles.addChipBtnText}>הוסף</Text>
            </Pressable>
          </View>

          <Text style={[styles.presetLabel, { marginTop: 14 }]}>
            שינוי יומי |%| · אפשר כמה
          </Text>
          <View style={styles.presetGrid}>
            {DAILY_CHANGE_PRESETS.map((pct) => {
              const on = alertChangePcts.some((n) => Math.abs(n - pct) < 1e-9);
              return (
                <Pressable
                  key={`chg-${pct}`}
                  style={[styles.presetBtn, on && styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setAlertChangePcts((prev) => toggleThreshold(prev, pct));
                    enableAlerts();
                  }}
                >
                  <Text style={[styles.presetText, on && styles.presetTextOn]}>
                    {pct}%
                  </Text>
                </Pressable>
              );
            })}
            {alertChangePcts
              .filter((pct) => !DAILY_CHANGE_PRESETS.some((p) => Math.abs(p - pct) < 1e-9))
              .map((pct) => (
                <Pressable
                  key={`chg-custom-${pct}`}
                  style={[styles.presetBtn, styles.presetBtnOn]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setAlertChangePcts((prev) => toggleThreshold(prev, pct));
                  }}
                >
                  <Text style={[styles.presetText, styles.presetTextOn]}>
                    {pct}% ×
                  </Text>
                </Pressable>
              ))}
          </View>
          <View style={[styles.fieldRow, { marginTop: 8 }]}>
            <View style={styles.field}>
              <Text style={styles.fieldLabel}>מותאם אישית</Text>
              <TextInput
                style={styles.fieldInput}
                value={alertPctText}
                onChangeText={setAlertPctText}
                onSubmitEditing={() => {
                  const n = parseNum(alertPctText);
                  if (n == null) return;
                  setAlertChangePcts((prev) => addThreshold(prev, n));
                  setAlertPctText('');
                  enableAlerts();
                }}
                keyboardType="decimal-pad"
                placeholder="הוסף %…"
                placeholderTextColor={tokens.colors.text.muted}
                returnKeyType="done"
              />
            </View>
            <Pressable
              style={styles.addChipBtn}
              onPress={() => {
                const n = parseNum(alertPctText);
                if (n == null) return;
                void HapticFeedback.selection();
                setAlertChangePcts((prev) => addThreshold(prev, n));
                setAlertPctText('');
                enableAlerts();
              }}
            >
              <Text style={styles.addChipBtnText}>הוסף</Text>
            </Pressable>
          </View>
        </UICard>

        <UICard variant="blur" glassIntensity="subtle" padding="md" style={styles.card}>
          <Text style={styles.sectionTitle}>הערה</Text>
          <TextInput
            style={styles.input}
            value={notes}
            onChangeText={onChangeNotes}
            placeholder="יעד, תזכורת או הערה…"
            placeholderTextColor={tokens.colors.text.muted}
            multiline
            textAlignVertical="top"
          />
        </UICard>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>
        <UICard
          variant="blur"
          glassIntensity="subtle"
          padding="none"
          style={[styles.saveBtn, savingMeta && styles.saveBtnDisabled]}
          contentContainerStyle={styles.saveBtnInner}
          onPress={
            savingMeta
              ? undefined
              : () => {
                  void saveAll();
                }
          }
          accessibilityLabel="שמור שינויים"
        >
          {savingMeta ? (
            <ActivityIndicator color={tokens.colors.text.primary} />
          ) : (
            <Text style={styles.saveBtnText}>שמור שינויים</Text>
          )}
        </UICard>

        <Pressable
          onPress={() => {
            void HapticFeedback.medium();
            onRemove();
          }}
          style={({ pressed }) => [
            styles.removeBtn,
            pressed && styles.removeBtnPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel="הסר מהרשימה"
        >
          <Text style={styles.removeText}>הסר מהרשימה</Text>
        </Pressable>
      </View>
    </View>
  );
}

function useStyles() {
  const tokens = useDesignTokens();
  const { rtlText } = tokens;

  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, minHeight: 0 },
        header: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 2,
          paddingBottom: 12,
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: DIVIDER,
        },
        identity: {
          flex: 1,
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 10,
          minWidth: 0,
        },
        identityText: { flex: 1, minWidth: 0, gap: 2 },
        symbol: {
          color: tokens.colors.text.primary,
          fontSize: 17,
          fontWeight: '700',
          ...rtlText,
        },
        company: {
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          ...rtlText,
        },
        pctBadge: {
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 8,
        },
        pctBadgeText: {
          fontSize: 13,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
        },
        scroll: { flex: 1, minHeight: 0 },
        scrollContent: {
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: 16,
          gap: 12,
        },
        quoteStrip: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          alignItems: 'baseline',
          gap: 8,
        },
        lastPrice: {
          color: tokens.colors.text.primary,
          fontSize: 28,
          fontWeight: '700',
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
        },
        dayChange: {
          fontSize: 15,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
        },
        vsHint: {
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          fontWeight: '500',
          ...rtlText,
        },
        eventRow: {
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 6,
        },
        eventChip: {
          color: tokens.colors.primary.main,
          backgroundColor: tokens.colors.primary.dim,
          fontSize: 11,
          fontWeight: '700',
          paddingHorizontal: 8,
          paddingVertical: 4,
          borderRadius: 6,
          overflow: 'hidden',
        },
        journalCta: {
          width: '100%',
          marginBottom: 12,
          borderRadius: 999,
          overflow: 'hidden',
          minHeight: 48,
        },
        journalCtaInner: {
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
        },
        journalCtaTitle: {
          color: tokens.colors.text.primary,
          fontSize: 15,
          fontWeight: '700',
          textAlign: 'center',
          width: '100%',
        },
        chartCard: {
          borderRadius: 20,
          overflow: 'hidden',
          height: CHART_HEIGHT,
        },
        chartInner: { flex: 1, minHeight: CHART_HEIGHT },
        chartWebView: {
          backgroundColor: 'transparent',
          borderRadius: 0,
        },
        card: { borderRadius: 20, overflow: 'hidden' },
        sectionTitle: {
          color: tokens.colors.text.secondary,
          fontSize: 12,
          fontWeight: '600',
          marginBottom: 4,
          ...rtlText,
        },
        metaRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 11,
          gap: 16,
        },
        metaRowBorder: {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: DIVIDER,
        },
        metaLabel: {
          color: tokens.colors.text.tertiary,
          fontSize: 13,
          fontWeight: '500',
          ...rtlText,
        },
        metaValue: {
          color: tokens.colors.text.primary,
          fontSize: 14,
          fontWeight: '600',
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
        },
        fieldRow: {
          flexDirection: 'row-reverse',
          gap: 10,
          marginTop: 8,
          alignItems: 'flex-end',
        },
        field: { flex: 1, gap: 6 },
        fieldLabel: {
          color: tokens.colors.text.tertiary,
          fontSize: 11,
          fontWeight: '600',
          ...rtlText,
        },
        fieldInput: {
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 12,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: tokens.colors.text.primary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: DIVIDER,
          fontSize: 15,
          fontVariant: ['tabular-nums'],
          textAlign: 'left',
          writingDirection: 'ltr',
        },
        addChipBtn: {
          minHeight: 42,
          paddingHorizontal: 14,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.primary.dim,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: tokens.colors.border.accent,
          marginBottom: 1,
        },
        addChipBtnText: {
          color: tokens.colors.primary.main,
          fontSize: 13,
          fontWeight: '700',
        },
        alertHeader: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 4,
        },
        presetLabel: {
          marginTop: 10,
          color: tokens.colors.text.tertiary,
          fontSize: 11,
          fontWeight: '600',
          ...rtlText,
        },
        presetGrid: {
          marginTop: 8,
          flexDirection: 'row-reverse',
          flexWrap: 'wrap',
          gap: 8,
        },
        presetBtn: {
          paddingHorizontal: 10,
          paddingVertical: 7,
          borderRadius: 10,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: DIVIDER,
        },
        presetBtnOn: {
          backgroundColor: tokens.colors.primary.dim,
          borderColor: tokens.colors.border.accent,
        },
        presetText: {
          color: tokens.colors.text.secondary,
          fontSize: 12,
          fontWeight: '600',
        },
        presetTextOn: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        input: {
          marginTop: 8,
          backgroundColor: 'rgba(255,255,255,0.04)',
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: tokens.colors.text.primary,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: DIVIDER,
          fontSize: 15,
          lineHeight: 22,
          minHeight: 84,
          ...rtlText,
        },
        footer: {
          paddingHorizontal: 16,
          paddingTop: 12,
          gap: 10,
          backgroundColor: 'transparent',
        },
        saveBtn: {
          width: '100%',
          borderRadius: 999,
          overflow: 'hidden',
          minHeight: 48,
        },
        saveBtnInner: {
          minHeight: 48,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 20,
          paddingVertical: 12,
        },
        saveBtnDisabled: { opacity: 0.55 },
        saveBtnText: {
          color: tokens.colors.text.primary,
          fontSize: 15,
          fontWeight: '700',
          textAlign: 'center',
          width: '100%',
        },
        removeBtn: {
          width: '100%',
          minHeight: 40,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 8,
        },
        removeBtnPressed: { opacity: 0.65 },
        removeText: {
          color: '#FF5C5C',
          fontSize: 14,
          fontWeight: '600',
          textAlign: 'center',
        },
      }),
    [tokens, rtlText]
  );
}
