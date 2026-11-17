import i18n from '../../../lib/i18n';
import { ROOT_DIR, UI_DIR } from '../../../lib/i18n/direction';
/**
 * «הוספת מניות» לרשימת מעקב (QA 16.1, 16.3) — לפי הטופו של השיטים (כמו בורר האימוג'י):
 * כותרת עם שברון, שדה חיפוש formField, צ'יפים DayDividerPill, שורות כמו ברשימה.
 * לחיצה מוסיפה מיד (אפשר כמה ברצף); מה שכבר ברשימה — ✓ ולא ניתן להוסיף שוב.
 * חיפוש בכל השוק — באותו שיט (בלי מודל נוסף: שני מודלים ב-iOS נתקעו והמסך קפא).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { ActivityIndicator } from '../../../components/ui/AppSpinner';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../../../components/ui/appType';
import { DayDividerPill } from '../../../components/ui/DayDividerPill';
import {
  formFieldInputStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../../components/ui/formControl';
import { ChatSheetTopoHeader } from '../../../components/chat/ChatBottomSheet';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import { searchSymbols } from '../../../services/portfolios/portfolioPriceFeed';
import {
  STOCK_SECTORS,
  STOCK_UNIVERSE,
  type StockSector,
} from '../../../services/watchlist/stockUniverse';
import { RtlHorizontalScroll } from '../../../components/ui/RtlHorizontalScroll';

type Filter = 'popular' | 'all' | StockSector;
type Row = { symbol: string; name: string };
type Section = { key: string; title?: string; data: Row[] };

type Props = {
  visible: boolean;
  onClose: () => void;
  existingSymbols: ReadonlySet<string>;
  onAdd: (symbol: string, name: string) => Promise<void>;
};

const SECTOR_KEY: Record<StockSector, string> = {
  tech: 's6', comm: 's7', discr: 's8', staples: 's9', health: 's10', fin: 's11',
  ind: 's12', energy: 's13', mat: 's14', re: 's15', util: 's16',
};
// כמו בשורות הרשימה עצמה (WatchlistRow)
const LOGO = 28;

const t = (k: string, o?: Record<string, unknown>) =>
  i18n.t(`auto.screens__Watchlist__components__WatchlistAddSheet.${k}`, o);

export function WatchlistAddSheet({ visible, onClose, existingSymbols, onAdd }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<Filter>('popular');
  const [adding, setAdding] = useState<string | null>(null);
  const [addedNow, setAddedNow] = useState<ReadonlySet<string>>(new Set());
  const [market, setMarket] = useState<Row[]>([]);
  const [marketLoading, setMarketLoading] = useState(false);
  const reqRef = useRef(0);

  const q = query.trim().toLowerCase();

  useEffect(() => {
    if (!visible) {
      setQuery('');
      setAddedNow(new Set());
      setMarket([]);
    }
  }, [visible]);

  // חיפוש בכל השוק (debounce) — מתווסף מתחת לתוצאות מהרשימה המוכרת
  useEffect(() => {
    if (!q) {
      setMarket([]);
      setMarketLoading(false);
      return;
    }
    const id = ++reqRef.current;
    setMarketLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await searchSymbols(q);
        if (id !== reqRef.current) return;
        setMarket(res.slice(0, 20).map((r) => ({ symbol: r.symbol.toUpperCase(), name: r.description || r.symbol })));
      } catch {
        if (id === reqRef.current) setMarket([]);
      } finally {
        if (id === reqRef.current) setMarketLoading(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const sections = useMemo<Section[]>(() => {
    if (q) {
      const local = STOCK_UNIVERSE.filter(
        (s) => s.symbol.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q),
      )
        .sort((a, b) => Number(b.symbol.toLowerCase() === q) - Number(a.symbol.toLowerCase() === q))
        .slice(0, 30);
      const seen = new Set(local.map((s) => s.symbol));
      const extra = market.filter((m) => !seen.has(m.symbol));
      const out: Section[] = [];
      if (local.length) out.push({ key: 'local', data: local });
      if (extra.length) out.push({ key: 'market', title: t('s18'), data: extra });
      return out;
    }
    let list = STOCK_UNIVERSE;
    if (filter === 'popular') list = list.filter((s) => s.popular);
    else if (filter !== 'all') list = list.filter((s) => s.sector === filter);
    return [{ key: filter, data: list.map((x) => ({ symbol: x.symbol, name: x.name })) }];
  }, [q, filter, market]);

  const isIn = useCallback(
    (sym: string) => existingSymbols.has(sym.toUpperCase()) || addedNow.has(sym.toUpperCase()),
    [existingSymbols, addedNow],
  );

  const handleAdd = useCallback(
    async (row: Row) => {
      if (adding || isIn(row.symbol)) return;
      void HapticFeedback.selection();
      setAdding(row.symbol);
      try {
        await onAdd(row.symbol, row.name);
        setAddedNow((prev) => new Set(prev).add(row.symbol.toUpperCase()));
      } finally {
        setAdding(null);
      }
    },
    [adding, isIn, onAdd],
  );

  const chips: Filter[] = ['popular', 'all', ...STOCK_SECTORS];
  const chipLabel = (f: Filter) => (f === 'popular' ? t('s4') : f === 'all' ? t('s5') : t(SECTOR_KEY[f]));
  const noResults = !!q && !marketLoading && sections.length === 0;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.9]}
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      contentPaddingBottom={0}
    >
      <View style={[styles.root, { direction: UI_DIR }]}>
        <ChatSheetTopoHeader title={t('s1')} onClose={onClose} />

        <View style={[formFieldShellStyle({ tokens, focused }), styles.searchField]}>
          <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={t('s2')}
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), styles.searchInput]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
            textContentType="none"
          />
          {marketLoading ? <ActivityIndicator size="small" color={tokens.colors.text.tertiary} /> : null}
          {query.length > 0 ? (
            <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={tokens.colors.text.tertiary} />
            </TouchableOpacity>
          ) : null}
        </View>

        {!q ? (
          <RtlHorizontalScroll
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chips}
            contentContainerStyle={styles.chipsRow}
            keyboardShouldPersistTaps="handled"
          >
            {chips.map((f) => (
              <DayDividerPill
                key={f}
                selected={f === filter}
                instantSelection
                onPress={() => {
                  void HapticFeedback.selection();
                  setFilter(f);
                }}
              >
                {chipLabel(f)}
              </DayDividerPill>
            ))}
          </RtlHorizontalScroll>
        ) : null}

        <SectionList
          sections={sections}
          keyExtractor={(r, i) => `${r.symbol}-${i}`}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={14}
          windowSize={7}
          showsVerticalScrollIndicator={false}
          style={styles.list}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 12 }}
          ItemSeparatorComponent={() => (
            <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
          )}
          ListEmptyComponent={
            noResults ? <Text style={[styles.empty, { color: tokens.colors.text.tertiary }]}>{t('s21')}</Text> : undefined
          }
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text style={[styles.sectionTitle, { color: tokens.colors.text.secondary }]}>{section.title}</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const inList = isIn(item.symbol);
            const busy = adding === item.symbol;
            return (
              <Pressable
                onPress={() => void handleAdd(item)}
                disabled={inList || !!adding}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={inList ? `${item.symbol} — ${t('s3')}` : `${t('s17')} ${item.symbol}`}
              >
                <TickerLogo symbol={item.symbol} size={LOGO} />
                <View style={styles.rowText}>
                  <Text style={[styles.symbol, { color: tokens.colors.text.primary }]} numberOfLines={1}>
                    {item.symbol}
                  </Text>
                  <Text style={[styles.name, { color: tokens.colors.text.secondary }]} numberOfLines={1}>
                    {item.name}
                  </Text>
                </View>
                {inList ? (
                  <View style={styles.addBtn}>
                    <Ionicons name="checkmark" size={20} color={tokens.colors.success.main} />
                  </View>
                ) : (
                  <View style={[styles.addBtn, { backgroundColor: tokens.colors.background.tertiary }]}>
                    {busy ? (
                      <ActivityIndicator size="small" color={tokens.colors.text.primary} />
                    ) : (
                      <Ionicons name="add" size={20} color={tokens.colors.text.primary} />
                    )}
                  </View>
                )}
              </Pressable>
            );
          }}
        />
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal },
    searchField: {
      direction: ROOT_DIR,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      borderRadius: 9999,
      paddingHorizontal: 16,
      marginTop: APP_LAYOUT.cardTitleToBodyGap,
    },
    searchInput: { flex: 1, minHeight: 48 },
    chips: { flexGrow: 0, marginTop: 12, marginHorizontal: -APP_LAYOUT.screenPaddingHorizontal },
    // כמו שורת הצ'יפים בחקור — מתחילים מימין (UI_DIR)
    chipsRow: { direction: UI_DIR, paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, gap: 8 },
    list: { flex: 1, marginTop: 8 },
    sectionTitle: {
      ...APP_TYPE.caption,
      ...appPhysicalRightText,
      marginTop: 16,
      marginBottom: 4,
    },
    row: {
      direction: ROOT_DIR,
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      paddingVertical: 8,
    },
    rowText: { flex: 1, gap: 2 },
    // טיפוגרפיה של WatchlistRow: טיקר cardSubtitle במשקל כותרת, שם החברה caption2
    symbol: {
      ...APP_TYPE.cardSubtitle,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      ...appPhysicalRightText,
      writingDirection: 'ltr',
    },
    name: { ...APP_TYPE.caption2, ...appPhysicalRightText },
    divider: { height: StyleSheet.hairlineWidth, marginRight: LOGO + 12 },
    addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    empty: { ...APP_TYPE.body, textAlign: 'center', marginTop: 32 },
  });
}
