import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Pressable,
  TouchableOpacity,
  Image,
  Linking,
  Modal,
  Share,
  ScrollView,
  Animated,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
// import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { 
  newsService, 
  NewsArticle, 
  formatNewsDate,
  truncateText,
  getNewsCategoryColor,
  getNewsCategoryIcon
} from '../../services/newsService';
import { LikedArticlesService } from '../../services/likedArticlesService';
import UICard from '../../components/ui/UICard';
// Fear & Greed מוצג בטאב "עיקרי מדדים" בלבד

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

const ShareModal: React.FC<ShareModalProps> = ({ article, onClose, visible }) => {
  const DesignTokens = useDesignTokens();
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // טעינת קבוצות הצ'אט כשהבוטום שיט נפתח
  useEffect(() => {
    if (visible && article) {
      loadChatGroups();
    } else {
      // איפוס כשסוגרים
      setChatGroups([]);
      setLoading(false);
    }
  }, [visible, article]);

  const loadChatGroups = async () => {
    setLoading(true);
    try {
      // קבלת המשתמש הנוכחי
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (!user) {
        Alert.alert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      // קבלת קבוצות הצ'אט של המשתמש
      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      if (memberError) {
        Alert.alert('שגיאה', `לא ניתן לטעון קבוצות: ${memberError.message}`);
        return;
      }

      const channelIds = memberRows?.map(row => row.channel_id) || [];

      if (channelIds.length > 0) {
        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .select('id, name, image_url')
          .in('id', channelIds)
          .order('name');

        if (channelsError) {
          Alert.alert('שגיאה', `לא ניתן לטעון פרטי קבוצות: ${channelsError.message}`);
          return;
        }

        setChatGroups(channels || []);
      } else {
        // נסיון חלופי - לטעון את כל הערוצים הפומביים
        const { data: publicChannels, error: publicError } = await supabase
          .from('channels')
          .select('id, name, image_url')
          .eq('is_private', false)
          .order('name')
          .limit(10);

        if (!publicError && publicChannels && publicChannels.length > 0) {
          setChatGroups(publicChannels);
        } else {
          setChatGroups([]);
        }
      }
    } catch (error) {
      Alert.alert('שגיאה', 'שגיאה בטעינת קבוצות');
    } finally {
      setLoading(false);
    }
  };

  const shareToGroup = async (groupId: string, groupName: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      // יצירת אובייקט החדשה המלא
      const newsData = {
        id: article?.id,
        title: article?.title,
        summary: article?.summary,
        content: article?.content,
        source: article?.source,
        source_url: article?.source_url,
        author: article?.author,
        image_url: article?.image_url,
        published_at: article?.published_at,
        category: article?.category,
        tags: article?.tags,
        reading_time: article?.reading_time || 1,
        view_count: article?.view_count || 0
      };

      // שליחת הודעת חדשות מיוחדת לקבוצה
      const { data, error } = await supabase
        .from('messages')
        .insert({
          channel_id: groupId,
          sender_id: user.id,
          content: article?.title || 'חדשה',
          type: 'news',
          news_data: newsData
        });

      if (error) {
        Alert.alert('שגיאה', 'לא ניתן לשתף לקבוצה');
        return;
      }

      Alert.alert('הצלחה', `החדשה שותפה לקבוצה "${groupName}"`);
      onClose();
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לשתף לקבוצה');
    }
  };

  // Early return - אבל רק אחרי כל ה-hooks
  if (!article || !visible) {
    return null;
  }

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.5, 0.9]}
      enablePanDownToClose={true}
      backdropOpacity={0.5}
      showHandle={true}
    >
      <View style={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}>
          <ScrollView contentContainerStyle={{ paddingBottom: 20 }} showsVerticalScrollIndicator={false}>
        {/* כותרת - SwiftUI style */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 }}>
          <Text 
            style={{ fontSize: 28, fontWeight: '700', color: DesignTokens.colors.text.primary, textAlign: 'right', letterSpacing: -0.5 }}
          >
            שתף לקבוצה
          </Text>
          <TouchableOpacity 
            onPress={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Ionicons 
              name="close" 
              size={20} 
              color={DesignTokens.colors.text.primary} 
            />
          </TouchableOpacity>
        </View>

        {/* תצוגה מקדימה של החדשה - SwiftUI style */}
        <View 
          style={{
            padding: 0,
            borderRadius: 16,
            backgroundColor: 'transparent',
            marginBottom: 32,
            overflow: 'hidden'
          }}
        >
          {article.image_url && (
            <Image
              source={{ uri: article.image_url }}
              style={{
                width: '100%',
                height: 180,
                marginBottom: 16
              }}
              resizeMode="cover"
            />
          )}
          <View style={{ paddingHorizontal: 4 }}>
            <Text 
              style={{ 
                fontSize: 20, 
                fontWeight: '600', 
                color: DesignTokens.colors.text.primary, 
                textAlign: 'right',
                marginBottom: 8,
                lineHeight: 26,
                letterSpacing: -0.3
              }}
              numberOfLines={3}
            >
              {article.label || article.title}
            </Text>
            <Text 
              style={{ 
                fontSize: 15, 
                color: 'rgba(255,255,255,0.6)', 
                textAlign: 'right',
                marginBottom: 12,
                lineHeight: 22
              }}
              numberOfLines={3}
            >
              {article.label ? article.title : article.summary}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' }}>
              <Text 
                style={{ 
                  fontSize: 13, 
                  color: 'rgba(255,255,255,0.5)', 
                  textAlign: 'right',
                  fontWeight: '500'
                }}
              >
                {article.source}
              </Text>
            </View>
          </View>
        </View>

        {/* רשימת קבוצות - SwiftUI style */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <ActivityIndicator size="large" color="rgba(255,255,255,0.6)" />
            <Text 
              style={{ fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 20, fontWeight: '500' }}
            >
              טוען קבוצות...
            </Text>
          </View>
        ) : chatGroups.length > 0 ? (
          <View>
            <Text 
              style={{ 
                fontSize: 22, 
                fontWeight: '600', 
                color: DesignTokens.colors.text.primary, 
                textAlign: 'right',
                marginBottom: 20,
                letterSpacing: -0.3
              }}
            >
              בחר קבוצה
            </Text>
            {chatGroups.map((group, index) => (
              <TouchableOpacity
                key={group.id}
                style={{
                  flexDirection: 'row-reverse',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 4,
                  marginBottom: index < chatGroups.length - 1 ? 0 : 0,
                  borderBottomWidth: index < chatGroups.length - 1 ? 0.5 : 0,
                  borderBottomColor: 'rgba(255,255,255,0.1)'
                }}
                onPress={() => shareToGroup(group.id, group.name)}
              >
                <View style={{ flex: 1, marginRight: 16 }}>
                  <Text 
                    style={{ 
                      fontSize: 17, 
                      fontWeight: '600', 
                      color: DesignTokens.colors.text.primary, 
                      textAlign: 'right',
                      marginBottom: 4,
                      letterSpacing: -0.2
                    }}
                  >
                    {group.name}
                  </Text>
                  <Text 
                    style={{ 
                      fontSize: 14, 
                      color: 'rgba(255,255,255,0.5)', 
                      textAlign: 'right' 
                    }}
                  >
                    קבוצת צ'אט
                  </Text>
                </View>
                <View 
                  style={{
                    width: 50,
                    height: 50,
                    borderRadius: 25,
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden'
                  }}
                >
                  {group.image_url ? (
                    <Image 
                      source={{ uri: group.image_url }}
                      style={{ width: 50, height: 50 }}
                      resizeMode="cover"
                    />
                  ) : (
                    <Ionicons 
                      name="people" 
                      size={24} 
                      color="rgba(255,255,255,0.6)" 
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 60 }}>
            <View style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: 'rgba(255,255,255,0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 24
            }}>
              <Ionicons 
                name="chatbubbles-outline" 
                size={32} 
                color="rgba(255,255,255,0.5)" 
              />
            </View>
            <Text 
              style={{ 
                fontSize: 20, 
                fontWeight: '600', 
                color: DesignTokens.colors.text.primary, 
                marginBottom: 8,
                letterSpacing: -0.3
              }}
            >
              אין קבוצות זמינות
            </Text>
            <Text 
              style={{ 
                fontSize: 15, 
                color: 'rgba(255,255,255,0.5)', 
                textAlign: 'center',
                marginBottom: 32,
                lineHeight: 22,
                paddingHorizontal: 20
              }}
            >
              הצטרף לקבוצות כדי לשתף חדשות
            </Text>
            <TouchableOpacity
              style={{
                width: '100%',
                paddingVertical: 16,
                borderRadius: 12,
                backgroundColor: DesignTokens.colors.primary.main,
                alignItems: 'center'
              }}
              onPress={loadChatGroups}
            >
              <Text 
                style={{ 
                  fontSize: 17, 
                  fontWeight: '600', 
                  color: DesignTokens.colors.background.primary 
                }}
              >
                נסה שוב
              </Text>
            </TouchableOpacity>
          </View>
        )}
          </ScrollView>
        </View>
    </BottomSheet>
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

  if (!article) return null;

  const categoryColor = getNewsCategoryColor(article.category);
  const categoryIcon = getNewsCategoryIcon(article.category);
  
  // זיהוי אם זה טוויטר או חדשה רגילה
  const isTwitterPost = article.source === 'Twitter' || 
                       article.source === 'Bloomberg' || 
                       article.source === 'Reuters' ||
                       article.source === 'CNN' ||
                       article.source === 'BBC' ||
                       article.source === 'טוויטר' ||
                       article.url?.includes('twitter.com') ||
                       article.source_url?.includes('twitter.com') ||
                       article.id?.length > 15;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.7, 0.95]}
      enablePanDownToClose={true}
      backdropOpacity={0.5}
      showHandle={!article.image_url}
    >
      <View style={{ flex: 1 }}>
        {/* תמונה - עד לחלק העליון של ה-BottomSheet */}
        {article.image_url ? (
          <View 
            style={{ 
              width: '100%', 
              height: 240, 
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              zIndex: 1,
              overflow: 'hidden',
            }}
            pointerEvents="box-none"
          >
            <Image
              source={{ uri: article.image_url }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
            {/* פס גרירה - מעל התמונה */}
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
            {/* כפתור סגירה - על התמונה */}
            <View 
              style={{ 
                position: 'absolute', 
                top: 12, 
                right: 12, 
                zIndex: 100,
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                alignItems: 'center',
                justifyContent: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}
              pointerEvents="auto"
            >
              <TouchableOpacity
                onPress={onClose}
                style={{
                  width: '100%',
                  height: '100%',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Ionicons 
                  name="close" 
                  size={22} 
                  color="#FFF" 
                />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* כפתור סגירה - כשאין תמונה */
          <View style={{ 
            position: 'absolute', 
            top: 12, 
            right: 12, 
            zIndex: 100,
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: DesignTokens.colors.background.tertiary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}>
            <TouchableOpacity
              onPress={onClose}
              style={{
                width: '100%',
                height: '100%',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Ionicons 
                name="close" 
                size={22} 
                color={DesignTokens.colors.text.primary} 
              />
            </TouchableOpacity>
          </View>
        )}

        {/* תוכן - ScrollView */}
        <ScrollView 
          contentContainerStyle={{ 
            paddingBottom: 40, // מרווח תחתון נוסף - ה-safe area כבר מטופל ב-BottomSheet
            paddingTop: article.image_url ? 240 : 0, // מקום לתמונה
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* תוכן */}
          <View style={{ paddingHorizontal: 20, paddingTop: article.image_url ? 20 : 20 }}>
            {/* כותרת */}
            <Text 
              style={{ 
                fontSize: 20,
                fontWeight: '700',
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                lineHeight: 28,
                marginBottom: 10
              }}
            >
              {article.label || article.title}
            </Text>

            {/* מקור ותאריך - מתחת לכותרת */}
            <Text 
              style={{ 
                fontSize: 12,
                color: DesignTokens.colors.text.secondary,
                fontWeight: '500',
                textAlign: 'right',
                marginBottom: 16
              }}
            >
              {article.source || 'חדשה'} • {formatNewsDate(article.published_at)}
            </Text>

            {/* תוכן הכתבה */}
            <Text 
              style={{ 
                fontSize: 15,
                lineHeight: 23,
                color: DesignTokens.colors.text.secondary,
                textAlign: 'right',
                marginBottom: 20
              }}
            >
              {article.content || article.summary}
            </Text>

            {/* כפתורי פעולה - אופקיים, ממורכזים, ממלאים את הרוחב */}
            <View style={{ 
              flexDirection: 'row',
              gap: 12,
              marginTop: 8,
              marginBottom: 20,
            }}>
              {/* לייק */}
              <TouchableOpacity 
                style={{ 
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 24,
                  backgroundColor: isLiked ? 'rgba(255, 59, 92, 0.7)' : DesignTokens.colors.background.tertiary,
                  shadowColor: isLiked ? '#FF3B5C' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: isLiked ? 0.2 : 0,
                  shadowRadius: 2,
                  elevation: isLiked ? 2 : 0,
                }}
                onPress={() => {
                  if (!article?.id) return;
                  onLike(article);
                  // עדכון ה-count אחרי לחיצה
                  LikedArticlesService.getArticleLikeCount(article.id).then(count => {
                    setLikeCount(count);
                  }).catch(() => {});
                }}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={18} 
                  color={isLiked ? "#FFF" : DesignTokens.colors.text.secondary}
                  style={{ marginRight: 8 }}
                />
                <Text 
                  style={{ 
                    fontSize: 14,
                    fontWeight: '600',
                    color: isLiked ? "#FFF" : DesignTokens.colors.text.secondary
                  }}
                >
                  {isLiked ? 'שמור' : 'שמור למועדפים'}
                </Text>
                {likeCount > 0 && (
                  <Text style={{
                    fontSize: 12,
                    fontWeight: '600',
                    color: isLiked ? "#FFF" : DesignTokens.colors.text.secondary,
                    marginRight: 6,
                  }}>
                    ({likeCount})
                  </Text>
                )}
              </TouchableOpacity>

              {/* שיתוף */}
              <TouchableOpacity 
                style={{ 
                  flex: 1,
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingVertical: 12,
                  paddingHorizontal: 16,
                  borderRadius: 24,
                  backgroundColor: DesignTokens.colors.background.tertiary,
                }}
                onPress={() => onShare(article)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name="share-outline" 
                  size={18} 
                  color={DesignTokens.colors.text.secondary}
                  style={{ marginRight: 8 }}
                />
                <Text 
                  style={{ 
                    fontSize: 14,
                    fontWeight: '600',
                    color: DesignTokens.colors.text.secondary
                  }}
                >
                  שתף
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </BottomSheet>
  );
};

const BreakingNewsCard: React.FC<NewsCardProps> = ({ article, onPress, onLike, onShare, isLiked }) => {
  const DesignTokens = useDesignTokens();
  const categoryColor = getNewsCategoryColor(article.category);
  const categoryIcon = getNewsCategoryIcon(article.category);

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
  const thumbnailHeight = 200;

  return (
    <UICard
      variant="elevated"
      padding="none"
      onPress={() => onPress(article)}
      style={{
        marginHorizontal: DesignTokens.layout?.screenPadding ?? 20,
        marginBottom: 0,
        borderRadius: DesignTokens.borderRadius.lg,
        overflow: 'hidden',
      }}
    >
      {/* Thumbnail + גרדיאנט רגיל לקריאת כותרת על התמונה */}
      <View style={{ height: thumbnailHeight, width: '100%', position: 'relative' }}>
        {hasImage ? (
          <>
            <Image
              source={{ uri: article.image_url }}
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
            {/* כותרת על ה-gradient */}
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
                {article.label || article.title}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: 4,
                  textAlign: 'right',
                }}
              >
                {article.source} • {formatNewsDate(article.published_at)}
              </Text>
            </View>
          </>
        ) : (
          <View
            style={{
              flex: 1,
              backgroundColor: DesignTokens.colors.background.tertiary,
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            <Ionicons
              name={isTwitterPost ? 'logo-twitter' : 'newspaper-outline'}
              size={48}
              color={DesignTokens.colors.text.tertiary}
            />
            <Text
              style={{
                fontSize: 17,
                fontWeight: '600',
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                marginTop: 12,
                marginHorizontal: 16,
              }}
              numberOfLines={2}
            >
              {article.label || article.title}
            </Text>
          </View>
        )}
      </View>

      {/* תוכן מתחת לתמונה */}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: 16,
        }}
      >
        {/* אם יש תמונה - הכותרת כבר מעל, מציגים רק summary */}
        {hasImage && (article.label ? article.title : article.summary) && (
          <Text
            style={{
              fontSize: 14,
              color: DesignTokens.colors.text.secondary,
              textAlign: 'right',
              lineHeight: 20,
              marginBottom: 12,
            }}
            numberOfLines={2}
          >
            {truncateText(article.label ? article.title : article.summary || '', 80)}
          </Text>
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* כפתורי פעולה */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: isLiked ? 'rgba(255, 59, 92, 0.15)' : 'rgba(255,255,255,0.06)',
              }}
              onPress={() => onLike(article)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={18}
                color={isLiked ? '#FF3B5C' : DesignTokens.colors.text.secondary}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.06)',
              }}
              onPress={handleSharePress}
            >
              <Ionicons name="share-outline" size={18} color={DesignTokens.colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* מקור וזמן - אם אין תמונה */}
          {!hasImage && (
            <Text
              style={{
                fontSize: 12,
                color: DesignTokens.colors.text.tertiary,
              }}
            >
              {article.source} • {formatNewsDate(article.published_at)}
            </Text>
          )}
        </View>

        {/* קטגוריה */}
        {article.category && article.category !== 'כללי' && (
          <View
            style={{
              marginTop: 10,
              alignSelf: 'flex-end',
              backgroundColor: categoryColor + '25',
              paddingHorizontal: 10,
              paddingVertical: 4,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontSize: 12, fontWeight: '500', color: categoryColor }}>
              {article.category}
            </Text>
          </View>
        )}
      </View>
    </UICard>
  );
};

export default function BreakingNewsTab() {
  const DesignTokens = useDesignTokens();
  const mainTabsHeight = useMainTabsHeight();
  const [articles, setArticles] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
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
        // הסרת אהבתי
        newLikedArticles.delete(articleId);
        setLikedArticles(newLikedArticles);
        
        // שמירה במסד הנתונים
        const success = await LikedArticlesService.unlikeArticle(articleId);
        if (!success) {
          // אם נכשל, החזר את המצב
          newLikedArticles.add(articleId);
          setLikedArticles(newLikedArticles);
          Alert.alert('שגיאה', 'לא ניתן להסיר את האהבתי');
        }
      } else {
        // הוספת אהבתי
        newLikedArticles.add(articleId);
        setLikedArticles(newLikedArticles);
        
        // שמירה במסד הנתונים
        const success = await LikedArticlesService.likeArticle(article);
        if (!success) {
          // אם נכשל, החזר את המצב
          newLikedArticles.delete(articleId);
          setLikedArticles(newLikedArticles);
          Alert.alert('שגיאה', 'לא ניתן להוסיף אהבתי');
        }
      }
      
    } catch (error) {
      Alert.alert('שגיאה', 'בעיה בשמירת האהבתי');
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
    } catch (error) {
      Alert.alert('שגיאה', 'לא ניתן לטעון את החדשות המתפרצות');
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
    const subscription = supabase
      .channel('app_news_clean_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_news_clean'
        },
        (payload) => {
          // המרת הנתונים לפורמט NewsArticle עם מיפוי גמיש
          const row = payload.new;
          
          const newArticle: NewsArticle = {
            id: row.id || row.uuid || row.tweet_id || String(Date.now()),
            label: row.label || '',
            title: row.text_content || row.title || row.headline || row.subject || row.name || 
                   row.tweet_text || row.text || row.content || 'כתבה חדשה',
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
            published_at: row.time || row.published_at || row.created_at || row.date || row.timestamp || row.posted_at || new Date().toISOString(),
            created_at: row.time || row.created_at || row.date || row.timestamp || new Date().toISOString(),
            updated_at: row.updated_at || row.modified_at || null,
            category: row.category || row.type || row.topic || 
                     row.section || row.tag || 'כללי',
            tags: row.tags || row.hashtags || [],
            is_featured: row.is_featured || row.featured || false,
            view_count: row.view_count || row.views || row.retweet_count || 0,
            sentiment: row.sentiment || row.mood || 'neutral',
            relevance_score: row.relevance_score || row.score || 0,
            reading_time: row.reading_time || row.read_time || 1
          };
          
          // הוספת הכתבה החדשה לתחילת הרשימה
          setArticles(prev => [newArticle, ...prev.slice(0, 49)]);
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // רענון
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      loadBreakingNews(),
      loadLikedArticles()
    ]);
    setRefreshing(false);
  }, [loadBreakingNews, loadLikedArticles]);

  // בחירת כתבה - פתיחת מודל מפורט
  const handleArticlePress = useCallback((article: NewsArticle) => {
    const index = articles.findIndex(a => a.id === article.id);
    setSelectedArticle(article);
    setSelectedArticleIndex(index >= 0 ? index : 0);
    setDetailModalVisible(true);
  }, [articles]);

  // ניווט לחדשה הבאה
  const handleNextArticle = useCallback(() => {
    if (selectedArticleIndex < articles.length - 1) {
      const nextIndex = selectedArticleIndex + 1;
      setSelectedArticleIndex(nextIndex);
      setSelectedArticle(articles[nextIndex]);
    }
  }, [selectedArticleIndex, articles]);

  // ניווט לחדשה הקודמת
  const handlePreviousArticle = useCallback(() => {
    if (selectedArticleIndex > 0) {
      const prevIndex = selectedArticleIndex - 1;
      setSelectedArticleIndex(prevIndex);
      setSelectedArticle(articles[prevIndex]);
    }
  }, [selectedArticleIndex, articles]);

  // סגירת מודל מפורט
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedArticle(null);
    setSelectedArticleIndex(0);
  }, []);

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
      Alert.alert('שגיאה', 'לא ניתן לשתף את הכתבה');
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
  const renderEmptyState = () => (
    <View className="flex-1 justify-center items-center px-8 py-16">
      <Ionicons 
        name="newspaper-outline" 
        size={48} 
        color={DesignTokens.colors.text.tertiary} 
      />
      <Text 
        className="text-lg font-semibold mt-4 text-center"
        style={{ color: DesignTokens.colors.text.primary }}
      >
        אין חדשות כרגע
      </Text>
      <Text 
        className="text-sm mt-2 text-center"
        style={{ color: DesignTokens.colors.text.secondary }}
      >
        החדשות המתפרצות יופיעו כאן
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32 }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text 
          className="mt-4 text-base"
          style={{ color: DesignTokens.colors.text.secondary }}
        >
          טוען חדשות...
        </Text>
      </View>
    );
  }

  if (articles.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32, paddingVertical: 32 }}>
        <Ionicons 
          name="newspaper-outline" 
          size={48} 
          color={DesignTokens.colors.text.tertiary} 
        />
        <Text 
          className="text-lg font-semibold mt-4 text-center"
          style={{ color: DesignTokens.colors.text.primary }}
        >
          אין חדשות כרגע
        </Text>
        <Text 
          className="text-sm mt-2 text-center"
          style={{ color: DesignTokens.colors.text.secondary }}
        >
          החדשות המתפרצות יופיעו כאן
        </Text>
        <Pressable
          onPress={loadBreakingNews}
          className="mt-6 px-6 py-3 rounded-full"
          style={{ backgroundColor: DesignTokens.colors.primary.main }}
        >
          <Text 
            className="text-sm font-medium"
            style={{ color: DesignTokens.colors.text.primary }}
          >
            רענן
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1, marginBottom: mainTabsHeight - 12 }}>
        <FlatList
          data={articles}
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
          showsVerticalScrollIndicator={false}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        />
      </View>
      
      {/* מודל מפורט לחדשות */}
      {detailModalVisible && selectedArticle && (
        <NewsDetailModal
          visible={detailModalVisible}
          article={selectedArticle}
          isLiked={likedArticles.has(selectedArticle.id)}
          onClose={handleCloseDetailModal}
          onLike={handleLike}
          onShare={handleShareFromModal}
          currentIndex={selectedArticleIndex}
          totalArticles={articles.length}
          onNext={handleNextArticle}
          onPrevious={handlePreviousArticle}
        />
      )}

      {/* מודל שיתוף - העברת חדשה לקבוצות צ'אט */}
      <ShareModal
        article={shareArticle}
        onClose={handleShareClose}
        visible={shareModalVisible}
      />

    </View>
  );
}
