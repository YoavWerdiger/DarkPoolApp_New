import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sun, Moon, ChevronUp, Search } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import UIButton from '../../components/ui/UIButton';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { TickerLogo } from '../../components/ui/TickerLogo';
import EarningsService, { EarningsReport } from '../../services/earningsService';

// ניקוי סימבול לתצוגה — מסיר סיומת ".US" ומינוס מתחילת הקוד. משותף עם התצוגה היומית.
export function getSymbolDisplay(code: string | null | undefined): string {
  let cleanCode = String(code ?? '').replace('.US', '');
  if (cleanCode.startsWith('-')) cleanCode = cleanCode.substring(1);
  return cleanCode.trim();
}

function normalizeTiming(value: string | null | undefined): 'BeforeMarket' | 'AfterMarket' | null {
  if (!value) return null;
  const lower = String(value).toLowerCase();
  if (lower.includes('before') || lower.includes('pre-market') || lower.includes('premarket') || lower.includes('bmo')) {
    return 'BeforeMarket';
  }
  if (lower.includes('after') || lower.includes('post-market') || lower.includes('postmarket') || lower.includes('amc')) {
    return 'AfterMarket';
  }
  return null;
}

function formatReportDayLabel(reportDate: string): { dayLabel: string; dateLabel: string } {
  const d = new Date(`${reportDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { dayLabel: reportDate, dateLabel: '' };
  }
  return {
    dayLabel: d.toLocaleDateString('he-IL', { weekday: 'long' }),
    dateLabel: d.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' }),
  };
}

// מבנה נתונים ליום בודד בשבוע (Mon..Fri)
export interface WeekDay {
  dateKey: string;
  date: Date;
  dayLabel: string; // "יום שני"
  dateLabel: string; // "27 ביולי"
  before: EarningsReport[];
  after: EarningsReport[];
  isToday: boolean;
}

const PRE_COLOR = '#d1a11d'; // זהב — מסחר מוקדם
const POST_COLOR = '#007AFF'; // כחול — מסחר מאוחר
const TILE_LOGO = 40;
const TILE_WIDTH = 56;

function getTimingMeta(value: string | null | undefined): {
  label: string;
  color: string;
  icon: typeof Sun;
} {
  const n = normalizeTiming(value);
  if (n === 'BeforeMarket') return { label: 'מסחר מוקדם', color: PRE_COLOR, icon: Sun };
  if (n === 'AfterMarket') return { label: 'מסחר מאוחר', color: POST_COLOR, icon: Moon };
  return { label: value?.trim() || 'טרם נקבע', color: '#8E8E93', icon: Sun };
}

// אריח לוגו בודד — memo כדי למנוע רינדור מחדש של עשרות אריחים.
const LogoTile = memo(function LogoTile({
  report,
  onPress,
}: {
  report: EarningsReport;
  onPress: (report: EarningsReport) => void;
}) {
  const DesignTokens = useDesignTokens();
  const symbol = getSymbolDisplay(report.code);
  const ringOuter = TILE_LOGO;
  return (
    <Pressable
      onPress={() => onPress(report)}
      style={tileStyles.tile}
      accessibilityRole="button"
      accessibilityLabel={symbol}
    >
      <View
        style={[
          tileStyles.logoRing,
          {
            width: ringOuter,
            height: ringOuter,
            borderRadius: ringOuter / 2,
            borderWidth: 0,
          },
        ]}
      >
        <TickerLogo symbol={symbol} size={TILE_LOGO} />
      </View>
      <Text
        numberOfLines={1}
        style={[tileStyles.tileText, { color: DesignTokens.colors.text.secondary }]}
      >
        {symbol}
      </Text>
    </Pressable>
  );
});

// שורת תוצאת חיפוש — כרטיס זכוכית רך (3xl = 30) למראה פרימיום מעוגל
const SearchResultRow = memo(function SearchResultRow({
  report,
  onPress,
}: {
  report: EarningsReport;
  onPress: (report: EarningsReport) => void;
}) {
  const DesignTokens = useDesignTokens();
  const symbol = getSymbolDisplay(report.code || report.ticker || '');
  const companyName = (report.company_name || report.asset_name || '').trim();
  const { dayLabel, dateLabel } = formatReportDayLabel(report.report_date);
  const timing = getTimingMeta(report.before_after_market || report.report_time);
  const TimingIcon = timing.icon;
  const searchLogoSize = 44;
  const searchRingOuter = searchLogoSize;
  const now = new Date();
  const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const isToday = report.report_date === todayLocal;
  const screenPad = APP_LAYOUT.screenPaddingHorizontal;
  const cardRadius = UI_CARD_RADIUS;
  const rtl = DesignTokens.rtlText;

  return (
    <Pressable
      onPress={() => onPress(report)}
      style={[searchStyles.resultPressable, { marginHorizontal: screenPad }]}
      accessibilityRole="button"
      accessibilityLabel={`${symbol} ${dayLabel} ${timing.label}`}
    >
      <UICard
        variant="soft"
        padding="md"
        style={{ borderRadius: cardRadius, overflow: 'hidden' }}
        contentContainerStyle={searchStyles.resultCardContent}
      >
        <View
          style={[
            searchStyles.logoWrap,
            {
              width: searchRingOuter,
              height: searchRingOuter,
              borderRadius: searchRingOuter / 2,
              alignItems: 'center',
              justifyContent: 'center',
            },
          ]}
        >
          <TickerLogo symbol={symbol} size={searchLogoSize} />
        </View>
        <View style={searchStyles.resultMain}>
          <View style={searchStyles.resultTitleRow}>
            <Text
              style={[
                searchStyles.resultSymbol,
                rtl,
                { color: DesignTokens.colors.text.primary },
              ]}
              numberOfLines={1}
            >
              {symbol}
            </Text>
            {isToday ? (
              <View
                style={[
                  searchStyles.todayPill,
                  {
                    backgroundColor: `${DesignTokens.colors.primary.main}22`,
                  },
                ]}
              >
                <Text style={[searchStyles.todayPillText, { color: DesignTokens.colors.primary.main }]}>
                  היום
                </Text>
              </View>
            ) : null}
          </View>
          {companyName ? (
            <Text
              style={[
                searchStyles.resultCompany,
                rtl,
                { color: DesignTokens.colors.text.secondary },
              ]}
              numberOfLines={1}
            >
              {companyName}
            </Text>
          ) : null}
          <Text
            style={[
              searchStyles.resultWhen,
              rtl,
              { color: DesignTokens.colors.text.tertiary },
            ]}
            numberOfLines={1}
          >
            {dayLabel}
            {dateLabel ? ` · ${dateLabel}` : ''}
          </Text>
        </View>
        <View
          style={[
            searchStyles.timingPill,
            {
              backgroundColor: `${timing.color}18`,
            },
          ]}
        >
          <TimingIcon size={12} color={timing.color} strokeWidth={2.2} />
          <Text style={[searchStyles.timingText, { color: timing.color }]} numberOfLines={1}>
            {timing.label}
          </Text>
        </View>
      </UICard>
    </Pressable>
  );
});

// כותרת תת-סקשן בסגנון SectionDivider (קווים + גלולה זכוכית) — מותאם לכרטיס יום.
const SubSectionHeader: React.FC<{
  label: string;
  icon: React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  color: string;
  count: number;
  isFirst?: boolean;
}> = ({ label, icon: Icon, color, count, isFirst = false }) => {
  const DesignTokens = useDesignTokens();
  return (
    <View style={[weekStyles.subHeader, !isFirst && weekStyles.subHeaderSpaced]}>
      <View style={[weekStyles.subHeaderHairline, { backgroundColor: DesignTokens.colors.border.divider }]} />
      <View style={weekStyles.subHeaderPill}>
        <Icon size={11} color={color} strokeWidth={2.2} />
        <Text style={[weekStyles.subHeaderText, { color: DesignTokens.colors.text.secondary, marginLeft: APP_LAYOUT.cardTitleToBodyGap }]}>
          {label}
        </Text>
        <View
          style={[
            weekStyles.subHeaderCountBadge,
            { backgroundColor: `${color}28` },
          ]}
        >
          <Text style={[weekStyles.subHeaderCount, { color }]}>{count}</Text>
        </View>
      </View>
      <View style={[weekStyles.subHeaderHairline, { backgroundColor: DesignTokens.colors.border.divider }]} />
    </View>
  );
};

// כרטיס יום בודד — memo כדי למנוע רינדור של ימים שלא השתנו.
const DayCard = memo(function DayCard({
  day,
  onReportPress,
}: {
  day: WeekDay;
  onReportPress: (report: EarningsReport) => void;
}) {
  const DesignTokens = useDesignTokens();
  const total = day.before.length + day.after.length;
  const hasBefore = day.before.length > 0;
  const hasAfter = day.after.length > 0;

  return (
      <UICard
        variant="soft"
        padding="md"
      style={weekStyles.dayCard}
      contentContainerStyle={weekStyles.dayCardContent}
    >
      {/* כותרת היום: שם + תגית «היום» בשורה אחת, תאריך מתחת */}
      <View style={[weekStyles.dayHeader, { borderBottomColor: DesignTokens.colors.border.divider }]}>
        <View style={weekStyles.dayHeaderTitleRow}>
          <Text style={[weekStyles.dayName, { color: DesignTokens.colors.text.primary }]}>
            {day.dayLabel}
          </Text>
          {day.isToday ? (
            <View
              style={[
                weekStyles.todayPill,
                {
                  backgroundColor: `${DesignTokens.colors.primary.main}22`,
                },
              ]}
            >
              <Text style={[weekStyles.todayPillText, { color: DesignTokens.colors.primary.main }]}>
                היום
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[weekStyles.dayDate, { color: DesignTokens.colors.text.tertiary }]}>
          {day.dateLabel}
        </Text>
      </View>

      {total === 0 ? (
        <View style={weekStyles.emptyDay}>
          <View style={[weekStyles.emptyDayRule, { backgroundColor: DesignTokens.colors.border.divider }]} />
          <Text style={[weekStyles.emptyDayText, { color: DesignTokens.colors.text.muted }]}>
            אין דיווחים ביום זה
          </Text>
          <View style={[weekStyles.emptyDayRule, { backgroundColor: DesignTokens.colors.border.divider }]} />
        </View>
      ) : (
        <>
          {hasBefore ? (
            <View style={weekStyles.subSection}>
              <SubSectionHeader
                label="מסחר מוקדם"
                icon={Sun}
                color={PRE_COLOR}
                count={day.before.length}
                isFirst
              />
              <View style={weekStyles.tilesWrap}>
                {day.before.map((report, idx) => (
                  <LogoTile key={`${report.id}-${idx}`} report={report} onPress={onReportPress} />
                ))}
              </View>
            </View>
          ) : null}
          {hasAfter ? (
            <View style={weekStyles.subSection}>
              <SubSectionHeader
                label="מסחר מאוחר"
                icon={Moon}
                color={POST_COLOR}
                count={day.after.length}
                isFirst={!hasBefore}
              />
              <View style={weekStyles.tilesWrap}>
                {day.after.map((report, idx) => (
                  <LogoTile key={`${report.id}-${idx}`} report={report} onPress={onReportPress} />
                ))}
              </View>
            </View>
          ) : null}
        </>
      )}
    </UICard>
  );
});

export interface EarningsWeeklyViewProps {
  weekDays: WeekDay[];
  weekLabel: string;
  isCurrentWeek: boolean;
  refreshing: boolean;
  onRefresh: () => void;
  onReportPress: (report: EarningsReport) => void;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToCurrentWeek: () => void;
  bottomPad: number;
}

/**
 * weekKey שעבורו כבר בוצעה גלילה אוטומטית — מודול-level כדי לשרוד remount
 * (מעבר daily↔weekly) ולא לגלול שוב באותו שבוע.
 */
let autoScrolledWeekKey: string | null = null;

const SEARCH_DEBOUNCE_MS = 300;

const EarningsWeeklyView: React.FC<EarningsWeeklyViewProps> = ({
  weekDays,
  weekLabel,
  isCurrentWeek,
  refreshing,
  onRefresh,
  onReportPress,
  onPrevWeek,
  onNextWeek,
  onGoToCurrentWeek,
  bottomPad,
}) => {
  const DesignTokens = useDesignTokens();
  const screenPad = APP_LAYOUT.screenPaddingHorizontal;
  const listRef = useRef<FlatList<WeekDay>>(null);
  const searchListRef = useRef<FlatList<EarningsReport>>(null);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const scrollButtonOpacity = useRef(new Animated.Value(0)).current;
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EarningsReport[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchReqIdRef = useRef(0);

  const isSearchMode = debouncedQuery.trim().length > 0;

  // Debounce לקלט החיפוש (~300ms)
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchQuery.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // שליפת תוצאות מה-DB (טווח רחב — לא רק השבוע המוצג)
  useEffect(() => {
    const q = debouncedQuery.trim();
    if (!q) {
      searchReqIdRef.current += 1;
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    const reqId = ++searchReqIdRef.current;
    setSearchLoading(true);
    void (async () => {
      const rows = await EarningsService.searchReports(q, { limit: 25 });
      if (searchReqIdRef.current !== reqId) return;
      setSearchResults(rows);
      setSearchLoading(false);
    })();
  }, [debouncedQuery]);

  const clearSearch = useCallback(() => {
    searchReqIdRef.current += 1;
    setSearchQuery('');
    setDebouncedQuery('');
    setSearchResults([]);
    setSearchLoading(false);
  }, []);

  const weekKey = weekDays[0]?.dateKey ?? '';

  const totalWeekReports = useMemo(
    () => weekDays.reduce((sum, d) => sum + d.before.length + d.after.length, 0),
    [weekDays],
  );

  /** אינדקס יעד לגלילה: היום אם יש ב-Mon–Fri; בסופ״ש של השבוע הנוכחי — שישי (4). */
  const todayScrollIndex = useMemo(() => {
    if (!isCurrentWeek || weekDays.length === 0) return -1;
    const todayIdx = weekDays.findIndex((d) => d.isToday);
    if (todayIdx >= 0) return todayIdx;
    // Sat/Sun: אין עמודת «היום» — נוחתים על שישי של השבוע הנוכחי
    return Math.min(4, weekDays.length - 1);
  }, [isCurrentWeek, weekDays]);

  const scrollDayToTop = useCallback((index: number, animated: boolean) => {
    listRef.current?.scrollToIndex({
      index,
      animated,
      viewPosition: 0,
    });
  }, []);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; highestMeasuredFrameIndex: number; averageItemLength: number }) => {
      const offset = Math.max(0, info.averageItemLength * info.index);
      listRef.current?.scrollToOffset({ offset, animated: false });
      requestAnimationFrame(() => {
        setTimeout(() => {
          scrollDayToTop(info.index, true);
        }, 50);
      });
    },
    [scrollDayToTop],
  );

  const scheduleScrollToToday = useCallback(() => {
    if (isSearchMode) return;
    if (!isCurrentWeek || !weekKey || weekDays.length === 0) return;
    const targetIndex = todayScrollIndex;
    if (targetIndex < 0) return;

    // חד־פעמי לכל weekKey — לא חוזר ב-FAB / remount / refresh
    if (autoScrolledWeekKey === weekKey) return;

    // שני (אינדקס 0) — כבר בראש; מסמנים בלי לגלול
    if (targetIndex === 0) {
      autoScrolledWeekKey = weekKey;
      return;
    }

    if (scrollTimerRef.current) {
      clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = null;
    }

    // מסמנים רק אחרי ה-timeout (Strict Mode: cleanup מבטל, הריצה השנייה תזמן שוב)
    scrollTimerRef.current = setTimeout(() => {
      scrollTimerRef.current = null;
      autoScrolledWeekKey = weekKey;
      scrollDayToTop(targetIndex, true);
    }, 160);
  }, [isSearchMode, isCurrentWeek, weekKey, weekDays.length, todayScrollIndex, scrollDayToTop]);

  // יציאה מהשבוע הנוכחי / שינוי שבוע — מבטלים טיימר תלוי (הנעילה נשארת לפי weekKey)
  useEffect(() => {
    if (!isCurrentWeek || isSearchMode) {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    }
  }, [isCurrentWeek, isSearchMode]);

  // כניסה לשבוע הנוכחי — גלילה לכרטיס היום / שישי (פעם אחת ל-weekKey)
  useEffect(() => {
    if (!isCurrentWeek || isSearchMode) return;
    scheduleScrollToToday();
    return () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = null;
      }
    };
  }, [isCurrentWeek, isSearchMode, weekKey, weekDays.length, todayScrollIndex, scheduleScrollToToday]);

  // איפוס כפתור גלילה לראש במעבר ל/ממצב חיפוש
  useEffect(() => {
    setShowScrollToTop(false);
    scrollButtonOpacity.setValue(0);
  }, [isSearchMode, scrollButtonOpacity]);

  const handleScroll = useCallback(
    (event: { nativeEvent: { contentOffset: { y: number } } }) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      const shouldShow = offsetY > 300;
      if (shouldShow !== showScrollToTop) {
        setShowScrollToTop(shouldShow);
        Animated.timing(scrollButtonOpacity, {
          toValue: shouldShow ? 1 : 0,
          duration: 200,
          useNativeDriver: true,
        }).start();
      }
    },
    [showScrollToTop, scrollButtonOpacity],
  );

  const scrollToTop = useCallback(() => {
    if (isSearchMode) {
      searchListRef.current?.scrollToOffset({ offset: 0, animated: true });
    } else {
      listRef.current?.scrollToOffset({ offset: 0, animated: true });
    }
  }, [isSearchMode]);

  const renderSearchBar = useCallback(
    () => (
      <View style={{ paddingHorizontal: screenPad, paddingTop: 8, paddingBottom: 4 }}>
        <UICard
          variant="blur"
          glassIntensity="subtle"
          padding="none"
          style={{ borderRadius: DesignTokens.borderRadius.search, overflow: 'hidden' }}
        >
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              paddingHorizontal: 12,
              minHeight: 42,
            }}
          >
            {searchQuery.length > 0 ? (
              <TouchableOpacity
                onPress={clearSearch}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel="נקה חיפוש"
              >
                <Ionicons name="close-circle" size={20} color={DesignTokens.colors.text.tertiary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 20 }} />
            )}
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="חיפוש טיקר או חברה..."
              placeholderTextColor={DesignTokens.colors.text.tertiary}
                style={{
                  flex: 1,
                  marginHorizontal: 8,
                  ...APP_TYPE.body,
                  color: DesignTokens.colors.text.primary,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  paddingVertical: 8,
                }}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              clearButtonMode="never"
              accessibilityLabel="חיפוש טיקר או חברה"
            />
            {searchLoading && isSearchMode ? (
              <ActivityIndicator size="small" color={DesignTokens.colors.text.tertiary} />
            ) : (
              <Ionicons name="search" size={18} color={DesignTokens.colors.text.tertiary} />
            )}
          </View>
        </UICard>
      </View>
    ),
    [screenPad, searchQuery, clearSearch, DesignTokens, searchLoading, isSearchMode],
  );

  const renderWeekNavigator = useCallback(
    () => (
      <View style={{ paddingHorizontal: screenPad, paddingTop: 10, paddingBottom: 16 }}>
        <UICard
          variant="blur"
          glassIntensity="subtle"
          padding="none"
          style={{
            borderRadius: DesignTokens.borderRadius.full,
            overflow: 'hidden',
            paddingVertical: 12,
            paddingHorizontal: 14,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              direction: 'ltr',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <DayNavBlurButton onPress={onPrevWeek} glass glassIntensity="subtle" accessibilityLabel="שבוע קודם">
              <Ionicons name="chevron-back" size={20} color={DesignTokens.colors.text.primary} />
            </DayNavBlurButton>

            <View style={{ alignItems: 'center', flex: 1, paddingHorizontal: 10 }}>
              <Text
                style={{
                  ...APP_TYPE.cardTitle,
                  color: DesignTokens.colors.text.primary,
                  textAlign: 'center',
                }}
                numberOfLines={2}
              >
                {weekLabel}
              </Text>
              <Text
                style={{
                  ...APP_TYPE.caption2,
                  color: isCurrentWeek
                    ? DesignTokens.colors.primary.main
                    : DesignTokens.colors.text.tertiary,
                  marginTop: APP_LAYOUT.titleSubtitleGap,
                }}
              >
                {isCurrentWeek ? 'השבוע הנוכחי' : `${totalWeekReports} דיווחים`}
              </Text>
            </View>

            <DayNavBlurButton onPress={onNextWeek} glass glassIntensity="subtle" accessibilityLabel="שבוע הבא">
              <Ionicons name="chevron-forward" size={20} color={DesignTokens.colors.text.primary} />
            </DayNavBlurButton>
          </View>
        </UICard>
      </View>
    ),
    [screenPad, DesignTokens, onPrevWeek, onNextWeek, weekLabel, isCurrentWeek, totalWeekReports],
  );

  const renderItem = useCallback(
    ({ item }: { item: WeekDay }) => <DayCard day={item} onReportPress={onReportPress} />,
    [onReportPress],
  );

  const renderSearchItem = useCallback(
    ({ item }: { item: EarningsReport }) => (
      <SearchResultRow report={item} onPress={onReportPress} />
    ),
    [onReportPress],
  );

  const renderSearchEmpty = useCallback(() => {
    if (searchLoading) {
      return (
        <View style={searchStyles.emptyWrap}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={[searchStyles.emptyTitle, { color: DesignTokens.colors.text.secondary }]}>
            מחפש דיווחים...
          </Text>
        </View>
      );
    }
    return (
      <View style={searchStyles.emptyWrap}>
        <Search size={40} color={DesignTokens.colors.text.tertiary} strokeWidth={1.8} />
        <Text style={[searchStyles.emptyTitle, { color: DesignTokens.colors.text.primary }]}>
          אין תוצאות לחיפוש
        </Text>
        <Text style={[searchStyles.emptySubtitle, { color: DesignTokens.colors.text.tertiary }]}>
          נסו טיקר (למשל NVDA) או שם חברה
        </Text>
      </View>
    );
  }, [searchLoading, DesignTokens]);

  const showCurrentWeekFab = !isCurrentWeek && !isSearchMode;

  return (
    <View style={{ flex: 1, minHeight: 0 }}>
      {/* חיפוש + ניווט שבוע דביקים מחוץ ל-FlatList (כמו ניווט יומי) */}
      {renderSearchBar()}
      {!isSearchMode ? renderWeekNavigator() : null}

      {isSearchMode ? (
        <FlatList
          ref={searchListRef}
          data={searchResults}
          keyExtractor={(item, index) => `${item.id}-${item.report_date}-${index}`}
          renderItem={renderSearchItem}
          ListEmptyComponent={renderSearchEmpty}
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 10,
            paddingBottom: bottomPad,
            flexGrow: searchResults.length === 0 ? 1 : undefined,
          }}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      ) : (
        <FlatList
          ref={listRef}
          data={weekDays}
          keyExtractor={(item) => item.dateKey}
          renderItem={renderItem}
          style={{ flex: 1 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={DesignTokens.colors.success.main}
              colors={[DesignTokens.colors.success.main]}
            />
          }
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: 6, paddingBottom: bottomPad }}
          onScroll={handleScroll}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          scrollEventThrottle={16}
          initialNumToRender={5}
          maxToRenderPerBatch={5}
          windowSize={7}
          removeClippedSubviews={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        />
      )}

      {showCurrentWeekFab && (
        <View style={weekStyles.fabWrap} pointerEvents="box-none">
          <UIButton
            title="השבוע הנוכחי"
            variant="primary"
            icon="calendar-outline"
            iconPosition="right"
            onPress={onGoToCurrentWeek}
          />
        </View>
      )}

      {/* כפתור גלילה לראש — מיקום כמו צ'אט (ימין תחתון), זכוכית UICard glass/light, גודל 44 */}
      {showScrollToTop && (
        <Animated.View
          style={{
            position: 'absolute',
            bottom: showCurrentWeekFab ? 16 + 72 : 16,
            right: 12,
            width: 44,
            height: 44,
            opacity: scrollButtonOpacity,
            transform: [
              {
                scale: scrollButtonOpacity.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.8, 1],
                }),
              },
            ],
            zIndex: 1000,
          }}
          pointerEvents="auto"
        >
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              overflow: 'hidden',
              flexShrink: 0,
            }}
          >
            <UICard
              variant="glass"
              glassIntensity="light"
              padding="none"
              onPress={scrollToTop}
              accessibilityLabel="גלול לראש הרשימה"
              style={{ width: 44, height: 44, borderRadius: 22, overflow: 'hidden' }}
              contentContainerStyle={{
                width: 44,
                height: 44,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <ChevronUp size={22} color={DesignTokens.colors.text.primary} strokeWidth={2.3} />
            </UICard>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const tileStyles = StyleSheet.create({
  tile: {
    width: TILE_WIDTH,
    alignItems: 'center',
  },
  logoRing: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: {
    marginTop: APP_LAYOUT.cardMetricLabelToValueGap,
    ...APP_TYPE.caption2,
    textAlign: 'center',
    maxWidth: TILE_WIDTH,
  },
});

const searchStyles = StyleSheet.create({
  resultPressable: {
    marginBottom: APP_LAYOUT.cardStackGap,
  },
  resultCardContent: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    width: '100%',
  },
  logoWrap: {
    flexShrink: 0,
    marginLeft: APP_LAYOUT.cardTitleToBodyGap,
  },
  resultMain: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  resultTitleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    maxWidth: '100%',
  },
  resultSymbol: {
    flexShrink: 1,
    ...APP_TYPE.cardTitle,
  },
  resultCompany: {
    ...APP_TYPE.cardSubtitle,
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    maxWidth: '100%',
  },
  resultWhen: {
    marginTop: APP_LAYOUT.titleSubtitleGap,
    ...APP_TYPE.caption,
  },
  todayPill: {
    flexShrink: 0,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    borderWidth: 0,
    marginLeft: APP_LAYOUT.stackGapSmall,
  },
  todayPillText: {
    ...APP_TYPE.caption2,
    textAlign: 'center',
  },
  timingPill: {
    flexShrink: 0,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 9999,
    borderWidth: 0,
    maxWidth: 118,
  },
  timingText: {
    ...APP_TYPE.caption2,
    textAlign: 'center',
    marginLeft: APP_LAYOUT.stackGapSmall,
  },
  emptyWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingVertical: 48,
  },
  emptyTitle: {
    ...APP_TYPE.sectionTitle,
    textAlign: 'center',
    marginTop: APP_LAYOUT.componentGap,
  },
  emptySubtitle: {
    ...APP_TYPE.cardSubtitle,
    textAlign: 'center',
    marginTop: APP_LAYOUT.groupLabelToContent,
  },
});

const weekStyles = StyleSheet.create({
  dayCard: {
    marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    marginBottom: APP_LAYOUT.cardStackGap,
    borderRadius: UI_CARD_RADIUS,
  },
  dayCardContent: {
    alignItems: 'center',
    width: '100%',
  },
  dayHeader: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    marginBottom: 4,
    paddingBottom: 10,
    borderBottomWidth: 1,
  },
  dayHeaderTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayName: {
    ...APP_TYPE.cardTitle,
    textAlign: 'center',
  },
  dayDate: {
    ...APP_TYPE.cardSubtitle,
    textAlign: 'center',
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  todayPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 9999,
    borderWidth: 0,
    marginLeft: APP_LAYOUT.stackGapSmall,
  },
  todayPillText: {
    ...APP_TYPE.caption2,
    textAlign: 'center',
  },
  emptyDay: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 4,
    gap: 10,
  },
  emptyDayRule: {
    flex: 1,
    height: 1,
    backgroundColor: 'transparent',
  },
  emptyDayText: {
    ...APP_TYPE.body,
    textAlign: 'center',
  },
  subSection: {
    width: '100%',
    alignItems: 'center',
  },
  subHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  subHeaderSpaced: {
    marginTop: 14,
  },
  subHeaderHairline: {
    flex: 1,
    height: 1,
  },
  subHeaderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 10,
    paddingVertical: 0,
    borderWidth: 0,
  },
  subHeaderText: {
    ...APP_TYPE.groupLabel,
    textAlign: 'center',
  },
  subHeaderCountBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subHeaderCount: {
    ...APP_TYPE.caption2,
    textAlign: 'center',
  },
  tilesWrap: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    columnGap: 10,
    rowGap: 12,
    paddingHorizontal: 2,
    marginBottom: 2,
  },
  fabWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: APP_LAYOUT.componentGap,
    zIndex: 40,
  },
});

export default memo(EarningsWeeklyView);
