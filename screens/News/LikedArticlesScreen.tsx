import i18n from '../../lib/i18n';
import { BreakingNewsCard, BreakingNewsCardSkeleton } from './BreakingNewsTab';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import type { NewsArticle } from '../../services/newsService';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import UICard from '../../components/ui/UICard';
import { SkeletonBox, SkeletonLine } from '../../components/ui/SkeletonLoader';
import { LikedArticlesService, LikedArticle } from '../../services/likedArticlesService';
import { formatNewsDate } from '../../services/newsService';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { NewsScreenShell } from './NewsScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface LikedArticleCardProps {
  article: LikedArticle;
  onPress: (article: LikedArticle) => void;
  onUnlike: (article: LikedArticle) => void;
}

/** מבנה כמו BreakingNewsCard — blur, גרדיאנט על תמונה, מפריד */
const LikedArticleCard: React.FC<LikedArticleCardProps> = ({ article, onPress, onUnlike }) => {
  const DesignTokens = useDesignTokens();
  const hasImage = !!article.article_image_url && article.article_image_url.length > 0;
  const thumbnailHeight = 196;
  const cardRadius = UI_CARD_RADIUS;

  return (
    <Pressable
      onPress={() => onPress(article)}
      style={{ marginBottom: APP_LAYOUT.cardStackGap }}
      accessibilityRole="button"
    >
      <UICard variant="blur" padding="none" disableBlur style={{ borderRadius: cardRadius, overflow: 'hidden' }}>
        <View style={{ height: thumbnailHeight, width: '100%', position: 'relative' }}>
          {hasImage ? (
            <>
              <Image
                source={{ uri: article.article_image_url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.75)']}
                locations={[0.25, 1]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View
                style={{
                  position: 'absolute',
                  bottom: 12,
                  left: 12,
                  right: 12,
                }}
              >
                <Text
                  style={{
                    ...APP_TYPE.cardTitle,
                    color: '#FFFFFF',
                    textAlign: 'right',
                  }}
                  numberOfLines={2}
                >
                  {article.article_title}
                </Text>
                <Text
                  style={{
                    ...APP_TYPE.caption,
                    color: 'rgba(255,255,255,0.7)',
                    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
                    textAlign: 'right',
                  }}
                >
                  {article.article_source} • {formatNewsDate(article.article_published_at)}
                </Text>
              </View>
            </>
          ) : (
            <View
              style={{
                flex: 1,
                minHeight: thumbnailHeight,
                backgroundColor: DesignTokens.colors.background.tertiary,
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: DesignTokens.spacing.lg,
              }}
            >
              <Ionicons name="newspaper-outline" size={48} color={DesignTokens.colors.text.tertiary} />
              <Text
                style={{
                  ...APP_TYPE.cardTitle,
                  color: DesignTokens.colors.text.primary,
                  textAlign: 'right',
                  marginTop: APP_LAYOUT.cardTitleToBodyGap,
                }}
                numberOfLines={3}
              >
                {article.article_title}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: DesignTokens.colors.border.divider }} />

        <View
          style={{
            paddingHorizontal: APP_LAYOUT.cardPadding,
            paddingTop: APP_LAYOUT.cardTitleToBodyGap,
            paddingBottom: APP_LAYOUT.cardPadding,
          }}
        >
          {hasImage ? (
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 59, 92, 0.15)',
                }}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onUnlike(article);
                }}
                activeOpacity={0.7}
                accessibilityLabel={i18n.t('auto.screens__News__LikedArticlesScreen.s1')}
              >
                <Ionicons name="heart" size={18} color="#FF3B5C" />
              </TouchableOpacity>
            </View>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <Text
                style={{
                  ...APP_TYPE.caption,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'right',
                  flex: 1,
                  marginLeft: APP_LAYOUT.cardTitleToBodyGap,
                }}
              >
                {article.article_source} • {formatNewsDate(article.article_published_at)}
              </Text>
              <TouchableOpacity
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'rgba(255, 59, 92, 0.15)',
                }}
                onPress={(e) => {
                  e?.stopPropagation?.();
                  onUnlike(article);
                }}
                activeOpacity={0.7}
                accessibilityLabel={i18n.t('auto.screens__News__LikedArticlesScreen.s1')}
              >
                <Ionicons name="heart" size={18} color="#FF3B5C" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </UICard>
    </Pressable>
  );
};

/** כרטיס כתבה בטעינה — אותו UICard, תמונה בגובה 196, מפריד ושורת הלב התחתונה (הלב אמיתי) */
const LikedArticleCardSkeleton: React.FC = () => {
  const DesignTokens = useDesignTokens();
  return (
    <View style={{ marginBottom: APP_LAYOUT.cardStackGap }} pointerEvents="none">
      <UICard variant="blur" padding="none" disableBlur style={{ borderRadius: UI_CARD_RADIUS, overflow: 'hidden' }}>
        <SkeletonBox width="100%" height={196} borderRadius={0} />
        <View style={{ height: 1, backgroundColor: DesignTokens.colors.border.divider }} />
        <View
          style={{
            paddingHorizontal: APP_LAYOUT.cardPadding,
            paddingTop: APP_LAYOUT.cardTitleToBodyGap,
            paddingBottom: APP_LAYOUT.cardPadding,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SkeletonLine lineHeight={APP_TYPE.caption.lineHeight} width="44%" box={10} align="flex-end" style={{ flex: 1, marginLeft: APP_LAYOUT.cardTitleToBodyGap }} />
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 59, 92, 0.15)',
            }}
          >
            <Ionicons name="heart" size={18} color="#FF3B5C" />
          </View>
        </View>
      </UICard>
    </View>
  );
};

export default function LikedArticlesScreen() {
  const DesignTokens = useDesignTokens();
  const pad = APP_LAYOUT.screenPaddingHorizontal;
  const listBottomPadding = useMainTabsHeight(16) + DesignTokens.spacing.sm;
  const [likedArticles, setLikedArticles] = useState<LikedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // טעינת החדשות שאהב המשתמש
  const loadLikedArticles = useCallback(async () => {
    try {
      const articles = await LikedArticlesService.getLikedArticles();
      setLikedArticles(articles);
    } catch (error) {
      legacyAlert(i18n.t('auto.screens__News__LikedArticlesScreen.s2'), i18n.t('auto.screens__News__LikedArticlesScreen.s3'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // הסרת אהבתי מחדשה
  const handleUnlike = useCallback(async (article: LikedArticle) => {
    try {
      const success = await LikedArticlesService.unlikeArticle(article.article_id);
      if (success) {
        void HapticFeedback.selection();
        // הסרה מהרשימה מיידית
        setLikedArticles(prev => prev.filter(item => item.id !== article.id));
      } else {
        legacyAlert(i18n.t('auto.screens__News__LikedArticlesScreen.s2'), i18n.t('auto.screens__News__LikedArticlesScreen.s4'));
      }
    } catch (error) {
      legacyAlert(i18n.t('auto.screens__News__LikedArticlesScreen.s2'), i18n.t('auto.screens__News__LikedArticlesScreen.s5'));
    }
  }, []);

  // רענון רשימה
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadLikedArticles();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadLikedArticles]);

  // בחירת חדשה
  const handleArticlePress = useCallback((article: LikedArticle) => {
    void HapticFeedback.impactLight();
    // TODO: פתיחת מסך פרטי הכתבה
  }, []);

  // מחיקת כל החדשות שאהב
  const handleClearAll = useCallback(async () => {
    legacyAlert(
      i18n.t('auto.screens__News__LikedArticlesScreen.s6'),
      i18n.t('auto.screens__News__LikedArticlesScreen.s7'),
      [
        { text: i18n.t('auto.screens__News__LikedArticlesScreen.s8'), style: 'cancel' },
        {
          text: i18n.t('auto.screens__News__LikedArticlesScreen.s9'),
          style: 'destructive',
          onPress: async () => {
            const success = await LikedArticlesService.clearAllLikedArticles();
            if (success) {
              void HapticFeedback.impactLight();
              setLikedArticles([]);
            } else {
              legacyAlert(i18n.t('auto.screens__News__LikedArticlesScreen.s2'), i18n.t('auto.screens__News__LikedArticlesScreen.s10'));
            }
          }
        }
      ]
    );
  }, []);

  // טעינה ראשונית
  useEffect(() => {
    loadLikedArticles();
  }, [loadLikedArticles]);

  // רינדור כתבה
  // אותו כרטיס כמו בפיד (BreakingNewsCard). הכתבה השמורה מחזיקה רק כותרת / מקור / תמונה / תאריך —
  // תקציר וקטגוריה מושלמים מהפיד שבקאש כשהכתבה עדיין שם
  const feedById = useMemo(() => {
    const list = queryClient.getQueryData<NewsArticle[]>(appQueryKeys.newsList('breaking')) ?? [];
    return new Map(list.map((a) => [String(a.id), a]));
  }, [likedArticles]);
  const toNewsArticle = useCallback(
    (item: LikedArticle): NewsArticle => {
      const full = feedById.get(String(item.article_id));
      return full ?? {
        id: item.article_id,
        title: item.article_title,
        content: '',
        source: item.article_source,
        image_url: item.article_image_url || undefined,
        published_at: item.article_published_at,
        created_at: item.created_at,
      };
    },
    [feedById],
  );
  const renderArticle = ({ item }: { item: LikedArticle }) => (
    <BreakingNewsCard
      article={toNewsArticle(item)}
      isLiked
      onPress={() => handleArticlePress(item)}
      onLike={() => void handleUnlike(item)}
    />
  );

  // רינדור רשימה ריקה
  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
      <Ionicons 
        name="heart-outline" 
        size={64} 
        color={DesignTokens.colors.text.tertiary} 
      />
      <Text style={{
        ...APP_TYPE.sectionTitle,
        marginTop: APP_LAYOUT.componentGap,
        textAlign: 'center',
        color: DesignTokens.colors.text.primary
      }}>{i18n.t('auto.screens__News__LikedArticlesScreen.s11')}</Text>
      <Text style={{
        ...APP_TYPE.cardSubtitle,
        marginTop: APP_LAYOUT.groupLabelToContent,
        textAlign: 'center',
        color: DesignTokens.colors.text.secondary,
      }}>{i18n.t('auto.screens__News__LikedArticlesScreen.s12')}</Text>
    </View>
  );

  const headerRight =
    !loading && likedArticles.length > 0 ? (
      <TouchableOpacity
        onPress={handleClearAll}
        accessibilityLabel={i18n.t('auto.screens__News__LikedArticlesScreen.s13')}
        style={{
          width: 46,
          height: 46,
          borderRadius: 23,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(255, 59, 92, 0.12)',
          borderWidth: StyleSheet.hairlineWidth * 2,
          borderColor: 'rgba(255, 59, 92, 0.28)',
        }}
      >
        <Trash2 size={18} color="#FF3B5C" strokeWidth={2} />
      </TouchableOpacity>
    ) : null;

  const listHeaderMeta =
    likedArticles.length > 0 ? (
      <Text
        style={{
          ...APP_TYPE.caption,
          color: DesignTokens.colors.text.secondary,
          textAlign: 'center',
          marginBottom: APP_LAYOUT.groupLabelToContent,
        }}
      >
        {i18n.t('auto.screens__News__LikedArticlesScreen.s14', { v0: likedArticles.length })}</Text>
    ) : null;

  if (loading) {
    return (
      <NewsScreenShell title={i18n.t('auto.screens__News__LikedArticlesScreen.s15')}>
        {/* כרטיסי שלד באותה רשימה ושוליים — במקום ספינר וטקסט «טוען» */}
        <View>
          {[0, 1, 2].map((i) => (
            <BreakingNewsCardSkeleton key={i} />
          ))}
        </View>
      </NewsScreenShell>
    );
  }

  return (
    <NewsScreenShell title={i18n.t('auto.screens__News__LikedArticlesScreen.s15')} headerRight={headerRight}>
      <FlatList
        data={likedArticles}
        keyExtractor={(item) => item.id}
        renderItem={renderArticle}
        ListHeaderComponent={listHeaderMeta}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DesignTokens.colors.primary.main}
            colors={[DesignTokens.colors.primary.main]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        // הכרטיס של הפיד כבר עם marginHorizontal — בלי ריפוד כפול
        contentContainerStyle={{
          paddingBottom: listBottomPadding,
          flexGrow: 1,
          ...(likedArticles.length === 0 && { flex: 1 }),
        }}
      />
    </NewsScreenShell>
  );
}
