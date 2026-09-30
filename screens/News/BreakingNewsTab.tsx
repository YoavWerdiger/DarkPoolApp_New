import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { View, Text, TextInput, FlatList, RefreshControl, Pressable, TouchableOpacity, Image, Linking, Modal, Share, ScrollView, Animated, Dimensions, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
// import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { CardSkeleton } from '../../components/ui/SkeletonLoader';
import BottomSheet, {
  useBottomSheetClose,
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  SHEET_MOTION_MS,
} from '../../components/ui/BottomSheet/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { 
  newsService, 
  NewsArticle, 
  formatNewsDate,
  truncateText,
  getNewsCategoryColor
} from '../../services/newsService';
import { LikedArticlesService } from '../../services/likedArticlesService';
import { queryClient } from '../../lib/queryClient';
import { appQueryKeys } from '../../lib/appQueryKeys';
import UICard from '../../components/ui/UICard';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE, appSheetButtonLabelStyle } from '../../components/ui/appType';
import ShareDestinationSheet from '../../components/share/ShareDestinationSheet';
import { buildNewsAttachment } from '../../types/shareableEntity';

const BREAKING_NEWS_QUERY_KEY = appQueryKeys.newsList('breaking');
/** כמות כתבות שנשמרת ל-cache/דיסק (עמוד ראשון) */
const BREAKING_NEWS_CACHE_LIMIT = 50;
import { useNavigation } from '@react-navigation/native';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';
// Fear & Greed מוצג בטאב "עיקרי מדדים" בלבד

const NEWS_DETAIL_IMAGE_HEIGHT = 240;
const NEWS_DETAIL_MAX_SNAP = 0.68;
const NEWS_DETAIL_BODY_MAX_LINES = 6;
const NEWS_DETAIL_BODY_LINE_PX = APP_TYPE.body.lineHeight;
const NEWS_DETAIL_BODY_MAX_PX = NEWS_DETAIL_BODY_MAX_LINES * NEWS_DETAIL_BODY_LINE_PX;
const SCREEN_HEIGHT = Dimensions.get('window').height;

/** שורת מטא קצרה (מקור/תאריך) — בתוך row-reverse */
const newsDetailMetaText = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};

/** כותרת וגוף — כמו כרטיס החדשות ברשימה */
const newsDetailParagraphText = {
  writingDirection: 'rtl' as const,
  textAlign: 'right' as const,
};

/** כפתורי פעולה */
const newsDetailRtlText = {
  writingDirection: 'rtl' as const,
  textAlign: 'left' as const,
};

interface NewsCardProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
  onLike: (article: NewsArticle) => void;
  onShare?: (article: NewsArticle) => void;
  isLiked: boolean;
}

interface ShareModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  visible: boolean;
}

/** Multiverse — שיתוף חדשה לציוץ / chat_messages (entity), לא legacy messages */
const ShareModal: React.FC<ShareModalProps> = ({ article, onClose, visible }) => {
  const attachment = React.useMemo(
    () => (article ? buildNewsAttachment(article) : null),
    [article]
  );
  return (
    <ShareDestinationSheet
      visible={visible && !!attachment}
      attachment={attachment}
      onClose={onClose}
    />
  );
};

// מודל מפורט לחדשות
interface NewsDetailModalProps {
  visible: boolean;
  article: NewsArticle | null;
  isLiked: boolean;
  onClose: () => void;
  onLike: (article: NewsArticle) => void;
  onShare: (article: NewsArticle) => void;
  currentIndex?: number;
  totalArticles?: number;
  onNext?: () => void;
  onPrevious?: () => void;
}

/** כפתור סגירה בצבע הכרטיס, עם אנימציית הסגירה של ה-BottomSheet. */
const SheetCloseButton: React.FC<{
  fallback: () => void;
}> = ({ fallback }) => {
  const tokens = useDesignTokens();
  const animatedClose = useBottomSheetClose();
  const handleClose = useCallback(() => {
    if (animatedClose) animatedClose();
    else fallback();
  }, [animatedClose, fallback]);

  return (
    <View style={{ position: 'absolute', top: 14, right: 14, zIndex: 100 }}>
      <DayNavBlurButton onPress={handleClose} size={36} accessibilityLabel="סגור">
        <Ionicons name="chevron-down" size={20} color={tokens.colors.text.primary} />
      </DayNavBlurButton>
    </View>
  );
};

const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ 
  visible, 
  article, 
  isLiked, 
  onClose, 
  onLike, 
  onShare,
  currentIndex,
  totalArticles,
  onNext,
  onPrevious
}) => {
  const DesignTokens = useDesignTokens();
  const detailPad = APP_LAYOUT.screenPaddingHorizontal;
  const insets = useSafeAreaInsets();
  const [likeCount, setLikeCount] = useState<number>(0);
  
  // טעינת מספר המועדפים - לפני return null
  useEffect(() => {
    if (visible && article?.id) {
      const articleId = article.id;
      LikedArticlesService.getArticleLikeCount(articleId).then(count => {
        setLikeCount(count);
      }).catch(() => {});
    } else {
      setLikeCount(0);
    }
  }, [visible, article?.id]);

  const [titleBlockH, setTitleBlockH] = useState<number | null>(null);
  const [bodyNaturalH, setBodyNaturalH] = useState<number | null>(null);

  const sheetBottomPad = useMemo(
    () => Math.max(insets.bottom, Platform.OS === 'android' ? 8 : 4),
    [insets.bottom],
  );

  useEffect(() => {
    if (!visible) {
      setTitleBlockH(null);
      setBodyNaturalH(null);
    }
  }, [visible, article?.id]);

  const bodyText = article?.content || article?.summary || '';
  const titleText = article?.label || article?.title || '';

  const estimatedTitleH = useMemo(() => {
    const lines = Math.min(3, Math.max(1, Math.ceil(titleText.length / 34)));
    return lines * 28 + 10;
  }, [titleText]);

  const estimatedBodyVisibleH = useMemo(() => {
    const lines = Math.max(1, Math.ceil(bodyText.length / 36));
    return Math.min(lines * NEWS_DETAIL_BODY_LINE_PX, NEWS_DETAIL_BODY_MAX_PX);
  }, [bodyText]);

  const titleH = titleBlockH ?? estimatedTitleH;
  const bodyVisibleH =
    bodyNaturalH != null
      ? Math.min(bodyNaturalH, NEWS_DETAIL_BODY_MAX_PX)
      : estimatedBodyVisibleH;
  const bodyNeedsScroll = (bodyNaturalH ?? estimatedBodyVisibleH) > NEWS_DETAIL_BODY_MAX_PX + 4;

  const shellContentH = useMemo(() => {
    const topPad = article?.image_url ? 16 : 8;
    const metaH = 32;
    const actionsH = 52;
    return topPad + titleH + metaH + bodyVisibleH + 20 + actionsH;
  }, [article?.image_url, titleH, bodyVisibleH]);

  const imageH = article?.image_url ? NEWS_DETAIL_IMAGE_HEIGHT : 0;
  const chromeH = BOTTOM_SHEET_EDGE_HANDLE_HEIGHT;

  const dynamicSnapPoints = useMemo(() => {
    const totalPx = imageH + shellContentH + chromeH + sheetBottomPad;
    const snap = Math.min(NEWS_DETAIL_MAX_SNAP, totalPx / SCREEN_HEIGHT);
    return [Math.max(0.16, snap)];
  }, [imageH, shellContentH, chromeH, sheetBottomPad]);

  if (!article) return null;

  const articleBody = (
    <View
      style={{
        width: '100%',
        alignSelf: 'stretch',
        paddingHorizontal: detailPad,
        paddingTop: article.image_url ? 16 : 8,
      }}
    >
      <Text
        onLayout={(e) => {
          const h = e.nativeEvent.layout.height;
          if (h > 0) setTitleBlockH((prev) => (prev === h ? prev : h));
        }}
        style={{
          ...APP_TYPE.sectionTitle,
          color: DesignTokens.colors.text.primary,
          marginBottom: APP_LAYOUT.sectionHeaderToContent,
          alignSelf: 'stretch',
          ...newsDetailParagraphText,
        }}
      >
        {titleText}
      </Text>

      <View
        style={{
          flexDirection: 'row-reverse',
          alignItems: 'center',
          alignSelf: 'stretch',
          width: '100%',
          marginBottom: 16,
        }}
      >
        <Text
          style={{
            ...APP_TYPE.caption,
            color: DesignTokens.colors.text.secondary,
            ...newsDetailMetaText,
          }}
          numberOfLines={1}
        >
          {article.source || 'חדשה'}
        </Text>
        <Text
          style={{
            ...APP_TYPE.caption,
            color: DesignTokens.colors.text.tertiary,
            marginHorizontal: 6,
          }}
        >
          ·
        </Text>
        <Text
          style={{
            ...APP_TYPE.caption,
            color: DesignTokens.colors.text.tertiary,
            ...newsDetailMetaText,
          }}
          numberOfLines={1}
        >
          {formatNewsDate(article.published_at)}
        </Text>
      </View>

      {bodyNeedsScroll ? (
        <ScrollView
          style={{ maxHeight: NEWS_DETAIL_BODY_MAX_PX, marginBottom: 20 }}
          showsVerticalScrollIndicator
          nestedScrollEnabled
        >
          <Text
            onLayout={(e) => {
              const h = e.nativeEvent.layout.height;
              if (h > 0) setBodyNaturalH((prev) => (prev === h ? prev : h));
            }}
            style={{
              ...APP_TYPE.body,
              color: DesignTokens.colors.text.secondary,
              alignSelf: 'stretch',
              ...newsDetailParagraphText,
            }}
          >
            {bodyText}
          </Text>
        </ScrollView>
      ) : (
        <Text
          onLayout={(e) => {
            const h = e.nativeEvent.layout.height;
            if (h > 0) setBodyNaturalH((prev) => (prev === h ? prev : h));
          }}
          style={{
            ...APP_TYPE.body,
            color: DesignTokens.colors.text.secondary,
            marginBottom: 20,
            alignSelf: 'stretch',
            ...newsDetailParagraphText,
          }}
        >
          {bodyText}
        </Text>
      )}

      <View
        style={{
          flexDirection: 'row-reverse',
          gap: 12,
          alignSelf: 'stretch',
          width: '100%',
        }}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 24,
            backgroundColor: isLiked ? 'rgba(255, 59, 92, 0.22)' : DesignTokens.colors.background.primary,
            borderWidth: 0,
          }}
          onPress={() => {
            if (!article?.id) return;
            onLike(article);
            LikedArticlesService.getArticleLikeCount(article.id)
              .then((count) => setLikeCount(count))
              .catch(() => {});
          }}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isLiked ? 'heart' : 'heart-outline'}
            size={18}
            color={isLiked ? '#FF6B8A' : DesignTokens.colors.text.secondary}
          />
          <Text
            style={{
              ...appSheetButtonLabelStyle,
              color: isLiked ? DesignTokens.colors.text.primary : DesignTokens.colors.text.secondary,
              ...newsDetailRtlText,
            }}
          >
            {isLiked ? 'שמור' : 'שמור למועדפים'}
          </Text>
          {likeCount > 0 ? (
            <Text
              style={{
                ...APP_TYPE.caption,
                color: DesignTokens.colors.text.tertiary,
                ...newsDetailRtlText,
              }}
            >
              ({likeCount})
            </Text>
          ) : null}
        </TouchableOpacity>

        <TouchableOpacity
          style={{
            flex: 1,
            flexDirection: 'row-reverse',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 24,
            backgroundColor: DesignTokens.colors.background.primary,
            borderWidth: 0,
          }}
          onPress={() => onShare(article)}
          activeOpacity={0.7}
        >
          <Ionicons
            name="share-outline"
            size={18}
            color={DesignTokens.colors.text.secondary}
          />
          <Text
            style={{
              ...appSheetButtonLabelStyle,
              color: DesignTokens.colors.text.secondary,
              ...newsDetailRtlText,
            }}
          >
            שתף
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={dynamicSnapPoints}
      fitContent
      enablePanDownToClose
      showHandle={!article.image_url}
      edgeToEdge
      useGlassBackground
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <View style={{ paddingBottom: sheetBottomPad, width: '100%', alignSelf: 'stretch' }}>
        {article.image_url ? (
          <View
            style={{
              width: '100%',
              height: NEWS_DETAIL_IMAGE_HEIGHT,
              overflow: 'hidden',
              borderTopLeftRadius: DesignTokens.borderRadius.xl,
              borderTopRightRadius: DesignTokens.borderRadius.xl,
            }}
          >
            <Image
              source={{ uri: article.image_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            <View
              style={{
                position: 'absolute',
                top: 12,
                left: 0,
                right: 0,
                alignItems: 'center',
                zIndex: 10,
              }}
              pointerEvents="none"
            >
              <View
                style={{
                  width: 40,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: 'rgba(0, 0, 0, 0.5)',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                  elevation: 5,
                }}
              />
            </View>
            <SheetCloseButton fallback={onClose} />
          </View>
        ) : (
          <SheetCloseButton fallback={onClose} />
        )}

        {articleBody}
      </View>
    </BottomSheet>
  );
};

const BreakingNewsCard: React.FC<NewsCardProps> = ({ article, onPress, onLike, onShare, isLiked }) => {
  const DesignTokens = useDesignTokens();
  const categoryColor = getNewsCategoryColor(article.category);

  const handleSharePress = () => {
    if (onShare) onShare(article);
  };

  const isTwitterPost = article.source === 'Twitter' ||
    article.source === 'Bloomberg' || article.source === 'Reuters' ||
    article.source === 'CNN' || article.source === 'BBC' ||
    article.source === 'טוויטר' ||
    article.url?.includes('twitter.com') ||
    article.source_url?.includes('twitter.com') ||
    article.id?.length > 15;

  const hasImage = !!article.image_url;
  // Square thumbnail on the right side — compact, doesn't dominate the card.
  const THUMB_SIZE = 92;
  const screenPad = APP_LAYOUT.screenPaddingHorizontal;
  const cardRadius = UI_CARD_RADIUS;

  const headline = article.label || article.title;
  const summary = article.summary;

  return (
    <Pressable
      onPress={() => onPress(article)}
      style={{ marginHorizontal: screenPad, marginBottom: APP_LAYOUT.cardStackGap }}
      accessibilityRole="button"
    >
      <UICard
        variant="blur"
        padding="none"
        disableBlur
        style={{
          borderRadius: cardRadius,
          overflow: 'hidden',
        }}
      >
        {/* Top row — square image on the right, headline + summary on the left */}
        <View
          style={{
            flexDirection: 'row-reverse',
            alignItems: 'stretch',
            padding: APP_LAYOUT.cardPadding,
            gap: APP_LAYOUT.cardTitleToBodyGap,
          }}
        >
          {/* Square thumbnail */}
          <View
            style={{
              width: THUMB_SIZE,
              height: THUMB_SIZE,
              borderRadius: DesignTokens.borderRadius.lg,
              overflow: 'hidden',
              backgroundColor: DesignTokens.colors.background.tertiary,
            }}
          >
            {hasImage ? (
              <Image
                source={{ uri: article.image_url }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons
                  name={isTwitterPost ? 'logo-twitter' : 'newspaper-outline'}
                  size={36}
                  color={DesignTokens.colors.text.tertiary}
                />
              </View>
            )}
          </View>

          {/* Headline + summary column. Title and summary sit tightly
             together at the top; the category is pushed to the bottom of
             the column with marginTop:'auto'. */}
          <View style={{ flex: 1, minHeight: THUMB_SIZE }}>
            <Text
              style={{
                ...APP_TYPE.cardTitle,
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                writingDirection: 'rtl',
              }}
              numberOfLines={summary ? 2 : 3}
            >
              {headline}
            </Text>

            {summary ? (
              <Text
                style={{
                  ...APP_TYPE.cardSubtitle,
                  color: DesignTokens.colors.text.secondary,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
                }}
                numberOfLines={2}
              >
                {summary}
              </Text>
            ) : null}

            {/* Category — pinned to the bottom of the text column */}
            {article.category && article.category !== 'כללי' ? (
              <View
                style={{
                  marginTop: 'auto',
                  alignSelf: 'flex-end',
                  backgroundColor: categoryColor + '25',
                  paddingHorizontal: 10,
                  paddingVertical: 3,
                  borderRadius: 8,
                }}
              >
                <Text style={{ ...APP_TYPE.cardSubtitle, color: categoryColor }}>
                  {article.category}
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ height: 1, backgroundColor: DesignTokens.colors.border.divider }} />

        {/* Footer — actions on the left, source + time on the right */}
        <View
          style={{
            paddingHorizontal: APP_LAYOUT.cardPadding,
            paddingVertical: APP_LAYOUT.stackGapSmall,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Action buttons */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isLiked ? 'rgba(255, 59, 92, 0.15)' : DesignTokens.colors.background.primary,
              }}
              onPress={(e) => {
                e?.stopPropagation?.();
                onLike(article);
              }}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={16}
                color={isLiked ? '#FF3B5C' : DesignTokens.colors.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: DesignTokens.colors.background.primary,
              }}
              onPress={(e) => {
                e?.stopPropagation?.();
                handleSharePress();
              }}
            >
              <Ionicons name="share-outline" size={16} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Source + time — RTL */}
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'center',
              flexShrink: 1,
            }}
          >
            <Text
              style={{
                ...APP_TYPE.cardSubtitle,
                color: DesignTokens.colors.text.secondary,
                writingDirection: 'rtl',
              }}
              numberOfLines={1}
            >
              {article.source}
            </Text>
            <Text
              style={{
                ...APP_TYPE.cardSubtitle,
                color: DesignTokens.colors.text.tertiary,
                marginHorizontal: 6,
              }}
            >
              ·
            </Text>
            <Text
              style={{
                ...APP_TYPE.cardSubtitle,
                color: DesignTokens.colors.text.tertiary,
                writingDirection: 'rtl',
              }}
              numberOfLines={1}
            >
              {formatNewsDate(article.published_at)}
            </Text>
          </View>
        </View>
      </UICard>
    </Pressable>
  );
};

export default function BreakingNewsTab({
  openArticleId = null,
  onOpenArticleConsumed,
}: {
  openArticleId?: string | null;
  onOpenArticleConsumed?: () => void;
} = {}) {
  const DesignTokens = useDesignTokens();
  const listBottomInset = useMainTabsHeight(16);
  // זריעה אופטימית מה-cache (נטען מהדיסק בהפעלה קרה) — רינדור מיידי ללא ספינר
  const [articles, setArticles] = useState<NewsArticle[]>(
    () => queryClient.getQueryData<NewsArticle[]>(BREAKING_NEWS_QUERY_KEY) ?? []
  );
  const [loading, setLoading] = useState(
    () => !queryClient.getQueryData<NewsArticle[]>(BREAKING_NEWS_QUERY_KEY)
  );
  const [refreshing, setRefreshing] = useState(false);
  
  // מצב האהבתי
  const [likedArticles, setLikedArticles] = useState<Set<string>>(new Set());
  const [likesCount, setLikesCount] = useState<Record<string, number>>({});
  
  // מצב המודל המפורט
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [selectedArticleIndex, setSelectedArticleIndex] = useState<number>(0);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  
  // מצב מודל שיתוף
  const [shareArticle, setShareArticle] = useState<NewsArticle | null>(null);
  const [shareModalVisible, setShareModalVisible] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const navigation = useNavigation();

  const filteredArticles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => {
      const blob = [a.title, a.label, a.summary, a.source, a.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [articles, searchQuery]);

  // טעינת החדשות שאהב המשתמש
  const loadLikedArticles = useCallback(async () => {
    try {
      const likedIds = await LikedArticlesService.getLikedArticleIds();
      setLikedArticles(new Set(likedIds));
    } catch (error) {
    }
  }, []);

  // פונקציית אהבתי עם שמירה במסד הנתונים
  const handleLike = useCallback(async (article: NewsArticle) => {
    try {
      const articleId = article.id;
      const isCurrentlyLiked = likedArticles.has(articleId);
      
      // עדכון מיידי ב-UI
      const newLikedArticles = new Set(likedArticles);
      
      if (isCurrentlyLiked) {
        void HapticFeedback.selection();
        // הסרת אהבתי
        newLikedArticles.delete(articleId);
        setLikedArticles(newLikedArticles);
        
        // שמירה במסד הנתונים
        const success = await LikedArticlesService.unlikeArticle(articleId);
        if (!success) {
          // אם נכשל, החזר את המצב
          newLikedArticles.add(articleId);
          setLikedArticles(newLikedArticles);
          legacyAlert('שגיאה', 'לא ניתן להסיר את האהבתי');
        }
      } else {
        void HapticFeedback.impactLight();
        // הוספת אהבתי
        newLikedArticles.add(articleId);
        setLikedArticles(newLikedArticles);
        
        // שמירה במסד הנתונים
        const success = await LikedArticlesService.likeArticle(article);
        if (!success) {
          // אם נכשל, החזר את המצב
          newLikedArticles.delete(articleId);
          setLikedArticles(newLikedArticles);
          legacyAlert('שגיאה', 'לא ניתן להוסיף אהבתי');
        }
      }
      
    } catch (error) {
      legacyAlert('שגיאה', 'בעיה בשמירת האהבתי');
    }
  }, [likedArticles]);

  // טעינת חדשות מתפרצות
  const loadBreakingNews = useCallback(async () => {
    try {
      
      // נסה קודם לבדוק אם הטבלה קיימת
      const { data: testData, error: testError } = await supabase
        .from('app_news_clean')
        .select('count')
        .limit(1);
      
      // עכשיו נשלוף את הנתונים - מסודרים לפי time
      const { data, error } = await supabase
        .from('app_news_clean')
        .select('*')
        .order('time', { ascending: false });

      if (error) {
        // ננסה טבלות אחרות
        
        const alternativeTables = ['news', 'articles', 'tweets', 'posts', 'messages'];
        let foundData = null;
        
        for (const tableName of alternativeTables) {
          try {
            const { data: altData, error: altError } = await supabase
              .from(tableName)
              .select('*')
              .limit(10);
            
            if (!altError && altData && altData.length > 0) {
              foundData = altData;
              break;
            }
          } catch (altErr) {
            // Table fetch failed
          }
        }
        
        if (foundData) {
          const newsArticles: NewsArticle[] = foundData.map((row: any, index: number) => ({
            id: row.id || row.uuid || String(index),
            title: row.text_content || row.title || row.text || row.content || row.message || `כתבה ${index + 1}`,
            content: row.text_content || row.content || row.text || row.description || row.message || '',
            summary: row.summary || row.excerpt || (row.text_content || row.content || row.text || '').substring(0, 150) + '...',
            source: row.source || row.author || row.username || 'מקור לא ידוע',
            source_url: row.url || row.link || '',
            author: row.author || row.username || '',
            image_url: row.img || row.image || row.image_url || row.photo || null,
            published_at: row.time || row.created_at || row.date || row.timestamp || new Date().toISOString(),
            created_at: row.time || row.created_at || row.date || new Date().toISOString(),
            updated_at: row.updated_at || null,
            category: row.category || row.type || 'כללי',
            tags: row.tags || [],
            is_featured: false,
            view_count: 0,
            sentiment: 'neutral',
            relevance_score: 0,
            reading_time: 1
          }));
          
          setArticles(newsArticles);
          queryClient.setQueryData(
            BREAKING_NEWS_QUERY_KEY,
            newsArticles.slice(0, BREAKING_NEWS_CACHE_LIMIT)
          );
          return;
        }
        
        // אם לא מצאנו כלום, נציג רשימה ריקה
        setArticles([]);
        return;
      }

      // בדיקה אם יש נתונים
      if (!data || data.length === 0) {
        setArticles([]);
        return;
      }

      // המרת הנתונים מהמסד לפורמט NewsArticle
      const newsArticles: NewsArticle[] = (data || []).map((row: any, index: number) => {
        // חיפוש כותרת - לפי המבנה שלך
        const title = row.text_content || row.title || row.headline || row.subject || row.name || 
                     row.tweet_text || row.text || row.content || 
                     `כתבה ${index + 1}`;
        
        // חיפוש תוכן
        const content = row.text_content || row.content || row.text || row.description || 
                       row.body || row.message || row.tweet_text || 
                       title; // אם אין תוכן, נשתמש בכותרת
        
        // חיפוש סיכום
        const summary = row.summary || row.excerpt || row.description || 
                       row.snippet || row.abstract || 
                       content.substring(0, 150) + '...';
        
        // חיפוש מקור - לפי המבנה שלך
        const source = row.source || row.origin || row.publisher || 
                      row.author || row.username || row.screen_name || 
                      'מקור לא ידוע';
        
        // חיפוש תמונה - לפי המבנה שלך
        const image_url = row.img || row.image_url || row.image || row.thumbnail || 
                         row.media_url || row.photo || row.picture || 
                         row.profile_image || null;
        
        // חיפוש קטגוריה
        const category = row.category || row.type || row.topic || 
                        row.section || row.tag || 'כללי';
        
        // עיבוד תאריך משופר - משתמש ב-time מהמסד הנתונים
        let rawDate = row.time || row.published_at || row.created_at || row.date || row.timestamp || row.posted_at;
        
        // ניקוי של newlines ו-whitespace
        if (rawDate && typeof rawDate === 'string') {
          rawDate = rawDate.trim();
        }

        // בדיקת תקינות התאריך והמרה לפורמט ISO
        let validatedDate: string;
        if (rawDate) {
          try {
            // אם זה בפורמט "YYYY-MM-DD HH:mm:ss", נמיר אותו לפורמט ISO
            let dateToParse = rawDate;
            if (typeof rawDate === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(rawDate)) {
              // המרה מ-"YYYY-MM-DD HH:mm:ss" ל-"YYYY-MM-DDTHH:mm:ss"
              dateToParse = rawDate.replace(' ', 'T');
            }
            
            const testDate = new Date(dateToParse);
            if (isNaN(testDate.getTime()) || testDate.getTime() < 0) {
              validatedDate = row.created_at || new Date().toISOString();
            } else {
              validatedDate = testDate.toISOString();
            }
          } catch (error) {
            validatedDate = row.created_at || new Date().toISOString();
          }
        } else {
          validatedDate = row.created_at || new Date().toISOString();
        }
        
        const article = {
          id: row.id || row.uuid || row.tweet_id || String(index),
          label: row.label || '',
          title: title,
          content: content,
          summary: summary,
          source: source,
          source_url: row.source_url || row.url || row.link || row.tweet_url || '',
          author: row.author || row.writer || row.username || row.screen_name || '',
          image_url: image_url,
          published_at: validatedDate,
          created_at: validatedDate,
          updated_at: row.updated_at || row.modified_at || null,
          category: category,
          tags: row.tags || row.hashtags || [],
          is_featured: row.is_featured || row.featured || false,
          view_count: row.view_count || row.views || row.retweet_count || 0,
          sentiment: row.sentiment || row.mood || 'neutral',
          relevance_score: row.relevance_score || row.score || 0,
          reading_time: row.reading_time || row.read_time || Math.ceil(content.length / 300) || 1
        };
        
        return article;
      });

      setArticles(newsArticles);
      queryClient.setQueryData(
        BREAKING_NEWS_QUERY_KEY,
        newsArticles.slice(0, BREAKING_NEWS_CACHE_LIMIT)
      );
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן לטעון את החדשות המתפרצות');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // טעינה ראשונית
  useEffect(() => {
    loadBreakingNews();
    loadLikedArticles();
  }, [loadBreakingNews, loadLikedArticles]);

  // הגדרת realtime subscription לעדכונים חדשים
  useEffect(() => {
    const channelName = `app_news_clean_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const subscription = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_news_clean'
        },
        (payload) => {
          const row = payload.new;
          // Validate required fields before processing
          if (!row || typeof row !== 'object') return;
          const title = row.text_content || row.title || row.headline || row.subject ||
                        row.tweet_text || row.text || row.content || '';
          if (!title) return; // drop malformed payloads with no content

          const newArticle: NewsArticle = {
            id: row.id || row.uuid || row.tweet_id || String(Date.now()),
            label: row.label || '',
            title,
            content: row.text_content || row.content || row.text || row.description ||
                     row.body || row.message || row.tweet_text || '',
            summary: row.summary || row.excerpt || row.description ||
                     row.snippet || row.abstract || '',
            source: row.source || row.origin || row.publisher ||
                    row.author || row.username || row.screen_name || 'לא ידוע',
            source_url: row.source_url || row.url || row.link || row.tweet_url || '',
            author: row.author || row.writer || row.username || row.screen_name || '',
            image_url: row.img || row.image_url || row.image || row.thumbnail ||
                      row.media_url || row.photo || row.picture ||
                      row.profile_image || null,
            published_at: row.time || row.published_at || row.created_at || row.date || new Date().toISOString(),
            created_at: row.time || row.created_at || row.date || new Date().toISOString(),
            updated_at: row.updated_at || row.modified_at || null,
            category: row.category || row.type || row.topic || row.section || row.tag || 'כללי',
            tags: Array.isArray(row.tags) ? row.tags : Array.isArray(row.hashtags) ? row.hashtags : [],
            is_featured: row.is_featured || row.featured || false,
            view_count: row.view_count || row.views || 0,
            sentiment: row.sentiment || row.mood || 'neutral',
            relevance_score: row.relevance_score || row.score || 0,
            reading_time: row.reading_time || row.read_time || 1
          };

          setArticles(prev => {
            const next = [newArticle, ...prev.slice(0, 49)];
            queryClient.setQueryData(
              BREAKING_NEWS_QUERY_KEY,
              next.slice(0, BREAKING_NEWS_CACHE_LIMIT)
            );
            return next;
          });
        }
      )
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR') {
          console.warn('[BreakingNews] Realtime subscription error — live updates unavailable');
        }
      });

    return () => {
      void supabase.removeChannel(subscription);
    };
  }, []);

  // רענון
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadBreakingNews(),
        loadLikedArticles()
      ]);
    } finally {
      setRefreshing(false);
      void HapticFeedback.impactLight();
    }
  }, [loadBreakingNews, loadLikedArticles]);

  // בחירת כתבה - פתיחת מודל מפורט
  const handleArticlePress = useCallback((article: NewsArticle) => {
    void HapticFeedback.impactLight();
    const index = filteredArticles.findIndex((a) => a.id === article.id);
    setSelectedArticle(article);
    setSelectedArticleIndex(index >= 0 ? index : 0);
    setDetailModalVisible(true);
  }, [filteredArticles]);

  const openedArticleFromPushRef = useRef<string | null>(null);

  // פתיחה מהתראת Push (articleId ב-route)
  useEffect(() => {
    if (!openArticleId) {
      openedArticleFromPushRef.current = null;
      return;
    }
    if (openedArticleFromPushRef.current === openArticleId) return;
    let cancelled = false;

    const openFromId = async () => {
      const inList = articles.find((a) => a.id === openArticleId);
      if (inList) {
        if (cancelled) return;
        openedArticleFromPushRef.current = openArticleId;
        handleArticlePress(inList);
        onOpenArticleConsumed?.();
        return;
      }

      // עדיין טוענים / לא ברשימה — שליפה ישירה
      if (loading && articles.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('app_news_clean')
          .select('*')
          .eq('id', openArticleId)
          .maybeSingle();
        if (cancelled || error || !data) {
          openedArticleFromPushRef.current = openArticleId;
          onOpenArticleConsumed?.();
          return;
        }
        const row: any = data;
        const title =
          row.text_content || row.title || row.label || row.text || openArticleId;
        const content = row.text_content || row.content || row.text || title;
        const article: NewsArticle = {
          id: String(row.id),
          label: row.label || '',
          title,
          content,
          summary: row.summary || content.substring(0, 150),
          source: row.source || 'מקור לא ידוע',
          source_url: row.source_url || row.url || '',
          author: row.author || '',
          image_url: row.img || row.image_url || null,
          published_at: row.time || row.published_at || row.created_at || new Date().toISOString(),
          created_at: row.time || row.created_at || new Date().toISOString(),
          category: row.category || 'כללי',
          tags: row.tags || [],
        };
        if (cancelled) return;
        openedArticleFromPushRef.current = openArticleId;
        handleArticlePress(article);
        onOpenArticleConsumed?.();
      } catch {
        openedArticleFromPushRef.current = openArticleId;
        onOpenArticleConsumed?.();
      }
    };

    void openFromId();
    return () => {
      cancelled = true;
    };
  }, [
    openArticleId,
    articles,
    loading,
    handleArticlePress,
    onOpenArticleConsumed,
  ]);

  // ניווט לחדשה הבאה
  const handleNextArticle = useCallback(() => {
    if (selectedArticleIndex < filteredArticles.length - 1) {
      void HapticFeedback.selection();
      const nextIndex = selectedArticleIndex + 1;
      setSelectedArticleIndex(nextIndex);
      setSelectedArticle(filteredArticles[nextIndex]);
    }
  }, [selectedArticleIndex, filteredArticles]);

  // ניווט לחדשה הקודמת
  const handlePreviousArticle = useCallback(() => {
    if (selectedArticleIndex > 0) {
      void HapticFeedback.selection();
      const prevIndex = selectedArticleIndex - 1;
      setSelectedArticleIndex(prevIndex);
      setSelectedArticle(filteredArticles[prevIndex]);
    }
  }, [selectedArticleIndex, filteredArticles]);

  // סגירת מודל מפורט — שומרים את הכתבה עד סיום אנימציית השיט
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalVisible(false);
  }, []);

  useEffect(() => {
    if (!detailModalVisible && selectedArticle) {
      const timer = setTimeout(() => {
        setSelectedArticle(null);
        setSelectedArticleIndex(0);
      }, SHEET_MOTION_MS + 40);
      return () => clearTimeout(timer);
    }
  }, [detailModalVisible, selectedArticle]);

  // שיתוף מהמודל המפורט
  const handleShareFromModal = useCallback(async (article: NewsArticle) => {
    try {
      const shareContent = {
        title: article.label || article.title,
        message: `${article.label || article.title}\n\n${article.summary || article.content || ''}\n\nמקור: ${article.source}`,
        url: article.source_url
      };

      await Share.share(shareContent);
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן לשתף את הכתבה');
    }
  }, []);

  // פתיחת מודל שיתוף
  const handleSharePress = useCallback((article: NewsArticle) => {
    setShareArticle(article);
    setShareModalVisible(true);
  }, []);
  
  // סגירת מודל שיתוף
  const handleShareClose = useCallback(() => {
    setShareModalVisible(false);
    setShareArticle(null);
  }, []);

  const screenPad = APP_LAYOUT.screenPaddingHorizontal;

  /** חיפוש מימין, לב משמאל — כיוון LTR לשורה בלבד כדי שלא ייעלם הלב ב־RTL */
  const renderSearchHeader = useCallback(() => {
    const searchActive = searchQuery.trim().length > 0;
    const openLiked = () => (navigation as { navigate: (n: string) => void }).navigate('NewsLiked');
    return (
      <View
        style={{
          paddingHorizontal: screenPad,
          paddingTop: 4,
          paddingBottom: 14,
          marginBottom: 8,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          // כפיית סדר שמאל→ימין לשורה — מונע דחיפת הלב מחוץ למסך במצב RTL גלובלי
          direction: 'ltr',
        }}
      >
        <TouchableOpacity
          onPress={openLiked}
          activeOpacity={0.88}
          accessibilityRole="button"
          accessibilityLabel="כתבות שמורות"
          style={{ flexShrink: 0, zIndex: 2 }}
        >
          <UICard
            variant="blur"
            glassIntensity="subtle"
            padding="none"
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              overflow: 'hidden',
            }}
            contentContainerStyle={{
              flex: 1,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons name="heart-outline" size={22} color={DesignTokens.colors.text.primary} />
          </UICard>
        </TouchableOpacity>

        <View style={{ flex: 1, minWidth: 0 }}>
          <UICard
            variant="blur"
            glassIntensity="subtle"
            padding="none"
            style={{
              borderRadius: DesignTokens.borderRadius.search,
              overflow: 'hidden',
            }}
          >
            <View style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 12, minHeight: 40 }}>
              {searchActive ? (
                <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Ionicons name="close-circle" size={20} color={DesignTokens.colors.text.tertiary} />
                </TouchableOpacity>
              ) : (
                <View style={{ width: 20 }} />
              )}
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="חיפוש בחדשות..."
                placeholderTextColor={DesignTokens.colors.text.tertiary}
                style={{
                  flex: 1,
                  marginHorizontal: 8,
                  color: DesignTokens.colors.text.primary,
                  ...APP_TYPE.body,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  paddingVertical: 6,
                }}
                returnKeyType="search"
              />
              <Ionicons name="search" size={18} color={DesignTokens.colors.text.tertiary} />
            </View>
          </UICard>
        </View>
      </View>
    );
  }, [DesignTokens, navigation, searchQuery, screenPad]);
  
  // רינדור כתבה
  const renderArticle = ({ item }: { item: NewsArticle }) => (
    <BreakingNewsCard
      article={item}
      onPress={handleArticlePress}
      onLike={handleLike}
      onShare={handleSharePress}
      isLiked={likedArticles.has(item.id)}
    />
  );

  // רינדור רשימה ריקה
  const renderEmptyState = () => {
    const hasSearch = searchQuery.trim().length > 0;
    return (
      <View className="flex-1 justify-center items-center px-8 py-16">
        <Ionicons
          name={hasSearch ? 'search-outline' : 'newspaper-outline'}
          size={48}
          color={DesignTokens.colors.text.tertiary}
        />
        <Text
          style={{
            ...APP_TYPE.sectionTitle,
            color: DesignTokens.colors.text.primary,
            textAlign: 'center',
            marginTop: APP_LAYOUT.componentGap,
          }}
        >
          {hasSearch ? 'אין תוצאות לחיפוש' : 'אין חדשות כרגע'}
        </Text>
        <Text
          style={{
            ...APP_TYPE.cardSubtitle,
            color: DesignTokens.colors.text.secondary,
            textAlign: 'center',
            marginTop: APP_LAYOUT.groupLabelToContent,
          }}
        >
          {hasSearch ? 'נסה ניסוח אחר או נקה את החיפוש' : 'משיכה למטה לרענון — החדשות יופיעו כאן'}
        </Text>
      </View>
    );
  };

  if (loading && articles.length === 0) {
    return (
      <View style={{ flex: 1, paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingTop: APP_LAYOUT.sectionHeaderToContent }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} delay={i * 70} />
        ))}
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      {/* חיפוש + כפתור כתבות שאהבתי — קבועים, מחוץ לרשימה */}
      {renderSearchHeader()}
      <View style={{ flex: 1 }}>
        <FlatList
          data={filteredArticles}
          keyExtractor={(item) => item.id}
          renderItem={renderArticle}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={DesignTokens.colors.primary.main}
              colors={[DesignTokens.colors.primary.main]}
            />
          }
          ListEmptyComponent={renderEmptyState}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            paddingTop: 4,
            paddingBottom: listBottomInset + DesignTokens.spacing.md,
            flexGrow: 1,
          }}
        />
      </View>
      
      {/* מודל מפורט לחדשות */}
      {selectedArticle ? (
        <NewsDetailModal
          visible={detailModalVisible}
          article={selectedArticle}
          isLiked={likedArticles.has(selectedArticle.id)}
          onClose={handleCloseDetailModal}
          onLike={handleLike}
          onShare={handleShareFromModal}
          currentIndex={selectedArticleIndex}
          totalArticles={filteredArticles.length}
          onNext={handleNextArticle}
          onPrevious={handlePreviousArticle}
        />
      ) : null}

      {/* מודל שיתוף - העברת חדשה לקבוצות צ'אט */}
      <ShareModal
        article={shareArticle}
        onClose={handleShareClose}
        visible={shareModalVisible}
      />

    </View>
  );
}
