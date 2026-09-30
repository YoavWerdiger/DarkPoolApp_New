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
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { fetchFeaturedProfiles } from '../../services/darkpool/featuredProfilesService';
import { NewsService, type NewsArticle } from '../../services/newsService';
import type { Trade } from '../../screens/Journal/tradeTypes';
import {
  buildNewsAttachment,
  buildPersonAttachment,
  buildTradeAttachment,
  type ShareableAttachment,
} from '../../types/shareableEntity';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { TickerLogo } from '../ui/TickerLogo';
import { MarketsEmbedSwitcher } from '../../screens/Markets/components/MarketsEmbedSwitcher';
import type { SegmentedOption } from '../../screens/Markets/components/MarketsSegmentedControl';

type Category = 'people' | 'trades' | 'news';

const TAB_OPTIONS: SegmentedOption<Category>[] = [
  { id: 'people', label: 'אנשים' },
  { id: 'trades', label: 'טריידים' },
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
      } else if (category === 'trades') {
        if (!user?.id) {
          setItems([]);
          setError('יש להתחבר כדי לצרף טריידים');
          return;
        }
        const { data, error: qErr } = await supabase
          .from('trades')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(30);
        if (qErr) throw qErr;
        setItems(
          ((data ?? []) as Trade[]).map((t) => {
            const attachment = buildTradeAttachment(t);
            return {
              key: `trade-${t.id}`,
              title: attachment.preview.title,
              subtitle: attachment.preview.subtitle,
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
      useGlassBackground
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

        <View style={styles.tabsWrap}>
          <MarketsEmbedSwitcher
            options={TAB_OPTIONS}
            value={category}
            onChange={setCategory}
            accessibilityGroupLabel="סוג תוכן"
          />
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={tokens.colors.primary.main} />
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
                item.attachment.ref.type === 'journal_trade'
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
                  <View
                    style={[
                      styles.avatar,
                      { backgroundColor: tokens.colors.primary.dim, alignItems: 'center', justifyContent: 'center' },
                    ]}
                  >
                    <Ionicons
                      name={
                        category === 'trades'
                          ? 'stats-chart-outline'
                          : category === 'news'
                            ? 'newspaper-outline'
                            : 'person-outline'
                      }
                      size={20}
                      color={tokens.colors.primary.main}
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
                      <View style={[styles.badge, { backgroundColor: `${tokens.colors.primary.main}22` }]}>
                        <Text style={styles.badgeText}>
                          {item.badge}
                        </Text>
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
      paddingHorizontal: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
      gap: 10,
      flexShrink: 0,
    },
    headerIconButton: {
      alignSelf: 'center',
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
      fontSize: 20,
      fontWeight: '800',
      letterSpacing: -0.35,
      textAlign: 'center',
      writingDirection: 'rtl',
      width: '100%',
    },
    tabsWrap: {
      paddingHorizontal: 16,
      marginTop: 14,
      marginBottom: 8,
      flexShrink: 0,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 28 },
    listEmpty: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 28,
    },
    empty: {
      ...rtlText,
      textAlign: 'center',
      fontSize: 14,
    },
    row: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: tokens.colors.border.divider,
    },
    avatar: {
      width: 44,
      height: 44,
      borderRadius: tokens.borderRadius.full,
    },
    tradeLogoWrap: {
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: tokens.colors.border.divider,
      backgroundColor: '#FFFFFF',
    },
    rowText: {
      flex: 1,
      minWidth: 0,
      gap: 2,
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
      fontSize: 15,
      fontWeight: '700',
      ...rtlText,
    },
    rowSub: {
      fontSize: 12,
      width: '100%',
      ...rtlText,
    },
    badge: {
      flexShrink: 0,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: tokens.borderRadius.button,
    },
    badgeText: {
      color: tokens.colors.primary.main,
      fontSize: 10,
      fontWeight: '700',
      ...rtlText,
    },
  });
}
