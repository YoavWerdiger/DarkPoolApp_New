import i18n from '../../../lib/i18n';
import { TEXT_DIR } from '../../../lib/i18n/language';
/**
 * «הוספת מניות» לרשימת מעקב (QA 16.1, 16.3):
 * רשימה ארוכה (S&P 500 + Nasdaq-100 + פופולריות) עם לוגו ושם חברה, חיפוש וסקטורים.
 * לחיצה מוסיפה מיד — אפשר כמה ברצף; מה שכבר ברשימה מסומן ✓ ולא ניתן להוסיף שוב.
 */
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../../components/ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import { TickerLogo } from '../../Portfolios/components/TickerLogo';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import {
  STOCK_SECTORS,
  STOCK_UNIVERSE,
  type StockSector,
  type UniverseStock,
} from '../../../services/watchlist/stockUniverse';

type Filter = 'popular' | 'all' | StockSector;

type Props = {
  visible: boolean;
  onClose: () => void;
  existingSymbols: ReadonlySet<string>;
  onAdd: (stock: UniverseStock) => Promise<void>;
  /** חיפוש בכל השוק (מניות שלא ברשימה המקומית) */
  onSearchAll: () => void;
};

const SECTOR_KEY: Record<StockSector, string> = {
  tech: 's6', comm: 's7', discr: 's8', staples: 's9', health: 's10', fin: 's11',
  ind: 's12', energy: 's13', mat: 's14', re: 's15', util: 's16',
};

const t = (k: string, o?: Record<string, unknown>) => i18n.t(`auto.screens__Watchlist__components__WatchlistAddSheet.${k}`, o);

export function WatchlistAddSheet({ visible, onClose, existingSymbols, onAdd, onSearchAll }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('popular');
  const [adding, setAdding] = useState<string | null>(null);
  const [addedNow, setAddedNow] = useState<ReadonlySet<string>>(new Set());

  const q = query.trim().toLowerCase();
  const data = useMemo(() => {
    let list: readonly UniverseStock[] = STOCK_UNIVERSE;
    if (q) {
      return list
        .filter((s) => s.symbol.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q))
        .sort((a, b) => Number(b.symbol.toLowerCase() === q) - Number(a.symbol.toLowerCase() === q))
        .slice(0, 80);
    }
    if (filter === 'popular') list = list.filter((s) => s.popular);
    else if (filter !== 'all') list = list.filter((s) => s.sector === filter);
    return list;
  }, [q, filter]);

  const isIn = useCallback(
    (sym: string) => existingSymbols.has(sym.toUpperCase()) || addedNow.has(sym),
    [existingSymbols, addedNow],
  );

  const handleAdd = useCallback(
    async (stock: UniverseStock) => {
      if (adding || isIn(stock.symbol)) return;
      void HapticFeedback.selection();
      setAdding(stock.symbol);
      try {
        await onAdd(stock);
        setAddedNow((prev) => new Set(prev).add(stock.symbol));
      } finally {
        setAdding(null);
      }
    },
    [adding, isIn, onAdd],
  );

  const chips: Filter[] = ['popular', 'all', ...STOCK_SECTORS];
  const chipLabel = (f: Filter) =>
    f === 'popular' ? t('s4') : f === 'all' ? t('s5') : t(SECTOR_KEY[f]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={() => {
        setQuery('');
        setAddedNow(new Set());
        onClose();
      }}
      snapPoints={[0.9]}
      enablePanDownToClose
      showHandle
      useModal
      showBrandBackground={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View style={styles.wrap}>
        <Text style={[styles.title, { color: tokens.colors.text.primary }]}>{t('s1')}</Text>
        <View style={[styles.search, { backgroundColor: tokens.colors.background.input }]}>
          <Ionicons name="search" size={18} color={tokens.colors.text.tertiary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={t('s2')}
            placeholderTextColor={tokens.colors.text.tertiary}
            style={[styles.searchInput, { color: tokens.colors.text.primary }]}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
        </View>
        {!q ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsRow}>
            {chips.map((f) => {
              const active = f === filter;
              return (
                <Pressable
                  key={f}
                  onPress={() => {
                    void HapticFeedback.selection();
                    setFilter(f);
                  }}
                  style={[styles.chip, { backgroundColor: active ? tokens.colors.text.primary : tokens.colors.background.tertiary }]}
                >
                  <Text style={[styles.chipText, { color: active ? tokens.colors.background.primary : tokens.colors.text.primary }]}>
                    {chipLabel(f)}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        <FlatList
          data={data}
          keyExtractor={(s) => s.symbol}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          initialNumToRender={14}
          contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 16 }}
          ItemSeparatorComponent={() => <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />}
          renderItem={({ item }) => {
            const inList = isIn(item.symbol);
            const busy = adding === item.symbol;
            return (
              <Pressable
                onPress={() => void handleAdd(item)}
                disabled={inList || !!adding}
                style={styles.row}
                accessibilityRole="button"
                accessibilityLabel={inList ? `${item.name} — ${t('s3')}` : `${t('s17')} ${item.name}`}
              >
                <TickerLogo symbol={item.symbol} size={40} />
                <View style={styles.rowText}>
                  <Text style={[styles.name, { color: tokens.colors.text.primary }]} numberOfLines={1}>{item.name}</Text>
                  <Text style={[styles.symbol, { color: tokens.colors.text.secondary }]}>{item.symbol}</Text>
                </View>
                {inList ? (
                  <View style={styles.inList}>
                    <Ionicons name="checkmark-circle" size={20} color={tokens.colors.success.main} />
                    <Text style={[styles.inListText, { color: tokens.colors.text.secondary }]}>{t('s3')}</Text>
                  </View>
                ) : busy ? (
                  <ActivityIndicator size="small" color={tokens.colors.text.secondary} />
                ) : (
                  <View style={[styles.addBtn, { backgroundColor: tokens.colors.primary.lightCta }]}>
                    <Ionicons name="add" size={20} color={tokens.colors.text.inverse} />
                  </View>
                )}
              </Pressable>
            );
          }}
          ListFooterComponent={
            q ? (
              <Pressable
                onPress={() => {
                  void HapticFeedback.selection();
                  onSearchAll();
                }}
                style={[styles.searchAll, { backgroundColor: tokens.colors.background.tertiary }]}
              >
                <Ionicons name="globe-outline" size={18} color={tokens.colors.text.primary} />
                <Text style={[styles.searchAllText, { color: tokens.colors.text.primary }]}>{t('s18')}</Text>
              </Pressable>
            ) : undefined
          }
        />
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: { flex: 1, paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal },
    title: { ...APP_TYPE.sectionTitle, textAlign: 'center', marginTop: 4, marginBottom: 12 },
    search: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, borderRadius: 24, paddingHorizontal: 16 },
    searchInput: { flex: 1, fontSize: 16, textAlign: 'right', writingDirection: TEXT_DIR },
    chips: { flexGrow: 0, marginTop: 12, marginHorizontal: -APP_LAYOUT.screenPaddingHorizontal },
    chipsRow: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, gap: 8 },
    chip: { height: 34, borderRadius: 17, paddingHorizontal: 14, justifyContent: 'center' },
    chipText: { fontSize: 13, fontWeight: '600' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, marginTop: 2 },
    rowText: { flex: 1 },
    name: { fontSize: 15, fontWeight: '600', textAlign: 'right', writingDirection: 'ltr' },
    symbol: { fontSize: 13, marginTop: 2, textAlign: 'right' },
    divider: { height: StyleSheet.hairlineWidth },
    addBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
    inList: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    inListText: { fontSize: 12 },
    searchAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: 24, marginTop: 16 },
    searchAllText: { fontSize: 15, fontWeight: '600' },
  });
}
