import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, FlatList, RefreshControl, ActivityIndicator, TouchableOpacity, Image, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Trash2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UICard from '../../components/ui/UICard';
import { LikedArticlesService, LikedArticle } from '../../services/likedArticlesService';
import { formatNewsDate } from '../../services/newsService';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { NewsScreenShell } from './NewsScreenShell';
import { HapticFeedback } from '../../utils/hapticFeedback';

const SHEET_DIVIDER = 'rgba(255, 255, 255, 0.12)';

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
  const cardRadius = DesignTokens.borderRadius['2xl'];

  return (
    <Pressable
      onPress={() => onPress(article)}
      style={{ marginBottom: 12 }}
      accessibilityRole="button"
    >
      <UICard variant="blur" padding="none" style={{ borderRadius: cardRadius, overflow: 'hidden' }}>
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
                style={StyleSheet.absoluteFillObject}
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
                    fontSize: 17,
                    fontWeight: '600',
                    color: '#FFFFFF',
                    textAlign: 'right',
                    lineHeight: 22,
                  }}
                  numberOfLines={2}
                >
                  {article.article_title}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.7)',
                    marginTop: 4,
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
                  fontSize: 17,
                  fontWeight: '600',
                  color: DesignTokens.colors.text.primary,
                  textAlign: 'right',
                  marginTop: 12,
                }}
                numberOfLines={3}
              >
                {article.article_title}
              </Text>
            </View>
          )}
        </View>

        <View style={{ height: 1, backgroundColor: SHEET_DIVIDER }} />

        <View
          style={{
            paddingHorizontal: DesignTokens.spacing.lg,
            paddingTop: DesignTokens.spacing.md,
            paddingBottom: DesignTokens.spacing.lg,
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
                accessibilityLabel="הסר מכתבות שמורות"
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
                gap: 12,
              }}
            >
              <Text
                style={{
                  fontSize: 12,
                  color: DesignTokens.colors.text.tertiary,
                  textAlign: 'right',
                  flex: 1,
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
                accessibilityLabel="הסר מכתבות שמורות"
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

export default function LikedArticlesScreen() {
  const DesignTokens = useDesignTokens();
  const pad = DesignTokens.layout?.screenPadding ?? 20;
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
      legacyAlert('שגיאה', 'לא ניתן לטעון את החדשות שאהבת');
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
        legacyAlert('שגיאה', 'לא ניתן להסיר את האהבתי');
      }
    } catch (error) {
      legacyAlert('שגיאה', 'בעיה בהסרת האהבתי');
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
      'מחיקת כל החדשות',
      'האם אתה בטוח שברצונך למחוק את כל החדשות שאהבת?',
      [
        { text: 'ביטול', style: 'cancel' },
        {
          text: 'מחק הכל',
          style: 'destructive',
          onPress: async () => {
            const success = await LikedArticlesService.clearAllLikedArticles();
            if (success) {
              void HapticFeedback.impactLight();
              setLikedArticles([]);
            } else {
              legacyAlert('שגיאה', 'לא ניתן למחוק את החדשות');
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
  const renderArticle = ({ item }: { item: LikedArticle }) => (
    <LikedArticleCard
      article={item}
      onPress={handleArticlePress}
      onUnlike={handleUnlike}
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
        fontSize: 20,
        fontWeight: 'bold',
        marginTop: 16,
        textAlign: 'center',
        color: DesignTokens.colors.text.primary
      }}>
        אין חדשות שאהבת
      </Text>
      <Text style={{
        fontSize: 14,
        marginTop: 8,
        textAlign: 'center',
        color: DesignTokens.colors.text.secondary,
        lineHeight: 20
      }}>
        לחץ על הלב בחדשות כדי לשמור אותן כאן
      </Text>
    </View>
  );

  const headerRight =
    !loading && likedArticles.length > 0 ? (
      <TouchableOpacity
        onPress={handleClearAll}
        accessibilityLabel="מחק את כל הכתבות השמורות"
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
          fontSize: 12,
          color: DesignTokens.colors.text.secondary,
          textAlign: 'center',
          marginBottom: 10,
        }}
      >
        {likedArticles.length} כתבות
      </Text>
    ) : null;

  if (loading) {
    return (
      <NewsScreenShell title="כתבות שמורות">
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
          <Text style={{ marginTop: 16, fontSize: 16, color: DesignTokens.colors.text.secondary }}>טוען...</Text>
        </View>
      </NewsScreenShell>
    );
  }

  return (
    <NewsScreenShell title="כתבות שמורות" headerRight={headerRight}>
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
        contentContainerStyle={{
          paddingHorizontal: pad,
          paddingBottom: listBottomPadding,
          flexGrow: 1,
          ...(likedArticles.length === 0 && { flex: 1 }),
        }}
      />
    </NewsScreenShell>
  );
}
