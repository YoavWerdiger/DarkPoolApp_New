import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  Pressable,
  Switch,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet, {
  useBottomSheetClose,
} from '../../../components/ui/BottomSheet/BottomSheet';
import UIButton from '../../../components/ui/UIButton';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import {
  APP_TYPE,
  appCaptionStyle,
  appCardBodyStyle,
  appCardSubtitleStyle,
  appCardTitleStyle,
  appGroupLabelStyle,
  appPhysicalLeftText,
  appPhysicalRightText,
  appSheetButtonLabelStyle,
} from '../../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldShellStyle,
} from '../../../components/ui/formControl';
import { SignedChangePair } from '../../../components/ui/ChangeDot';
import {
  DayNavBlurButton,
  HEADER_BACK_BTN_SIZE,
} from '../../../components/ui/DayNavBlurButton';
import { MarketsTradingView } from '../../Markets/components/MarketsTradingView';
import { getTradingViewSymbolChartHTML } from '../../Markets/embeds/tradingViewEmbeds';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { ensureNotificationCategoryOn } from '../../../lib/notificationPrefs';
import { useTheme } from '../../../context/ThemeContext';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { toDataIsland } from '../../DarkPool/utils/bidi';
import {
  formatTickerAbsChange,
  formatTickerLivePrice,
  formatTickerPctChange,
  tickerChangeTone,
} from '../../DarkPool/utils/tickerChart';
import type {
  WatchlistItemPatch,
  WatchlistRowData,
} from '../../../services/watchlist/watchlistTypes';
import {
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

/** שיט גבוה (גרף + נתונים + התראות). fitContent + snap = מעוגן לתחתית. */
const SHEET_SNAP = 0.92;
const CHART_HEIGHT = 240;

type Chip = { key: string; label: string };
type PriceSide = 'above' | 'below';
type AlertEditorKey = 'price' | 'daily';
type IonName = React.ComponentProps<typeof Ionicons>['name'];

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatVolume(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`;
  return `${Math.round(n)}`;
}

function formatPctLabel(n: number): string {
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded);
}

function parseNum(text: string): number | null {
  const t = text.trim().replace(',', '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function splitChipKey(key: string): { kind: string; raw: string } {
  const i = key.indexOf(':');
  return { kind: key.slice(0, i), raw: key.slice(i + 1) };
}

function summarizeChips(chips: Chip[], empty: string): string {
  if (chips.length === 0) return empty;
  return chips.map((chip) => chip.label).join('  ·  ');
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
}: Props) {
  const tokens = useDesignTokens();
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
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
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
}: {
  row: WatchlistRowData;
  symbol: string;
  notes: string;
  onChangeNotes: (v: string) => void;
  onClose: () => void;
  onSaveNotes: () => void | Promise<void>;
  onRemove: () => void;
  onPatch: (itemId: string, patch: WatchlistItemPatch) => Promise<void>;
}) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const animatedClose = useBottomSheetClose();
  const styles = useStyles();
  const footerPadBottom = Math.max(insets.bottom, 8);
  const chartHtml = useMemo(() => getTradingViewSymbolChartHTML(symbol), [symbol]);

  const [alertAbovePrices, setAlertAbovePrices] = useState<number[]>([]);
  const [alertBelowPrices, setAlertBelowPrices] = useState<number[]>([]);
  const [alertChangePcts, setAlertChangePcts] = useState<number[]>([]);
  const [priceDraft, setPriceDraft] = useState('');
  const [dailyDraft, setDailyDraft] = useState('');
  const [priceSide, setPriceSide] = useState<PriceSide>('above');
  const [priceAlertsOn, setPriceAlertsOn] = useState(false);
  const [dailyAlertsOn, setDailyAlertsOn] = useState(false);
  const [openAlert, setOpenAlert] = useState<AlertEditorKey | null>(null);
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
    const nextAbove = parseThresholdList(item.alert_above_prices, item.alert_above);
    const nextBelow = parseThresholdList(item.alert_below_prices, item.alert_below);
    const nextChange = parseThresholdList(item.alert_change_pcts, item.alert_change_pct);
    setAlertAbovePrices(nextAbove);
    setAlertBelowPrices(nextBelow);
    setAlertChangePcts(nextChange);
    setPriceAlertsOn(nextAbove.length + nextBelow.length > 0);
    setDailyAlertsOn(nextChange.length > 0);
    setPriceDraft('');
    setDailyDraft('');
    setPriceSide('above');
    setOpenAlert(null);
    setAlertsOn(!!item.alerts_enabled);
    setAlertDayHigh(!!item.alert_day_high);
    setAlertWeekHigh(!!item.alert_week_high);
    setAlertWeekLow(!!item.alert_week_low);
    setAlert52wHigh(!!item.alert_52w_high);
    setAlert52wLow(!!item.alert_52w_low);
    setAlertTargetHit(!!item.alert_target_hit);
    setAlertEarnings(!!item.alert_earnings);
  }, [row.item.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const company = row.item.company_name?.trim() ?? '';
  const priceText = formatTickerLivePrice(row.price) ?? '—';
  const hasMove =
    row.change != null &&
    Number.isFinite(row.change) &&
    row.changePct != null &&
    Number.isFinite(row.changePct);

  const handleClose = useCallback(() => {
    if (animatedClose) animatedClose();
    else onClose();
  }, [animatedClose, onClose]);

  const enableAlerts = useCallback(() => {
    setAlertsOn(true);
    void ensureNotificationCategoryOn('watchlistNotifications');
  }, []);

  const saveAll = useCallback(async () => {
    setSavingMeta(true);
    try {
      let nextAbove = priceAlertsOn ? alertAbovePrices : [];
      let nextBelow = priceAlertsOn ? alertBelowPrices : [];
      let nextChange = dailyAlertsOn ? alertChangePcts : [];

      const pendingPrice = priceAlertsOn ? parseNum(priceDraft) : null;
      const pendingDaily = dailyAlertsOn ? parseNum(dailyDraft) : null;
      if (pendingPrice != null) {
        if (priceSide === 'above') nextAbove = addThreshold(nextAbove, pendingPrice);
        else nextBelow = addThreshold(nextBelow, pendingPrice);
      }
      if (pendingDaily != null) nextChange = addThreshold(nextChange, pendingDaily);

      await onPatch(row.item.id, {
        alert_above_prices: nextAbove,
        alert_below_prices: nextBelow,
        alert_change_pcts: nextChange,
        alert_entry_gain_pcts: [],
        alert_entry_loss_pcts: [],
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
      setPriceAlertsOn(nextAbove.length + nextBelow.length > 0);
      setDailyAlertsOn(nextChange.length > 0);
      setPriceDraft('');
      setDailyDraft('');
      await Promise.resolve(onSaveNotes());
      void HapticFeedback.success();
    } finally {
      setSavingMeta(false);
    }
  }, [
    onPatch,
    onSaveNotes,
    row.item.id,
    alertAbovePrices,
    alertBelowPrices,
    alertChangePcts,
    priceAlertsOn,
    dailyAlertsOn,
    priceDraft,
    dailyDraft,
    priceSide,
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
      if (!alertsOn && value) enableAlerts();
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
    [alertsOn, enableAlerts]
  );

  const presets: Array<{ key: string; label: string; on: boolean; icon: IonName }> = [
    { key: 'day_high', label: 'שיא יומי', on: alertDayHigh, icon: 'sunny-outline' },
    { key: 'week_high', label: 'שיא שבועי', on: alertWeekHigh, icon: 'trending-up' },
    { key: 'week_low', label: 'שפל שבועי', on: alertWeekLow, icon: 'trending-down' },
    { key: 'y52_high', label: 'שיא 52 שבועות', on: alert52wHigh, icon: 'flag-outline' },
    { key: 'y52_low', label: 'שפל 52 שבועות', on: alert52wLow, icon: 'flag' },
    { key: 'target', label: 'הגעה ליעד', on: alertTargetHit, icon: 'locate-outline' },
    { key: 'earnings', label: 'דיווח קרוב', on: alertEarnings, icon: 'calendar-outline' },
  ];

  const dayRows: Array<{ label: string; value: string; icon: IonName }> = [
    { label: 'פתיחה', value: formatPrice(row.open), icon: 'sunny-outline' },
    { label: 'גבוה', value: formatPrice(row.dayHigh), icon: 'arrow-up' },
    { label: 'נמוך', value: formatPrice(row.dayLow), icon: 'arrow-down' },
    { label: 'סגירה קודמת', value: formatPrice(row.previousClose), icon: 'time-outline' },
    { label: 'ווליום', value: formatVolume(row.volume), icon: 'bar-chart-outline' },
    { label: 'שיא שבועי', value: formatPrice(row.weekHigh), icon: 'trending-up' },
    { label: 'שפל שבועי', value: formatPrice(row.weekLow), icon: 'trending-down' },
    { label: 'שיא 52 שבועות', value: formatPrice(row.high52), icon: 'flag-outline' },
    { label: 'שפל 52 שבועות', value: formatPrice(row.low52), icon: 'flag' },
  ];
  if (row.earningsDate) {
    dayRows.push({
      label: 'דיווח רווח',
      value: row.earningsSession
        ? `${row.earningsDate} · ${row.earningsSession}`
        : row.earningsDate,
      icon: 'calendar-outline',
    });
  }

  const priceSelected: Chip[] = [
    ...alertAbovePrices.map((level) => ({
      key: `above:${level}`,
      label: `מעל ${formatPrice(level)}`,
    })),
    ...alertBelowPrices.map((level) => ({
      key: `below:${level}`,
      label: `מתחת ${formatPrice(level)}`,
    })),
  ];

  const dailySelected: Chip[] = alertChangePcts.map((pct) => ({
    key: `daily:${pct}`,
    label: `${formatPctLabel(pct)}%`,
  }));

  const applyPriceKey = useCallback(
    (key: string, mode: 'add' | 'remove') => {
      const { kind, raw } = splitChipKey(key);
      const n = Number(raw);
      if (!Number.isFinite(n)) return;
      void HapticFeedback.selection();
      const update = kind === 'below' ? setAlertBelowPrices : setAlertAbovePrices;
      update((prev) =>
        mode === 'add' ? addThreshold(prev, n) : toggleThreshold(prev, n)
      );
      if (mode === 'add') {
        setPriceAlertsOn(true);
        enableAlerts();
      }
    },
    [enableAlerts]
  );

  const applyDailyKey = useCallback(
    (key: string, mode: 'add' | 'remove') => {
      const n = Number(splitChipKey(key).raw);
      if (!Number.isFinite(n)) return;
      void HapticFeedback.selection();
      setAlertChangePcts((prev) =>
        mode === 'add' ? addThreshold(prev, n) : toggleThreshold(prev, n)
      );
      if (mode === 'add') {
        setDailyAlertsOn(true);
        enableAlerts();
      }
    },
    [enableAlerts]
  );

  const submitPriceDraft = useCallback(() => {
    const n = parseNum(priceDraft);
    if (n == null) return;
    applyPriceKey(`${priceSide}:${n}`, 'add');
    setPriceDraft('');
  }, [applyPriceKey, priceDraft, priceSide]);

  const submitDailyDraft = useCallback(() => {
    const n = parseNum(dailyDraft);
    if (n == null) return;
    applyDailyKey(`daily:${n}`, 'add');
    setDailyDraft('');
  }, [applyDailyKey, dailyDraft]);

  const setPriceEnabled = useCallback(
    (on: boolean) => {
      void HapticFeedback.selection();
      if (on) {
        setPriceAlertsOn(true);
        setOpenAlert('price');
        enableAlerts();
        return;
      }
      setPriceAlertsOn(false);
      setAlertAbovePrices([]);
      setAlertBelowPrices([]);
      setPriceDraft('');
      setOpenAlert((prev) => (prev === 'price' ? null : prev));
    },
    [enableAlerts]
  );

  const setDailyEnabled = useCallback(
    (on: boolean) => {
      void HapticFeedback.selection();
      if (on) {
        setDailyAlertsOn(true);
        setOpenAlert('daily');
        enableAlerts();
        return;
      }
      setDailyAlertsOn(false);
      setAlertChangePcts([]);
      setDailyDraft('');
      setOpenAlert((prev) => (prev === 'daily' ? null : prev));
    },
    [enableAlerts]
  );

  const toggleEditor = useCallback((key: AlertEditorKey) => {
    void HapticFeedback.selection();
    setOpenAlert((prev) => (prev === key ? null : key));
  }, []);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.topBar}>
          <View style={styles.closeSlot}>
            <DayNavBlurButton
              glass
              glassIntensity="light"
              onPress={handleClose}
              size={HEADER_BACK_BTN_SIZE}
              accessibilityLabel="סגור"
            >
              <Ionicons
                name="chevron-forward"
                size={22}
                color={tokens.colors.text.primary}
              />
            </DayNavBlurButton>
          </View>
        </View>

        <View style={styles.heroBlock}>
          <View style={styles.priceRow}>
            <View style={styles.priceCol}>
              <Text style={styles.livePrice}>{toDataIsland(priceText)}</Text>
              {hasMove ? (
                <SignedChangePair
                  tone={tickerChangeTone(row.changePct)}
                  style={styles.liveChangeRow}
                  textStyle={styles.liveChange}
                  isolate={toDataIsland}
                  absText={formatTickerAbsChange(row.change as number)}
                  pctText={formatTickerPctChange(row.changePct as number)}
                />
              ) : (
                <Text style={[styles.liveChange, styles.liveChangeMuted]}>—</Text>
              )}
              {row.isLive ? <Text style={styles.liveTag}>חי</Text> : null}
            </View>
            <View style={styles.identityRow}>
              <TickerLogo symbol={symbol} size={48} borderRadius={24} />
              <View style={styles.identityText}>
                <Text style={styles.identityTicker} numberOfLines={1}>
                  {toDataIsland(symbol)}
                </Text>
                {company ? (
                  <Text style={styles.companyName} numberOfLines={1}>
                    {company}
                  </Text>
                ) : null}
              </View>
            </View>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <UICard variant="soft" glassIntensity="subtle" padding="none" style={styles.chartCard}>
          <MarketsTradingView
            html={chartHtml}
            instanceKey={`watchlist-sheet-${symbol}`}
            height={CHART_HEIGHT}
            loadingBackgroundColor="transparent"
          />
        </UICard>

        <View>
          <Text style={styles.groupHeading}>נתוני היום</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none">
            {dayRows.map((item, index) => (
              <TopoValueRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                value={item.value}
                showDivider={index < dayRows.length - 1}
              />
            ))}
          </UICard>
        </View>

        <View>
          <Text style={styles.groupHeading}>התראות</Text>
          <UICard variant="soft" glassIntensity="subtle" padding="none">
            <AlertSwitchRow
              icon="notifications-outline"
              title="התראות"
              value={alertsOn}
              onValueChange={(v) => {
                void HapticFeedback.selection();
                setAlertsOn(v);
                if (!v) setOpenAlert(null);
                if (v) void ensureNotificationCategoryOn('watchlistNotifications');
              }}
              showDivider
            />
            <View
              style={!alertsOn ? styles.alertsLocked : undefined}
              pointerEvents={alertsOn ? 'auto' : 'none'}
            >
              {presets.map((preset) => (
                <AlertSwitchRow
                  key={preset.key}
                  icon={preset.icon}
                  title={preset.label}
                  value={preset.on}
                  onValueChange={(v) => togglePreset(preset.key, v)}
                  showDivider
                />
              ))}
              <AlertEditorRow
                icon="pricetag-outline"
                title="מחיר"
                subtitle={summarizeChips(priceSelected, 'הוספת רמת מחיר')}
                enabled={priceAlertsOn}
                onEnabledChange={setPriceEnabled}
                expanded={openAlert === 'price'}
                onToggle={() => toggleEditor('price')}
                showDivider
                selected={priceSelected}
                onRemove={(key) => applyPriceKey(key, 'remove')}
                draft={priceDraft}
                onDraft={setPriceDraft}
                onSubmit={submitPriceDraft}
                placeholder={priceSide === 'above' ? 'מחיר עליון' : 'מחיר תחתון'}
                sides={[
                  { key: 'above', label: 'מעל' },
                  { key: 'below', label: 'מתחת' },
                ]}
                side={priceSide}
                onSide={(key) => setPriceSide(key as PriceSide)}
              />
              <AlertEditorRow
                icon="swap-vertical-outline"
                title="שינוי יומי"
                subtitle={summarizeChips(dailySelected, 'הוספת אחוז שינוי ביום')}
                enabled={dailyAlertsOn}
                onEnabledChange={setDailyEnabled}
                expanded={openAlert === 'daily'}
                onToggle={() => toggleEditor('daily')}
                showDivider={false}
                selected={dailySelected}
                onRemove={(key) => applyDailyKey(key, 'remove')}
                draft={dailyDraft}
                onDraft={setDailyDraft}
                onSubmit={submitDailyDraft}
                placeholder="אחוז"
              />
            </View>
          </UICard>
        </View>

        <View>
          <Text style={styles.groupHeading}>הערה</Text>
          <TextInput
            style={styles.notesInput}
            value={notes}
            onChangeText={onChangeNotes}
            placeholder="תזכורת או הערה…"
            placeholderTextColor={tokens.colors.text.secondary}
            multiline
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: footerPadBottom }]}>
        <UIButton
          title="שמור שינויים"
          variant="primary"
          fullWidth
          loading={savingMeta}
          disabled={savingMeta}
          onPress={() => {
            void saveAll();
          }}
        />
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

function TopoValueRow({
  icon,
  label,
  value,
  showDivider,
}: {
  icon: IonName;
  label: string;
  value: string;
  showDivider: boolean;
}) {
  const tokens = useDesignTokens();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.menuRow}>
        <Text style={styles.statValue} numberOfLines={1}>
          {value}
        </Text>
        <View style={styles.menuTextCol}>
          <Text style={styles.menuTitle} numberOfLines={1}>
            {label}
          </Text>
        </View>
        <View style={styles.leadingIcon}>
          <Ionicons name={icon} size={20} color={tokens.colors.text.primary} />
        </View>
      </View>
      {showDivider ? <View style={styles.menuDivider} /> : null}
    </View>
  );
}

function AlertSwitchRow({
  icon,
  title,
  subtitle,
  value,
  onValueChange,
  showDivider,
}: {
  icon: IonName;
  title: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  showDivider: boolean;
}) {
  const tokens = useDesignTokens();
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.menuRow}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{
            false: theme.switchTrackOff,
            true: tokens.colors.primary.main,
          }}
          thumbColor={value ? tokens.colors.text.primary : theme.switchThumbOff}
          ios_backgroundColor={theme.switchTrackOff}
          style={styles.switchScale}
          accessibilityLabel={title}
        />
        <View style={styles.menuTextCol}>
          <Text style={styles.menuTitle} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.menuSubtitle} numberOfLines={2}>
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={styles.leadingIcon}>
          <Ionicons name={icon} size={20} color={tokens.colors.text.primary} />
        </View>
      </View>
      {showDivider ? <View style={styles.menuDivider} /> : null}
    </View>
  );
}

function AlertEditorRow({
  icon,
  title,
  subtitle,
  enabled,
  onEnabledChange,
  expanded,
  onToggle,
  showDivider,
  selected,
  onRemove,
  draft,
  onDraft,
  onSubmit,
  placeholder,
  sides,
  side,
  onSide,
}: {
  icon: IonName;
  title: string;
  subtitle: string;
  enabled: boolean;
  onEnabledChange: (on: boolean) => void;
  expanded: boolean;
  onToggle: () => void;
  showDivider: boolean;
  selected: Chip[];
  onRemove: (key: string) => void;
  draft: string;
  onDraft: (v: string) => void;
  onSubmit: () => void;
  placeholder: string;
  sides?: Chip[];
  side?: string;
  onSide?: (key: string) => void;
}) {
  const tokens = useDesignTokens();
  const { theme } = useTheme();
  const styles = useStyles();
  return (
    <View>
      <View style={styles.menuRow}>
        <Switch
          value={enabled}
          onValueChange={onEnabledChange}
          trackColor={{
            false: theme.switchTrackOff,
            true: tokens.colors.primary.main,
          }}
          thumbColor={enabled ? tokens.colors.text.primary : theme.switchThumbOff}
          ios_backgroundColor={theme.switchTrackOff}
          style={styles.switchScale}
          accessibilityLabel={title}
        />
        <Pressable
          onPress={onToggle}
          style={styles.menuTextCol}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={title}
        >
          <Text style={styles.menuTitle} numberOfLines={1}>
            {title}
          </Text>
          <Text style={styles.menuSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        </Pressable>
        <Pressable onPress={onToggle} style={styles.leadingIcon} accessibilityLabel={title}>
          <Ionicons name={icon} size={20} color={tokens.colors.text.primary} />
        </Pressable>
      </View>
      {expanded ? (
        <View style={styles.editor}>
          {sides && sides.length > 0 ? (
            <View style={styles.sideRow}>
              {sides.map((item) => {
                const on = item.key === side;
                return (
                  <Pressable
                    key={item.key}
                    style={[styles.sideChip, on && styles.sideChipOn]}
                    onPress={() => onSide?.(item.key)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    accessibilityLabel={item.label}
                  >
                    <Text style={[styles.sideChipText, on && styles.sideChipTextOn]}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          <View style={styles.addField}>
            <Pressable
              style={styles.addBtn}
              onPress={onSubmit}
              accessibilityRole="button"
              accessibilityLabel="הוסף"
            >
              <Text style={styles.addBtnText}>הוסף</Text>
            </Pressable>
            <TextInput
              style={styles.addInput}
              value={draft}
              onChangeText={onDraft}
              onSubmitEditing={onSubmit}
              keyboardType="decimal-pad"
              placeholder={placeholder}
              placeholderTextColor={tokens.colors.text.secondary}
              returnKeyType="done"
              accessibilityLabel={placeholder}
            />
          </View>
          {selected.length > 0 ? (
            <View style={styles.selectedWrap}>
              {selected.map((chip) => (
                <Pressable
                  key={chip.key}
                  style={styles.selectedPill}
                  onPress={() => onRemove(chip.key)}
                  accessibilityRole="button"
                  accessibilityLabel={`הסר ${chip.label}`}
                >
                  <Ionicons name="close" size={14} color={tokens.colors.text.tertiary} />
                  <Text style={styles.selectedPillText}>{chip.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>אין סף פעיל</Text>
          )}
        </View>
      ) : null}
      {showDivider ? <View style={styles.menuDivider} /> : null}
    </View>
  );
}

function useStyles() {
  const tokens = useDesignTokens();

  return useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, minHeight: 0 },
        header: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 10,
          paddingBottom: APP_LAYOUT.stackGapSmall,
          gap: APP_LAYOUT.cardTitleToBodyGap,
        },
        topBar: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: HEADER_BACK_BTN_SIZE,
        },
        closeSlot: {
          width: HEADER_BACK_BTN_SIZE,
          height: HEADER_BACK_BTN_SIZE,
          overflow: 'visible',
          flexShrink: 0,
        },
        heroBlock: {
          marginBottom: APP_LAYOUT.stackGapSmall,
        },
        priceRow: {
          direction: 'rtl',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: APP_LAYOUT.componentGap,
        },
        priceCol: {
          flexShrink: 0,
          alignItems: 'flex-start',
        },
        livePrice: {
          ...appPhysicalRightText,
          fontSize: APP_TYPE.pageTitle.fontSize,
          lineHeight: APP_TYPE.pageTitle.lineHeight,
          fontWeight: APP_TYPE.pageTitle.fontWeight,
          letterSpacing: APP_TYPE.pageTitle.letterSpacing,
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          fontVariant: ['tabular-nums'],
        },
        liveChangeRow: {
          marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
          alignSelf: 'flex-start',
        },
        liveChange: {
          ...appPhysicalRightText,
          fontSize: APP_TYPE.cardBody.fontSize,
          lineHeight: APP_TYPE.cardBody.lineHeight,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          writingDirection: 'ltr',
          fontVariant: ['tabular-nums'],
        },
        liveChangeMuted: {
          marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
          color: tokens.colors.text.secondary,
        },
        liveTag: {
          ...appPhysicalRightText,
          marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
          fontSize: APP_TYPE.caption.fontSize,
          lineHeight: APP_TYPE.caption.lineHeight,
          fontWeight: APP_TYPE.caption.fontWeight,
          color: tokens.colors.primary.main,
        },
        identityRow: {
          flex: 1,
          minWidth: 0,
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          gap: APP_LAYOUT.cardTitleToBodyGap,
        },
        identityText: {
          flex: 1,
          minWidth: 0,
          alignItems: 'flex-start',
        },
        identityTicker: {
          fontSize: APP_TYPE.sectionTitle.fontSize,
          lineHeight: APP_TYPE.sectionTitle.lineHeight,
          fontWeight: APP_TYPE.sectionTitle.fontWeight,
          letterSpacing: APP_TYPE.sectionTitle.letterSpacing,
          color: tokens.colors.text.primary,
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        companyName: {
          ...appPhysicalLeftText,
          marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
          fontSize: APP_TYPE.cardSubtitle.fontSize,
          lineHeight: APP_TYPE.cardSubtitle.lineHeight,
          fontWeight: APP_TYPE.cardSubtitle.fontWeight,
          color: tokens.colors.text.secondary,
        },
        scroll: { flex: 1, minHeight: 0 },
        scrollContent: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: 8,
          paddingBottom: APP_LAYOUT.cardPadding,
          gap: APP_LAYOUT.cardStackGap,
        },
        chartCard: {
          overflow: 'hidden',
          borderRadius: tokens.borderRadius.xl,
        },
        groupHeading: {
          ...appGroupLabelStyle,
          color: tokens.colors.text.secondary,
        },
        menuRow: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 15,
          paddingHorizontal: APP_LAYOUT.cardPadding,
        },
        menuTextCol: {
          flex: 1,
          minWidth: 0,
        },
        menuTitle: {
          ...appCardTitleStyle,
          color: tokens.colors.text.primary,
        },
        menuSubtitle: {
          ...appCardSubtitleStyle,
          color: tokens.colors.text.secondary,
        },
        leadingIcon: {
          marginLeft: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        menuDivider: {
          height: 1,
          backgroundColor: tokens.colors.border.divider,
          marginHorizontal: APP_LAYOUT.cardPadding,
        },
        statValue: {
          ...appCardBodyStyle,
          width: undefined,
          flexShrink: 1,
          maxWidth: '46%',
          color: tokens.colors.text.primary,
          fontVariant: ['tabular-nums'],
          writingDirection: 'ltr',
          textAlign: 'left',
        },
        switchScale: {
          transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }],
        },
        alertsLocked: {
          opacity: 0.45,
        },
        editor: {
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingBottom: APP_LAYOUT.cardPadding,
          gap: 8,
        },
        sideRow: {
          flexDirection: 'row-reverse',
          gap: 8,
        },
        sideChip: {
          flex: 1,
          minHeight: 40,
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: tokens.borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.background.tertiary,
        },
        sideChipOn: {
          backgroundColor: tokens.colors.primary.dim,
        },
        sideChipText: {
          ...appCaptionStyle,
          width: undefined,
          color: tokens.colors.text.secondary,
        },
        sideChipTextOn: {
          color: tokens.colors.primary.main,
        },
        addField: {
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          minHeight: 48,
          paddingLeft: 6,
          paddingRight: 4,
          borderRadius: tokens.borderRadius.full,
          backgroundColor: tokens.colors.background.tertiary,
          gap: 8,
        },
        addInput: {
          ...formFieldInputStyle(),
          flex: 1,
          minHeight: 44,
          paddingHorizontal: 8,
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'ltr',
          fontVariant: ['tabular-nums'],
          backgroundColor: 'transparent',
        },
        addBtn: {
          minHeight: 36,
          paddingHorizontal: 14,
          borderRadius: tokens.borderRadius.full,
          alignItems: 'center',
          justifyContent: 'center',
        },
        addBtnText: {
          ...appSheetButtonLabelStyle,
          color: tokens.colors.text.primary,
        },
        selectedWrap: {
          direction: 'ltr',
          flexDirection: 'row',
          flexWrap: 'wrap',
          justifyContent: 'flex-end',
          gap: 8,
        },
        selectedPill: {
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minHeight: 36,
          paddingVertical: 6,
          paddingLeft: 10,
          paddingRight: 12,
          borderRadius: tokens.borderRadius.full,
          backgroundColor: tokens.colors.background.primary,
        },
        selectedPillText: {
          ...appCaptionStyle,
          width: undefined,
          color: tokens.colors.text.primary,
        },
        emptyHint: {
          ...appCaptionStyle,
          width: undefined,
          color: tokens.colors.text.secondary,
        },
        notesInput: {
          ...formFieldShellStyle({ tokens, focused: false, multiline: true }),
          ...formFieldInputStyle(),
          borderRadius: tokens.borderRadius.md,
          paddingHorizontal: APP_LAYOUT.cardPadding,
          minHeight: 72,
          color: tokens.colors.text.primary,
        },
        footer: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          paddingTop: APP_LAYOUT.stackGapSmall,
          gap: APP_LAYOUT.stackGapSmall,
          backgroundColor: 'transparent',
        },
        removeBtn: {
          width: '100%',
          minHeight: 36,
          alignItems: 'center',
          justifyContent: 'center',
        },
        removeBtnPressed: { opacity: 0.65 },
        removeText: {
          ...appSheetButtonLabelStyle,
          color: tokens.colors.danger.main,
        },
      }),
    [tokens]
  );
}
