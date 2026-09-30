import { legacyAlert } from '../../utils/appDialog';
import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Share, Linking, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import UIButton from '../../components/ui/UIButton';
import { DayNavBlurButton } from '../../components/ui/DayNavBlurButton';
import { NewsArticle, newsService, formatNewsDate, getNewsCategoryColor, getNewsCategoryIcon } from '../../services/newsService';

type RootStackParamList = {
  ArticleDetail: { article: NewsArticle };
};

type ArticleDetailRouteProp = RouteProp<RootStackParamList, 'ArticleDetail'>;

const { width } = Dimensions.get('window');

export default function ArticleDetailScreen() {
  const DesignTokens = useDesignTokens();
  const navigation = useNavigation();
  const route = useRoute<ArticleDetailRouteProp>();
  const { article } = route.params;
  
  const [loading, setLoading] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);

  const categoryColor = getNewsCategoryColor(article.category);
  const categoryIcon = getNewsCategoryIcon(article.category);

  // טעינה ראשונית
  useEffect(() => {
    // עדכון מספר צפיות
    newsService.incrementViewCount(article.id);
  }, [article.id]);

  // שיתוף הכתבה
  const handleShare = async () => {
    try {
      const shareContent = {
        title: article.title,
        message: `${article.title}\n\n${article.summary || ''}\n\nקרא עוד: ${article.source_url || ''}`,
        url: article.source_url
      };

      await Share.share(shareContent);
    } catch (error) {
      legacyAlert('שגיאה', 'לא ניתן לשתף את הכתבה');
    }
  };

  // פתיחת מקור חיצוני
  const handleOpenSource = async () => {
    if (article.source_url) {
      try {
        const supported = await Linking.canOpenURL(article.source_url);
        if (supported) {
          await Linking.openURL(article.source_url);
        } else {
          legacyAlert('שגיאה', 'לא ניתן לפתוח את הקישור');
        }
      } catch (error) {
        legacyAlert('שגיאה', 'לא ניתן לפתוח את הקישור');
      }
    }
  };

  // סימון כמועדף
  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: שמירה במסד הנתונים
    legacyAlert(
      isBookmarked ? 'הוסר מהמועדפים' : 'נוסף למועדפים',
      isBookmarked ? 'הכתבה הוסרה מהרשימה שלך' : 'הכתבה נוספה למועדפים שלך'
    );
  };

  return (
    <View 
      className="flex-1"
      style={{ backgroundColor: 'transparent' }}
    > 
      <SafeAreaView className="flex-1">
        {/* Header עם כפתורים */}
        <View 
          className="flex-row items-center justify-between px-4 py-3"
          style={{ backgroundColor: DesignTokens.colors.background.secondary }}
        >
          <DayNavBlurButton
            onPress={() => navigation.goBack()}
            size={40}
            accessibilityLabel="חזרה"
          >
            <Ionicons
              name="arrow-back"
              size={20}
              color={DesignTokens.colors.text.primary}
            />
          </DayNavBlurButton>

          <View className="flex-row items-center">
            <TouchableOpacity
              onPress={handleBookmark}
              className="w-10 h-10 rounded-full items-center justify-center mr-2"
              style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
            >
              <Ionicons 
                name={isBookmarked ? "bookmark" : "bookmark-outline"} 
                size={20} 
                color={isBookmarked ? DesignTokens.colors.primary.main : DesignTokens.colors.text.primary} 
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              className="w-10 h-10 rounded-full items-center justify-center"
              style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
            >
              <Ionicons 
                name="share-outline" 
                size={20} 
                color={DesignTokens.colors.text.primary} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          className="flex-1"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
          {/* תמונה */}
          {article.image_url && (
            <Image
              source={{ uri: article.image_url }}
              className="w-full h-64"
              resizeMode="cover"
              style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
            />
          )}

          {/* תוכן */}
          <View style={{ paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, paddingTop: APP_LAYOUT.sectionGap }}>
            {article.category ? (
              <View
                style={{
                  paddingHorizontal: APP_LAYOUT.cardPadding,
                  paddingVertical: APP_LAYOUT.groupLabelToContent,
                  borderRadius: DesignTokens.borderRadius.full,
                  alignSelf: 'flex-start',
                  marginBottom: APP_LAYOUT.componentGap,
                  backgroundColor: categoryColor + '20',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons
                    name={categoryIcon as any}
                    size={16}
                    color={categoryColor}
                    style={{ marginLeft: APP_LAYOUT.cardTitleToBodyGap }}
                  />
                  <Text style={{ ...APP_TYPE.cardSubtitle, color: categoryColor }}>
                    {article.category}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text
              style={{
                ...APP_TYPE.sectionTitle,
                color: DesignTokens.colors.text.primary,
                marginBottom: APP_LAYOUT.componentGap,
              }}
            >
              {article.title}
            </Text>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: APP_LAYOUT.sectionGap,
              }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...APP_TYPE.cardSubtitle, color: DesignTokens.colors.text.secondary }}>
                  {article.source}
                </Text>
                {article.author ? (
                  <>
                    <Text
                      style={{
                        ...APP_TYPE.cardSubtitle,
                        color: DesignTokens.colors.text.tertiary,
                        marginHorizontal: 8,
                      }}
                    >
                      •
                    </Text>
                    <Text style={{ ...APP_TYPE.cardSubtitle, color: DesignTokens.colors.text.secondary }}>
                      {article.author}
                    </Text>
                  </>
                ) : null}
              </View>

              <Text style={{ ...APP_TYPE.cardSubtitle, color: DesignTokens.colors.text.tertiary }}>
                {formatNewsDate(article.published_at)}
              </Text>
            </View>

            {article.summary ? (
              <View
                style={{
                  padding: APP_LAYOUT.cardPadding,
                  borderRadius: UI_CARD_RADIUS,
                  marginBottom: APP_LAYOUT.sectionGap,
                  backgroundColor: DesignTokens.colors.background.cardSolid,
                }}
              >
                <Text style={{ ...APP_TYPE.body, color: DesignTokens.colors.text.primary }}>
                  {article.summary}
                </Text>
              </View>
            ) : null}

            <View style={{ marginBottom: APP_LAYOUT.sectionGap }}>
              <Text style={{ ...APP_TYPE.body, color: DesignTokens.colors.text.primary }}>
                {article.content}
              </Text>
            </View>

            <View
              style={{
                paddingHorizontal: APP_LAYOUT.cardPadding,
                borderRadius: UI_CARD_RADIUS,
                backgroundColor: DesignTokens.colors.background.cardSolid,
              }}
            >
              <Text
                style={{
                  ...APP_TYPE.cardTitle,
                  color: DesignTokens.colors.text.primary,
                  marginTop: APP_LAYOUT.cardPadding,
                  marginBottom: APP_LAYOUT.cardTitleToBodyGap,
                }}
              >
                פרטים נוספים
              </Text>

              {article.source_url ? (
                <TouchableOpacity
                  onPress={handleOpenSource}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 15,
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons
                      name="link"
                      size={16}
                      color={DesignTokens.colors.text.primary}
                      style={{ marginLeft: APP_LAYOUT.cardTitleToBodyGap }}
                    />
                    <Text style={{ ...APP_TYPE.cardTitle, color: DesignTokens.colors.text.primary }}>
                      קישור למקור
                    </Text>
                  </View>
                  <Ionicons
                    name="chevron-forward"
                    size={16}
                    color={DesignTokens.colors.text.tertiary}
                  />
                </TouchableOpacity>
              ) : null}

              {article.view_count ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 15,
                    borderTopWidth: article.source_url ? 1 : 0,
                    borderTopColor: DesignTokens.colors.border.divider,
                  }}
                >
                  <Ionicons
                    name="eye"
                    size={16}
                    color={DesignTokens.colors.text.primary}
                    style={{ marginLeft: APP_LAYOUT.cardTitleToBodyGap }}
                  />
                  <Text style={{ ...APP_TYPE.body, color: DesignTokens.colors.text.secondary }}>
                    {article.view_count.toLocaleString()} צפיות
                  </Text>
                </View>
              ) : null}

              {article.sentiment ? (
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 15,
                    borderTopWidth: 1,
                    borderTopColor: DesignTokens.colors.border.divider,
                  }}
                >
                  <Ionicons
                    name={
                      article.sentiment === 'positive' ? 'trending-up' :
                      article.sentiment === 'negative' ? 'trending-down' : 'remove'
                    }
                    size={16}
                    color={
                      article.sentiment === 'positive' ? DesignTokens.colors.success.main :
                      article.sentiment === 'negative' ? DesignTokens.colors.danger.main :
                      DesignTokens.colors.text.primary
                    }
                    style={{ marginLeft: APP_LAYOUT.cardTitleToBodyGap }}
                  />
                  <Text style={{ ...APP_TYPE.body, color: DesignTokens.colors.text.secondary }}>
                    {article.sentiment === 'positive' ? 'חיובי' :
                     article.sentiment === 'negative' ? 'שלילי' : 'ניטרלי'}
                  </Text>
                </View>
              ) : null}
            </View>

            {article.source_url ? (
              <UIButton
                title="קרא במקור המלא"
                variant="primary"
                icon="open-outline"
                onPress={handleOpenSource}
                fullWidth
                style={{ marginTop: APP_LAYOUT.sectionGap }}
              />
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
