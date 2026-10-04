import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
  TextInput,
  Dimensions,
  type LayoutChangeEvent,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CardSkeleton } from '../../components/ui/SkeletonLoader';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import {
  listPortfolios,
  loadPortfolioDisplaySummary,
  deletePortfolio,
  buildHistoricalPortfolioSeriesFromSnapshots,
  buildHistoricalPortfolioSeries,
  getValueHistory,
} from '../../services/portfolios';
import type { Portfolio, PortfolioSummary } from './portfolioTypes';
import { PortfolioCard } from './components/PortfolioCard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import {
  JOURNAL_TYPE,
  journalBodyTextStyle,
  journalRow,
  journalRtlContent,
  journalSectionTitleStyle,
} from '../Journal/journalLayout';

type SortMode = 'default' | 'value_desc' | 'return_desc' | 'name_asc';

const SORT_OPTIONS: Array<{
  id: SortMode;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { id: 'default', label: 'ברירת מחדל', icon: 'reorder-three-outline' },
  { id: 'value_desc', label: 'לפי שווי (גבוה→נמוך)', icon: 'cash-outline' },
  {
    id: 'return_desc',
    label: 'לפי תשואה (גבוה→נמוך)',
    icon: 'trending-up-outline',
  },
  { id: 'name_asc', label: 'לפי שם (א-ת)', icon: 'text-outline' },
];


type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfoliosHub'>;

interface PortfolioWithSummary {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
  /** שווי לאורך זמן — רק נקודות אמיתיות, בלי קו שטוח מומצא */
  sparklineValues?: number[] | null;
}

function downsampleSparkline(values: number[], maxPoints = 32): number[] {
  if (values.length <= maxPoints) return values;
  const result: number[] = [];
  const step = (values.length - 1) / (maxPoints - 1);
  for (let i = 0; i < maxPoints - 1; i++) result.push(values[Math.round(i * step)]);
  result.push(values[values.length - 1]);
  return result;
}

async function loadPortfolioSparkline(portfolio: Portfolio): Promise<number[] | null> {
  try {
    const snapshots = await buildHistoricalPortfolioSeriesFromSnapshots(portfolio.id, 365);
    if (snapshots.length >= 2) return downsampleSparkline(snapshots.map((point) => point.value));
    if (portfolio.source === 'colmex_pro') return null;
    const fromTrades = await buildHistoricalPortfolioSeries(portfolio.id, 365);
    if (fromTrades.length >= 2) return downsampleSparkline(fromTrades.map((point) => point.value));
    const history = await getValueHistory(portfolio.id, 365);
    const values = history
      .map((point) => point.total_value)
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length >= 2 ? downsampleSparkline(values) : null;
  } catch {
    return null;
  }
}

/**
 * תיקים אישיים ביומן מסחר — חיפוש/מיון זכוכית מעל, רשימת כרטיסים.
 */
export default function PortfoliosTab() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  // זריעה אופטימית מה-cache (נטען מהדיסק בהפעלה קרה) — רינדור מיידי
  const [items, setItems] = useState<PortfolioWithSummary[]>(
    () => queryClient.getQueryData<PortfolioWithSummary[]>(appQueryKeys.portfolios) ?? []
  );
  const [loading, setLoading] = useState(
    () => !queryClient.getQueryData<PortfolioWithSummary[]>(appQueryKeys.portfolios)
  );
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('default');
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [sortSheetHeight, setSortSheetHeight] = useState(0);

  const sortSnapPoints = useMemo<[number]>(() => {
    const screenH = Dimensions.get('window').height;
    if (sortSheetHeight <= 0) return [0.45];
    // 88px handle + ~60px safe-area+padding תחתון
    const totalH = sortSheetHeight + 88 + 60;
    const fraction = totalH / screenH;
    return [Math.min(0.9, Math.max(0.25, fraction))];
  }, [sortSheetHeight]);

  const handleSortSheetLayout = useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setSortSheetHeight((prev) => (Math.abs(prev - h) > 2 ? h : prev));
  }, []);

  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? items.filter((it) => it.portfolio.name.toLowerCase().includes(q))
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
        break;
    }
    return filtered;
  }, [items, searchQuery, sortMode]);

  const load = useCallback(async () => {
    try {
      const portfolios = await listPortfolios();
      const enriched = await Promise.all(
        portfolios.map(async (p) => {
          try {
            const [summary, sparklineValues] = await Promise.all([
              loadPortfolioDisplaySummary(p),
              loadPortfolioSparkline(p),
            ]);
            return { portfolio: p, summary, sparklineValues };
          } catch {
            return { portfolio: p, summary: null, sparklineValues: null };
          }
        })
      );
      setItems(enriched);
      queryClient.setQueryData(appQueryKeys.portfolios, enriched);
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const handleCreate = useCallback(() => {
    navigation.navigate('CreatePortfolio');
  }, [navigation]);

  const handleOpen = useCallback(
    (portfolioId: string) => {
      navigation.navigate('PortfolioDetail', { portfolioId });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (p: Portfolio) => {
      Alert.alert(
        'מחיקת תיק',
        `האם למחוק את "${p.name}"? פעולה זו אינה ניתנת לביטול והטרנזקציות יימחקו.`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחיקה',
            style: 'destructive',
            onPress: async () => {
              try {
                await deletePortfolio(p.id);
                await load();
              } catch (err) {
                Alert.alert('שגיאה', 'לא הצלחנו למחוק את התיק');
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const glassBg = tokens.colors.glass.card.bg;
  const glassBorder = tokens.colors.glass.card.border;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: {
          flex: 1,
          ...journalRtlContent,
          backgroundColor: 'transparent',
        },
        emptyWrap: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: tokens.layout.screenPadding,
          paddingBottom: mainTabsHeight + 40,
        },
        emptyIconWrap: {
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: 'rgba(0, 200, 5, 0.10)',
          borderWidth: 1,
          borderColor: glassBorder,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        },
        emptyTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
          textAlign: 'center',
          marginBottom: 8,
        },
        emptyText: {
          ...journalBodyTextStyle,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
          marginBottom: 24,
        },
        emptyBtn: {
          ...journalRow,
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 28,
          backgroundColor: tokens.colors.primary.main,
        },
        emptyBtnText: {
          fontSize: JOURNAL_TYPE.body.fontSize,
          fontWeight: '700',
          lineHeight: JOURNAL_TYPE.body.lineHeight,
          color: tokens.colors.text.inverse,
        },
        list: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingTop: 4,
          paddingBottom: mainTabsHeight + 88,
        },
        searchHeader: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingTop: tokens.spacing.sm,
          paddingBottom: tokens.spacing.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          direction: 'ltr',
          backgroundColor: 'transparent',
        },
        sortBtnWrap: {
          flexShrink: 0,
          zIndex: 2,
          width: 44,
          height: 44,
          borderRadius: 22,
          overflow: 'hidden',
          backgroundColor: tokens.colors.background.navChrome,
          borderWidth: 0,
        },
        sortBtnInner: {
          width: '100%',
          height: '100%',
          alignItems: 'center',
          justifyContent: 'center',
        },
        sortSheet: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingTop: tokens.spacing.sm,
          paddingBottom: tokens.spacing.xl,
          direction: 'rtl',
        },
        sortSheetTitle: {
          ...journalSectionTitleStyle,
          color: tokens.colors.text.primary,
          marginBottom: tokens.spacing.md,
        },
        sortRow: {
          ...journalRow,
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: 14,
          borderRadius: tokens.borderRadius.md,
          gap: tokens.spacing.md,
        },
        sortRowActive: {
          backgroundColor: `${tokens.colors.primary.main}1A`,
        },
        sortRowText: {
          flex: 1,
          ...journalBodyTextStyle,
          fontWeight: '600',
          color: tokens.colors.text.primary,
        },
        sortRowTextActive: {
          color: tokens.colors.primary.main,
          fontWeight: '700',
        },
        searchCardWrap: {
          flex: 1,
          minWidth: 0,
          backgroundColor: tokens.colors.background.input,
          borderRadius: tokens.borderRadius.search,
          overflow: 'hidden',
          borderWidth: 0,
        },
        searchInner: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          paddingHorizontal: 14,
          minHeight: 44,
        },
        searchTextInput: {
          flex: 1,
          marginHorizontal: 8,
          color: tokens.colors.text.primary,
          ...journalBodyTextStyle,
          paddingVertical: 6,
        },
        emptyResults: {
          alignItems: 'center',
          paddingTop: 48,
          paddingHorizontal: tokens.layout.screenPadding,
        },
        emptyResultsText: {
          ...journalBodyTextStyle,
          color: tokens.colors.text.tertiary,
          textAlign: 'center',
          marginTop: 12,
        },
      }),
    [tokens, mainTabsHeight, glassBg, glassBorder]
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
        </TouchableOpacity>

        <View style={styles.searchCardWrap}>
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
              placeholder="חיפוש תיק..."
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
        </View>
      </View>
    );
  }, [searchQuery, sortMode, styles, tokens]);

  if (loading && items.length === 0) {
    return (
      <View style={[styles.root, { paddingHorizontal: 20, paddingTop: 12 }]}>
        {Array.from({ length: 3 }).map((_, i) => (
          <CardSkeleton key={i} delay={i * 70} />
        ))}
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="briefcase" size={36} color={tokens.colors.primary.main} />
          </View>
          <Text style={styles.emptyTitle}>עוד אין לך תיק השקעות</Text>
          <Text style={styles.emptyText}>
            צור תיק חדש כדי לעקוב אחרי הביצועים, חלוקת הנכסים, ולקבל אנליזה מקצועית של ההשקעות שלך.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={() => {
              void HapticFeedback.medium();
              handleCreate();
            }}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color={tokens.colors.text.inverse} />
            <Text style={styles.emptyBtnText}>צור תיק חדש</Text>
          </TouchableOpacity>
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
        renderItem={({ item }) => (
          <PortfolioCard
            portfolio={item.portfolio}
            summary={item.summary}
            sparklineValues={item.sparklineValues ?? null}
            onPress={() => handleOpen(item.portfolio.id)}
            onLongPress={() => handleDelete(item.portfolio)}
          />
        )}
        contentContainerStyle={styles.list}
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
