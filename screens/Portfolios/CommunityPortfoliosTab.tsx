import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  TouchableOpacity,
  Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import {
  listPublicPortfolios,
  loadPortfolioDisplaySummary,
  buildHistoricalPortfolioSeriesFromSnapshots,
  buildHistoricalPortfolioSeries,
  getValueHistory,
  getUsersDisplayNamesByIds,
} from '../../services/portfolios';
import type { Portfolio, PortfolioSummary } from './portfolioTypes';
import { CommunityPortfolioLeaderCard } from './components/CommunityPortfolioLeaderCard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfoliosHub'>;

type SortMode = 'default' | 'value_desc' | 'return_desc' | 'name_asc';

/** מדגם עד 60 נקודות מהסדרה לגרף sparkline */
function _downsampleSparkline(values: number[], maxPoints = 60): number[] {
  if (values.length <= maxPoints) return values;
  const result: number[] = [];
  const step = (values.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints; i++) result.push(values[Math.round(i * step)]);
  return result;
}

const SORT_OPTIONS: Array<{
  id: SortMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'default', label: 'עדכון אחרון', icon: 'time-outline' },
  { id: 'value_desc', label: 'לפי שווי (גבוה→נמוך)', icon: 'cash-outline' },
  {
    id: 'return_desc',
    label: 'לפי תשואה (גבוה→נמוך)',
    icon: 'trending-up-outline',
  },
  { id: 'name_asc', label: 'לפי שם (א-ת)', icon: 'text-outline' },
];

interface Row {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  /** ערכים לגרף: מ-portfolio_value_history אם קיים, אחרת מחושב מטרנזקציות */
  sparklineValues: number[] | null;
  sparklineSource: 'history' | 'transactions' | 'none';
  ownerLabel: string;
}

/**
 * תיקים ציבוריים — רשימה נקייה עם חיפוש ומיון בראש המסך.
 * מיון ברירת־מחדל: לפי עדכון אחרון (הכי רלוונטי לגלילה).
 */
export default function CommunityPortfoliosTab() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  const [items, setItems] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortSheetHeight, setSortSheetHeight] = useState(0);

  const sortSnapPoints = useMemo<[number]>(() => {
    const screenH = Dimensions.get('window').height;
    if (sortSheetHeight <= 0) return [0.45];
    const totalH = sortSheetHeight + 88 + 60;
    const fraction = totalH / screenH;
    return [Math.min(0.9, Math.max(0.25, fraction))];
  }, [sortSheetHeight]);

  const handleSortSheetLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setSortSheetHeight((prev) => (Math.abs(prev - h) > 2 ? h : prev));
  }, []);

  const load = useCallback(async () => {
    try {
      const portfolios = await listPublicPortfolios();
      const nameByUser = await getUsersDisplayNamesByIds(
        portfolios.map((p) => p.user_id)
      );
      const enriched = await Promise.all(
        portfolios.map(async (p) => {
          const sumRes = await loadPortfolioDisplaySummary(p).catch(() => null);
          const summary = sumRes ?? null;

          let sparklineValues: number[] | null = null;
          let sparklineSource: Row['sparklineSource'] = 'none';

          try {
            // עדיפות זהה ל-OverviewTab: snapshots (+ unrealized) → tx (ידני) → value_history
            const snapshots = await buildHistoricalPortfolioSeriesFromSnapshots(p.id, 365);
            if (snapshots.length >= 2) {
              sparklineValues = _downsampleSparkline(snapshots.map((s) => s.value));
              sparklineSource = 'history';
            } else if (snapshots.length === 1) {
              sparklineValues = [snapshots[0].value, snapshots[0].value];
              sparklineSource = 'history';
            } else if (p.source !== 'colmex_pro') {
              const txSeries = await buildHistoricalPortfolioSeries(p.id, 365);
              if (txSeries.length >= 2) {
                sparklineValues = _downsampleSparkline(txSeries.map((s) => s.value));
                sparklineSource = 'transactions';
              } else {
                const hist = await getValueHistory(p.id, 365);
                const histValues = hist
                  .map((h) => h.total_value)
                  .filter((v) => Number.isFinite(v) && v > 0);
                if (histValues.length >= 2) {
                  sparklineValues = histValues;
                  sparklineSource = 'history';
                } else if (histValues.length === 1) {
                  sparklineValues = [histValues[0], histValues[0]];
                  sparklineSource = 'history';
                }
              }
            }
            // Colmex בלי snapshots: ריק (לא seed מלאכותי מ-equity)
          } catch {
            // כשל בשליפה — מציגים ריק
          }

          const ownerLabel = nameByUser[p.user_id] ?? 'משתמש';
          return { portfolio: p, summary, sparklineValues, sparklineSource, ownerLabel };
        })
      );
      setItems(enriched);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? items.filter(
          (it) =>
            it.portfolio.name.toLowerCase().includes(q) ||
            it.ownerLabel.toLowerCase().includes(q)
        )
      : items.slice();
    switch (sortMode) {
      case 'value_desc':
        filtered.sort(
          (a, b) =>
            (b.summary?.total_value ?? 0) - (a.summary?.total_value ?? 0)
        );
        break;
      case 'return_desc':
        filtered.sort(
          (a, b) =>
            (b.summary?.total_gain_pct ?? 0) -
            (a.summary?.total_gain_pct ?? 0)
        );
        break;
      case 'name_asc':
        filtered.sort((a, b) =>
          a.portfolio.name.localeCompare(b.portfolio.name, 'he')
        );
        break;
      case 'default':
      default:
        filtered.sort(
          (a, b) =>
            new Date(b.portfolio.updated_at).getTime() -
            new Date(a.portfolio.updated_at).getTime()
        );
        break;
    }
    return filtered;
  }, [items, searchQuery, sortMode]);

  const pad = tokens.layout.screenPadding;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        list: {
          paddingHorizontal: pad,
          paddingTop: 4,
          paddingBottom: mainTabsHeight + 28,
          gap: 14,
        },
        empty: {
          flex: 1,
          paddingHorizontal: pad + 4,
          justifyContent: 'center',
          alignItems: 'center',
          paddingBottom: mainTabsHeight + 40,
        },
        emptyTitle: {
          fontSize: 17,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'center',
        },
        emptySub: {
          marginTop: 8,
          fontSize: 14,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          lineHeight: 20,
        },
        searchHeader: {
          paddingHorizontal: pad,
          paddingTop: 18,
          paddingBottom: 10,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          direction: 'ltr',
        },
        sortBtnWrap: {
          flexShrink: 0,
          zIndex: 2,
          width: 44,
          height: 44,
          borderRadius: 22,
          overflow: 'hidden',
        },
        sortBtnInner: {
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        searchCardWrap: {
          flex: 1,
          minWidth: 0,
        },
        searchInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 12,
          minHeight: 44,
        },
        searchTextInput: {
          flex: 1,
          marginHorizontal: 8,
          color: tokens.colors.text.primary,
          fontSize: 15,
          textAlign: 'right',
          writingDirection: 'rtl',
          paddingVertical: 6,
        },
        sortSheet: {
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 24,
        },
        sortSheetTitle: {
          fontSize: 18,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'right',
          marginBottom: 12,
        },
        sortRow: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: 14,
          gap: 12,
        },
        sortRowActive: {
          backgroundColor: `${tokens.colors.primary.main}1A`,
          borderWidth: 1,
          borderColor: `${tokens.colors.primary.main}55`,
        },
        sortRowText: {
          flex: 1,
          fontSize: 15,
          fontWeight: '600',
          color: tokens.colors.text.primary,
          textAlign: 'right',
        },
        sortRowTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        emptyResults: {
          alignItems: 'center',
          paddingTop: 48,
          paddingHorizontal: pad,
        },
        emptyResultsText: {
          fontSize: 14,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          marginTop: 12,
        },
      }),
    [tokens, mainTabsHeight, pad]
  );

  const renderSearchHeader = useCallback(() => {
    const hasQuery = searchQuery.trim().length > 0;
    return (
      <View style={styles.searchHeader}>
        <TouchableOpacity
          onPress={() => {
            void HapticFeedback.impactLight();
            setSortSheetOpen(true);
          }}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="מיון תיקים"
          style={styles.sortBtnWrap}
        >
          <UICard
            variant="blur"
            glassIntensity="subtle"
            padding="none"
            style={{ borderRadius: 22, overflow: 'hidden', flex: 1 }}
          >
            <View style={styles.sortBtnInner}>
              <Ionicons
                name="filter"
                size={20}
                color={
                  sortMode === 'default'
                    ? tokens.colors.text.secondary
                    : tokens.colors.primary.main
                }
              />
            </View>
          </UICard>
        </TouchableOpacity>

        <View style={styles.searchCardWrap}>
          <UICard
            variant="blur"
            glassIntensity="subtle"
            padding="none"
            style={{ borderRadius: 22, overflow: 'hidden' }}
          >
            <View style={styles.searchInner}>
              {hasQuery ? (
                <TouchableOpacity
                  onPress={() => {
                    void HapticFeedback.selection();
                    setSearchQuery('');
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="close-circle"
                    size={20}
                    color={tokens.colors.text.tertiary}
                  />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 20 }} />
              )}
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="חיפוש תיק או משתמש..."
                placeholderTextColor={tokens.colors.text.tertiary}
                style={styles.searchTextInput}
                returnKeyType="search"
              />
              <Ionicons
                name="search"
                size={18}
                color={tokens.colors.text.tertiary}
              />
            </View>
          </UICard>
        </View>
      </View>
    );
  }, [searchQuery, sortMode, styles, tokens]);

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>אין תיקים ציבוריים עדיין</Text>
          <Text style={styles.emptySub}>כשמישהו ישתף תיק — הוא יופיע כאן.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {renderSearchHeader()}
      <FlatList
        data={filteredItems}
        keyExtractor={(item) => item.portfolio.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <CommunityPortfolioLeaderCard
            portfolio={item.portfolio}
            summary={item.summary}
            sparklineValues={item.sparklineValues}
            sparklineSource={item.sparklineSource}
            ownerLabel={item.ownerLabel}
            onPress={() =>
              navigation.navigate('PortfolioDetail', { portfolioId: item.portfolio.id })
            }
          />
        )}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primary.main}
          />
        }
        ListEmptyComponent={
          searchQuery.trim().length > 0 ? (
            <View style={styles.emptyResults}>
              <Ionicons
                name="search-outline"
                size={36}
                color={tokens.colors.text.tertiary}
              />
              <Text style={styles.emptyResultsText}>
                לא נמצאו תיקים בשם "{searchQuery.trim()}"
              </Text>
            </View>
          ) : null
        }
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <BottomSheet
        isOpen={sortSheetOpen}
        onClose={() => {
          setSortSheetOpen(false);
          setSortSheetHeight(0);
        }}
        snapPoints={sortSnapPoints}
        useGlassBackground
        showBrandBackground={false}
        showHandle
      >
        <View style={styles.sortSheet} onLayout={handleSortSheetLayout}>
          <Text style={styles.sortSheetTitle}>מיון תיקים</Text>
          {SORT_OPTIONS.map((opt) => {
            const isActive = sortMode === opt.id;
            return (
              <TouchableOpacity
                key={opt.id}
                onPress={() => {
                  if (!isActive) void HapticFeedback.selection();
                  setSortMode(opt.id);
                  setSortSheetOpen(false);
                }}
                activeOpacity={0.85}
                style={[styles.sortRow, isActive && styles.sortRowActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: isActive }}
              >
                <Ionicons
                  name={opt.icon}
                  size={20}
                  color={
                    isActive
                      ? tokens.colors.primary.main
                      : tokens.colors.text.secondary
                  }
                />
                <Text
                  style={[
                    styles.sortRowText,
                    isActive && styles.sortRowTextActive,
                  ]}
                >
                  {opt.label}
                </Text>
                {isActive ? (
                  <Ionicons
                    name="checkmark-circle"
                    size={20}
                    color={tokens.colors.primary.main}
                  />
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      </BottomSheet>
    </View>
  );
}
