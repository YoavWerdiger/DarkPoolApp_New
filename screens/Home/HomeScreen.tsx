import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import InvestmentDisclaimer from '../../components/legal/InvestmentDisclaimer';
import { useAuth } from '../../context/AuthContext';
import { useMyEnrollments } from '../../hooks/useLearning';
import { getQuotes } from '../../services/portfolios/portfolioPriceFeed';
import { listUserWatchlistSymbols } from '../../services/watchlist/watchlistService';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic, HapticFeedback } from '../../utils/hapticFeedback';
import { formatUntil, getMarketSession, israelTime, MARKET_PHASE_LABEL, type MarketSession } from '../../utils/marketSession';
import { TEXT_DIR } from '../../lib/i18n/language';
import MarketStatusPill from '../../components/ui/MarketStatusPill';
import { hasIntroDataAnswers } from '../../constants/onboardingQuestionnaire';
import { formatPercentChange, percentChange } from '../../utils/format/number';

const INDICES: { symbol: string; label: string }[] = [
  { symbol: 'SPY', label: 'S&P 500' },
  { symbol: 'QQQ', label: 'נאסד״ק 100' },
  { symbol: 'DIA', label: 'דאו ג׳ונס' },
  { symbol: 'IWM', label: 'ראסל 2000' },
];

type QuoteRow = { symbol: string; label: string; price: number | null; changePct: number | null };

/**
 * מסך הבית: מצב השוק, מדדים, Watchlist מקוצר ושיעור הבא — נקודת הכניסה של ה-Tab Bar.
 * כל קטע נכשל בשקט (מציג «—») ולא מפיל את המסך.
 */
export default function HomeScreen() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [session, setSession] = useState<MarketSession>(() => getMarketSession());
  const [indices, setIndices] = useState<QuoteRow[]>(INDICES.map((i) => ({ ...i, price: null, changePct: null })));
  const [watch, setWatch] = useState<QuoteRow[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const { data: enrollments } = useMyEnrollments({ enabled: !!user?.id });

  // מצב השוק — רענון כל 30 שניות (ספירה לאחור בדקות)
  useEffect(() => {
    const id = setInterval(() => setSession(getMarketSession()), 30_000);
    return () => clearInterval(id);
  }, []);

  const load = useCallback(async () => {
    try {
      const watchSymbols = user?.id ? (await listUserWatchlistSymbols(user.id).catch(() => [])).slice(0, 5) : [];
      const quotes = await getQuotes([...INDICES.map((i) => i.symbol), ...watchSymbols.map((w) => w.symbol)]);
      setIndices(
        INDICES.map((i) => {
          const q = quotes.get(i.symbol);
          return { ...i, price: q?.price ?? null, changePct: q ? percentChange(q.price, q.previous_close) : null };
        }),
      );
      setWatch(
        watchSymbols.map((w) => {
          const q = quotes.get(w.symbol);
          return {
            symbol: w.symbol,
            label: w.companyName ?? w.symbol,
            price: q?.price ?? null,
            changePct: q ? percentChange(q.price, q.previous_close) : null,
          };
        }),
      );
    } catch {
      setWatch((prev) => prev ?? []);
    }
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setSession(getMarketSession());
    await load();
    setRefreshing(false);
  }, [load]);

  const nextCourse = useMemo(
    () => (enrollments ?? []).find((c) => (c.progress?.progress_percentage ?? 0) < 100) ?? null,
    [enrollments],
  );

  const openMenu = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const go = (route: string, params?: object) => {
    void HapticFeedback.selection();
    navigation.navigate(route, params);
  };

  const c = tokens.colors;
  const gain = c.success.main;
  const loss = c.danger.main;
  const phaseColor = session.phase === 'open' ? gain : session.phase === 'closed' ? c.text.tertiary : c.warning?.main ?? c.text.secondary;
  const changeColor = (v: number | null) => (v == null ? c.text.tertiary : v >= 0 ? gain : loss);

  const firstName = (user?.display_name || user?.full_name || '').split(' ')[0];

  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <MainDrawerScreenHeader
        title={firstName ? `שלום, ${firstName}` : 'בית'}
        onMenuPress={openMenu}
        titleAccessory={<MarketStatusPill compact />}
      />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
      >
        {/* מצב השוק */}
        <UICard variant="soft" padding="md">
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: phaseColor }]} />
            <Text style={[styles.title, { color: c.text.primary }]}>{MARKET_PHASE_LABEL[session.phase]}</Text>
          </View>
          <Text style={[styles.sub, { color: c.text.secondary }]}>
            {MARKET_PHASE_LABEL[session.nextPhase].replace('השוק ', '')} {formatUntil(session.nextChangeAt - Date.now())} · {israelTime(session.nextChangeAt)} שעון ישראל
          </Text>
        </UICard>

        {/* מדדים */}
        <Text style={[styles.section, { color: c.text.secondary }]}>מדדים</Text>
        <UICard variant="soft" padding="none">
          {indices.map((r, i) => (
            <View
              key={r.symbol}
              style={[styles.quoteRow, i < indices.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border.divider }]}
            >
              <Text style={[styles.quoteName, { color: c.text.primary }]}>{r.label}</Text>
              <Text style={[styles.quotePrice, { color: c.text.primary }]}>{r.price != null ? r.price.toFixed(2) : '—'}</Text>
              <Text style={[styles.quoteChange, { color: changeColor(r.changePct) }]}>{formatPercentChange(r.changePct, { arrows: true })}</Text>
            </View>
          ))}
        </UICard>
        <Text style={[styles.delayed, { color: c.text.tertiary }]}>תעודות סל שעוקבות אחרי המדדים · מחירים עשויים להיות מושהים</Text>

        {/* Watchlist מקוצר */}
        <Pressable style={styles.sectionRow} onPress={() => go('Watchlist')} accessibilityRole="button">
          <Text style={[styles.section, { color: c.text.secondary }]}>רשימת המעקב שלי</Text>
          <Text style={[styles.link, { color: c.text.primary }]}>לכל הרשימה</Text>
        </Pressable>
        <UICard variant="soft" padding="none">
          {watch == null ? (
            <Text style={[styles.empty, { color: c.text.tertiary }]}>טוען…</Text>
          ) : watch.length === 0 ? (
            <Pressable onPress={() => go('Watchlist')} style={styles.emptyRow}>
              <Ionicons name="add-circle-outline" size={20} color={c.text.secondary} />
              <Text style={[styles.empty, { color: c.text.secondary }]}>הוסיפו מניות למעקב</Text>
            </Pressable>
          ) : (
            watch.map((r, i) => (
              <View
                key={r.symbol}
                style={[styles.quoteRow, i < watch.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border.divider }]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.quoteName, { color: c.text.primary }]}>{r.symbol}</Text>
                  {r.label !== r.symbol ? (
                    <Text style={[styles.quoteSub, { color: c.text.tertiary }]} numberOfLines={1}>
                      {r.label}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.quotePrice, { color: c.text.primary }]}>{r.price != null ? `$${r.price.toFixed(2)}` : '—'}</Text>
                <Text style={[styles.quoteChange, { color: changeColor(r.changePct) }]}>{formatPercentChange(r.changePct, { arrows: true })}</Text>
              </View>
            ))
          )}
        </UICard>

        {/* השיעור הבא */}
        {nextCourse ? (
          <>
            <Text style={[styles.section, { color: c.text.secondary }]}>להמשיך ללמוד</Text>
            <Pressable onPress={() => go('Courses')} accessibilityRole="button">
              <UICard variant="soft" padding="md">
                <Text style={[styles.title, { color: c.text.primary }]} numberOfLines={1}>
                  {nextCourse.title}
                </Text>
                <Text style={[styles.sub, { color: c.text.secondary }]}>
                  {nextCourse.progress.completed_lessons} מתוך {nextCourse.progress.total_lessons} שיעורים ·{' '}
                  {Math.round(nextCourse.progress.progress_percentage)}%
                </Text>
                <View style={[styles.bar, { backgroundColor: c.border.divider }]}>
                  <View
                    style={[styles.barFill, { backgroundColor: gain, width: `${Math.min(100, Math.max(0, nextCourse.progress.progress_percentage))}%` }]}
                  />
                </View>
              </UICard>
            </Pressable>
          </>
        ) : null}

        {/* השלמת פרופיל — שאלות ההרשמה שיצאו מהזרימה הקצרה */}
        {user && !hasIntroDataAnswers(user.intro_data) ? (
          <Pressable onPress={() => go('Profile', { screen: 'CompleteProfile' })} accessibilityRole="button">
            <UICard variant="soft" padding="md" style={{ marginTop: 14 }}>
              <View style={styles.row}>
                <Ionicons name="person-add-outline" size={20} color={c.text.primary} />
                <Text style={[styles.title, { color: c.text.primary }]}>השלימו את הפרופיל</Text>
              </View>
              <Text style={[styles.sub, { color: c.text.secondary }]}>
                5 שאלות קצרות על ניסיון וסגנון מסחר — כדי שנתאים לכם תוכן והתראות.
              </Text>
            </UICard>
          </Pressable>
        ) : null}

        {/* קיצורים */}
        <Text style={[styles.section, { color: c.text.secondary }]}>קיצורים</Text>
        <View style={styles.shortcuts}>
          {[
            { route: 'NewsCalendar', icon: 'calendar-outline', label: 'יומן כלכלי' },
            { route: 'NewsEarnings', icon: 'stats-chart-outline', label: 'דוחות' },
            { route: 'Portfolios', icon: 'briefcase-outline', label: 'התיקים שלי' },
            { route: 'Courses', icon: 'school-outline', label: 'קורסים' },
          ].map((s) => (
            <Pressable
              key={s.route}
              onPress={() => go(s.route)}
              style={[styles.shortcut, { backgroundColor: c.background.cardSolid }]}
              accessibilityRole="button"
            >
              <Ionicons name={s.icon as any} size={22} color={c.text.primary} />
              <Text style={[styles.shortcutLabel, { color: c.text.primary }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>

        <InvestmentDisclaimer />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingBottom: 24, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  title: { ...APP_TYPE.cardTitle, writingDirection: TEXT_DIR, textAlign: 'right', flexShrink: 1 },
  sub: { ...APP_TYPE.caption, writingDirection: TEXT_DIR, textAlign: 'right', marginTop: 4 },
  section: { ...APP_TYPE.caption, fontWeight: '600', marginTop: 14, writingDirection: TEXT_DIR, textAlign: 'right' },
  sectionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  link: { ...APP_TYPE.caption, textDecorationLine: 'underline' },
  quoteRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  quoteName: { ...APP_TYPE.body, fontWeight: '600', flex: 1, textAlign: 'right' },
  quoteSub: { ...APP_TYPE.caption, textAlign: 'right' },
  quotePrice: { ...APP_TYPE.body, fontVariant: ['tabular-nums'], minWidth: 72, textAlign: 'left' },
  quoteChange: { ...APP_TYPE.caption, fontWeight: '600', fontVariant: ['tabular-nums'], minWidth: 78, textAlign: 'left' },
  delayed: { ...APP_TYPE.caption, fontSize: 11, textAlign: 'right', writingDirection: TEXT_DIR },
  empty: { ...APP_TYPE.body, padding: 16, textAlign: 'center' },
  emptyRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 8 },
  bar: { height: 6, borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  shortcuts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  shortcut: { flexBasis: '47%', flexGrow: 1, borderRadius: 16, paddingVertical: 16, alignItems: 'center', gap: 6 },
  shortcutLabel: { ...APP_TYPE.caption, fontWeight: '600' },
});
