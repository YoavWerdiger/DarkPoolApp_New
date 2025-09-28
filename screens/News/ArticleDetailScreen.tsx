import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  Share,
  Linking,
  ActivityIndicator,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { NewsArticle, newsService, formatNewsDate, getNewsCategoryColor, getNewsCategoryIcon } from '../../services/newsService';

type RootStackParamList = {
  ArticleDetail: { article: NewsArticle };
};

type ArticleDetailRouteProp = RouteProp<RootStackParamList, 'ArticleDetail'>;

const { width } = Dimensions.get('window');

export default function ArticleDetailScreen() {
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
      console.error('❌ ArticleDetail: Error sharing:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף את הכתבה');
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
          Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור');
        }
      } catch (error) {
        console.error('❌ ArticleDetail: Error opening URL:', error);
        Alert.alert('שגיאה', 'לא ניתן לפתוח את הקישור');
      }
    }
  };

  // סימון כמועדף
  const handleBookmark = () => {
    setIsBookmarked(!isBookmarked);
    // TODO: שמירה במסד הנתונים
    Alert.alert(
      isBookmarked ? 'הוסר מהמועדפים' : 'נוסף למועדפים',
      isBookmarked ? 'הכתבה הוסרה מהרשימה שלך' : 'הכתבה נוספה למועדפים שלך'
    );
  };

  return (
    <View 
      className="flex-1"
      style={{ backgroundColor: DesignTokens.colors.background.primary }}
    >
      <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
      
      <SafeAreaView className="flex-1">
        {/* Header עם כפתורים */}
        <View 
          className="flex-row items-center justify-between px-4 py-3"
          style={{ backgroundColor: DesignTokens.colors.background.secondary }}
        >
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            className="w-10 h-10 rounded-full items-center justify-center"
            style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
          >
            <Ionicons 
              name="arrow-back" 
              size={20} 
              color={DesignTokens.colors.text.primary} 
            />
          </TouchableOpacity>

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
          <View className="px-4 pt-6">
            {/* קטגוריה */}
            {article.category && (
              <View 
                className="px-4 py-2 rounded-full self-start mb-4"
                style={{ backgroundColor: categoryColor + '20' }}
              >
                <View className="flex-row items-center">
                  <Ionicons 
                    name={categoryIcon as any} 
                    size={16} 
                    color={categoryColor} 
                    style={{ marginRight: 8 }}
                  />
                  <Text 
                    className="text-sm font-semibold"
                    style={{ color: categoryColor }}
                  >
                    {article.category}
                  </Text>
                </View>
              </View>
            )}

            {/* כותרת */}
            <Text 
              className="text-2xl font-bold mb-4 leading-8"
              style={{ color: DesignTokens.colors.text.primary }}
            >
              {article.title}
            </Text>

            {/* מידע על הכתבה */}
            <View className="flex-row items-center justify-between mb-6">
              <View className="flex-row items-center">
                <Text 
                  className="text-sm font-medium"
                  style={{ color: DesignTokens.colors.text.secondary }}
                >
                  {article.source}
                </Text>
                {article.author && (
                  <>
                    <Text 
                      className="text-sm mx-2"
                      style={{ color: DesignTokens.colors.text.tertiary }}
                    >
                      •
                    </Text>
                    <Text 
                      className="text-sm"
                      style={{ color: DesignTokens.colors.text.secondary }}
                    >
                      {article.author}
                    </Text>
                  </>
                )}
              </View>

              <Text 
                className="text-sm"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                {formatNewsDate(article.published_at)}
              </Text>
            </View>

            {/* סיכום */}
            {article.summary && (
              <View 
                className="p-4 rounded-xl mb-6"
                style={{ backgroundColor: DesignTokens.colors.background.secondary }}
              >
                <Text 
                  className="text-base leading-6 font-medium"
                  style={{ color: DesignTokens.colors.text.primary }}
                >
                  {article.summary}
                </Text>
              </View>
            )}

            {/* תוכן מלא */}
            <View className="mb-6">
              <Text 
                className="text-base leading-7"
                style={{ color: DesignTokens.colors.text.primary }}
              >
                {article.content}
              </Text>
            </View>

            {/* מידע נוסף */}
            <View 
              className="p-4 rounded-xl"
              style={{ backgroundColor: DesignTokens.colors.background.secondary }}
            >
              <Text 
                className="text-sm font-semibold mb-3"
                style={{ color: DesignTokens.colors.text.primary }}
              >
                פרטים נוספים
              </Text>
              
              <View className="space-y-2">
                {article.source_url && (
                  <TouchableOpacity
                    onPress={handleOpenSource}
                    className="flex-row items-center justify-between py-2"
                  >
                    <View className="flex-row items-center">
                      <Ionicons 
                        name="link" 
                        size={16} 
                        color={DesignTokens.colors.primary.main} 
                        style={{ marginRight: 8 }}
                      />
                      <Text 
                        className="text-sm"
                        style={{ color: DesignTokens.colors.text.secondary }}
                      >
                        קישור למקור
                      </Text>
                    </View>
                    <Ionicons 
                      name="chevron-forward" 
                      size={16} 
                      color={DesignTokens.colors.text.tertiary} 
                    />
                  </TouchableOpacity>
                )}

                {article.view_count && (
                  <View className="flex-row items-center py-2">
                    <Ionicons 
                      name="eye" 
                      size={16} 
                      color={DesignTokens.colors.text.tertiary} 
                      style={{ marginRight: 8 }}
                    />
                    <Text 
                      className="text-sm"
                      style={{ color: DesignTokens.colors.text.tertiary }}
                    >
                      {article.view_count.toLocaleString()} צפיות
                    </Text>
                  </View>
                )}

                {article.sentiment && (
                  <View className="flex-row items-center py-2">
                    <Ionicons 
                      name={
                        article.sentiment === 'positive' ? 'trending-up' :
                        article.sentiment === 'negative' ? 'trending-down' : 'remove'
                      } 
                      size={16} 
                      color={
                        article.sentiment === 'positive' ? DesignTokens.colors.success.main :
                        article.sentiment === 'negative' ? DesignTokens.colors.danger.main : 
                        DesignTokens.colors.text.tertiary
                      } 
                      style={{ marginRight: 8 }}
                    />
                    <Text 
                      className="text-sm"
                      style={{ color: DesignTokens.colors.text.tertiary }}
                    >
                      {article.sentiment === 'positive' ? 'חיובי' :
                       article.sentiment === 'negative' ? 'שלילי' : 'ניטרלי'}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* כפתור לקריאה במקור */}
            {article.source_url && (
              <TouchableOpacity
                onPress={handleOpenSource}
                className="mt-6 py-4 px-6 rounded-xl items-center"
                style={{ backgroundColor: DesignTokens.colors.primary.main }}
              >
                <View className="flex-row items-center">
                  <Ionicons 
                    name="open-outline" 
                    size={20} 
                    color={DesignTokens.colors.text.primary} 
                    style={{ marginRight: 8 }}
                  />
                  <Text 
                    className="text-base font-semibold"
                    style={{ color: DesignTokens.colors.text.primary }}
                  >
                    קרא במקור המלא
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}
