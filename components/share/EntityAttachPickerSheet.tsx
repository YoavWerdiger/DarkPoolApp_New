import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { DayDividerPill, SlidingPillGroup } from '../ui/DayDividerPill';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { fetchFeaturedProfiles } from '../../services/darkpool/featuredProfilesService';
import { NewsService, type NewsArticle } from '../../services/newsService';
import {
  buildNewsAttachment,
  buildPersonAttachment,
  buildEarningsAttachment,
  type ShareableAttachment,
} from '../../types/shareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { TickerLogo } from '../ui/TickerLogo';

type Category = 'people' | 'earnings' | 'news';

const TAB_OPTIONS: { id: Category; label: string }[] = [
  { id: 'people', label: 'אנשים' },
  { id: 'earnings', label: 'דוחות' },
  { id: 'news', label: 'חדשות' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (attachment: ShareableAttachment) => void;
};

type ListItem = {
  key: string;
  title: string;
  subtitle?: string;
  imageUrl?: string | null;
  badge?: string;
  attachment: ShareableAttachment;
};


export default function EntityAttachPickerSheet({
  visible,
  onClose,
  onSelect,
}: Props) {
  const tokens = useDesignTokens();
  const { user } = useAuth();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const [category, setCategory] = useState<Category>('people');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<ListItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    try {
      if (category === 'people') {
        const rows = await fetchFeaturedProfiles();
        setItems(
          rows.slice(0, 30).map((p) => {
            const attachment = buildPersonAttachment({
              id: p.person_id,
              kind: p.kind,
              name: p.name,
              subtitle: p.subtitle,
              imageUrl: p.image_url,
              ticker: p.ticker,
            });
            return {
              key: `person-${p.person_id}`,
              title: p.name,
              subtitle: p.subtitle ?? undefined,
              imageUrl: p.image_url,
              badge: attachment.preview.badge,
              attachment,
            };
          })
        );
      } else if (category === 'earnings') {
        // דוחות רבעוניים: שבוע אחורה (עם תוצאות) + 3 ימים קדימה; בכל יום — לפי שווי שוק
        const today = new Date();
        const from = new Date(today);
        from.setDate(from.getDate() - 7);
        const to = new Date(today);
        to.setDate(to.getDate() + 3);
        const iso = (d: Date) => d.toISOString().slice(0, 10);
        const { data, error: qErr } = await supabase
          .from('earnings_calendar')
          .select(
            'id, ticker, symbol, code, company_name, report_date, before_after_market, report_time, eps, actual, eps_estimate, estimate, revenue, revenue_actual, revenue_estimate, market_cap',
          )
          .gte('report_date', iso(from))
          .lte('report_date', iso(to))
          .order('report_date', { ascending: false })
          .limit(400);
        if (qErr) throw qErr;
        const rows = ((data ?? []) as Array<Parameters<typeof buildEarningsAttachment>[0] & {
          market_cap?: string | number | null;
        }>)
          .filter((r) => r.company_name)
          .sort((a, b) => {
            const d = String(b.report_date ?? '').localeCompare(String(a.report_date ?? ''));
            if (d !== 0) return d;
            return (Number(b.market_cap) || 0) - (Number(a.market_cap) || 0);
          })
          .slice(0, 60);
        setItems(
          rows.map((r) => {
            const attachment = buildEarningsAttachment(r);
            return {
              key: `earnings-${r.id}`,
              title: attachment.preview.title,
              subtitle: [attachment.preview.subtitle, attachment.preview.metrics?.eps ?? attachment.preview.metrics?.report_when]
                .filter(Boolean)
                .join(' · '),
              imageUrl: attachment.preview.imageUrl ?? null,
              badge: attachment.preview.badge,
              attachment,
            };
          })
        );
      } else {
        const news = await NewsService.getInstance().getNews({ limit: 30 });
        setItems(
          (news as Array<NewsArticle & { text?: string | null; img?: string | null }>)
            .filter((a) => a?.id)
            .map((a) => {
              const attachment = buildNewsAttachment({
                id: String(a.id),
                title: a.title ?? null,
                label: a.label ?? null,
                summary: a.summary ?? null,
                content: a.content ?? null,
                text: a.text ?? null,
                source: a.source ?? null,
                image_url: a.image_url ?? a.img ?? null,
                img: a.img ?? null,
                published_at: a.published_at ?? null,
              });
              return {
                key: `news-${a.id}`,
                title: attachment.preview.title,
                subtitle: attachment.preview.subtitle,
                imageUrl: a.image_url ?? a.img ?? null,
                badge: attachment.preview.badge,
                attachment,
              };
            })
        );
      }
    } catch (e: any) {
      setItems([]);
      setError(e?.message || 'לא ניתן לטעון פריטים');
    } finally {
      setLoading(false);
    }
  }, [category, user?.id, visible]);

  useEffect(() => {
    if (!visible) {
      setItems([]);
      setError(null);
      setLoading(false);
      return;
    }
    void load();
  }, [visible, load]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.78]}
      enablePanDownToClose
      edgeToEdge
      showHandle
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
      topCornerRadius={28}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <DayNavBlurButton
            onPress={onClose}
            size={DAY_NAV_BUTTON_SIZE}
            glassIntensity="subtle"
            style={styles.headerIconButton}
            accessibilityLabel="סגור"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={tokens.colors.text.primary}
            />
          </DayNavBlurButton>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: tokens.colors.text.primary }]}>
              צרף תוכן
            </Text>
          </View>
          <View style={styles.headerSideSpacer} />
        </View>

        <SlidingPillGroup
          options={TAB_OPTIONS}
          value={category}
          onChange={setCategory}
          style={styles.tabsWrap}
          accessibilityLabelFor={(o) => `סוג תוכן: ${o.label}`}
        />

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.text.secondary} />
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={[styles.empty, { color: tokens.colors.text.secondary }]}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.key}
            contentContainerStyle={
              items.length === 0 ? styles.listEmpty : styles.listContent
            }
            ListEmptyComponent={
              <Text style={[styles.empty, { color: tokens.colors.text.tertiary }]}>
                אין פריטים להצגה
              </Text>
            }
            renderItem={({ item }) => {
              const tradeTicker =
                item.attachment.ref.type === 'journal_trade' || item.attachment.ref.type === 'earnings_report'
                  ? (item.attachment.ref.extras?.ticker || item.title || '')
                      .toString()
                      .trim()
                      .toUpperCase()
                  : '';
              return (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  void HapticFeedback.medium();
                  onSelect(item.attachment);
                  onClose();
                }}
              >
                {tradeTicker ? (
                  <View style={styles.tradeLogoWrap}>
                    <TickerLogo symbol={tradeTicker} size={40} borderRadius={12} />
                  </View>
                ) : item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback]}>
                    <Ionicons
                      name={
                        category === 'earnings'
                          ? 'bar-chart-outline'
                          : category === 'news'
                            ? 'newspaper-outline'
                            : 'person-outline'
                      }
                      size={20}
                      color={tokens.colors.text.primary}
                    />
                  </View>
                )}
                <View style={styles.rowText}>
                  <View style={styles.titleRow}>
                    <Text
                      style={[styles.rowTitle, { color: tokens.colors.text.primary }]}
                      numberOfLines={1}
                    >
                      {item.title}
                    </Text>
                    {item.badge ? (
                      <View style={styles.badge}>
                        <Text style={styles.badgeText}>{item.badge}</Text>
                      </View>
                    ) : null}
                  </View>
                  {item.subtitle ? (
                    <Text
                      style={[styles.rowSub, { color: tokens.colors.text.tertiary }]}
                      numberOfLines={1}
                    >
                      {item.subtitle}
                    </Text>
                  ) : null}
                </View>
              </TouchableOpacity>
              );
            }}
          />
        )}
      </View>
    </BottomSheet>
  );
}

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  const rtlText = tokens.rtlText;
  return StyleSheet.create({
    /**
     * Modal + forceRTL לא יציב. Yoga נשאר LTR כמו App.tsx;
     * row-reverse שם אווטאר/לוגו לימין בלי היפוך כפול.
     */
    container: { flex: 1, minHeight: 0, direction: 'ltr' },
    header: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: APP_LAYOUT.cardTitleToBodyGap,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
      flexShrink: 0,
    },
    headerIconButton: {
      alignSelf: 'center',
      backgroundColor: tokens.colors.background.primary,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerSideSpacer: {
      width: DAY_NAV_BUTTON_SIZE,
      height: DAY_NAV_BUTTON_SIZE,
    },
    headerTitle: {
      ...APP_TYPE.screenTitle,
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    tabsWrap: {
      flexDirection: 'row-reverse',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: APP_LAYOUT.stackGapSmall,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      marginTop: APP_LAYOUT.cardPadding,
      marginBottom: APP_LAYOUT.stackGapSmall,
      flexShrink: 0,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    listContent: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingBottom: 28,
    },
    listEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 28,
    },
    empty: {
      ...APP_TYPE.cardSubtitle,
      ...rtlText,
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 15,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: tokens.borderRadius.full,
    },
    avatarFallback: {
      backgroundColor: tokens.colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tradeLogoWrap: {
      borderRadius: 12,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.cardSolid,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: APP_LAYOUT.cardTitleToSubtitleGap,
      alignItems: 'flex-end',
    },
    titleRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      width: '100%',
    },
    rowTitle: {
      flexShrink: 1,
      ...APP_TYPE.cardTitle,
      ...rtlText,
    },
    rowSub: {
      ...APP_TYPE.cardSubtitle,
      width: '100%',
      ...rtlText,
    },
    badge: {
      flexShrink: 0,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 999,
      backgroundColor: tokens.colors.background.tertiary,
    },
    badgeText: {
      ...APP_TYPE.caption,
      color: tokens.colors.text.secondary,
      ...rtlText,
    },
  });
}
