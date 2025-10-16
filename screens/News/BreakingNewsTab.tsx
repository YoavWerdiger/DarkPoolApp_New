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
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BottomSheetModal, BottomSheetBackdrop, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../services/supabase';
import { 
  newsService, 
  NewsArticle, 
  formatNewsDate,
  truncateText,
  getNewsCategoryColor,
  getNewsCategoryIcon
} from '../../services/newsService';
import { LikedArticlesService } from '../../services/likedArticlesService';

interface NewsCardProps {
  article: NewsArticle;
  onPress: (article: NewsArticle) => void;
  onLike: (article: NewsArticle) => void;
  isLiked: boolean;
}

interface ShareModalProps {
  article: NewsArticle | null;
  onClose: () => void;
  bottomSheetRef: React.RefObject<BottomSheetModal | null>;
}

const ShareModal: React.FC<ShareModalProps> = ({ article, onClose, bottomSheetRef }) => {
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  
  // הגדרת snap points
  const snapPoints = useMemo(() => ['70%', '90%'], []);
  
  // רינדור backdrop
  const renderBackdrop = useCallback(
    (props: any) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  // טעינת קבוצות הצ'אט כשהבוטום שיט נפתח
  useEffect(() => {
    if (article) {
      loadChatGroups();
    }
  }, [article]);

  const debugDatabase = async () => {
    try {
      console.log('🔍 DEBUG: Checking database structure...');
      
      // בדיקת טבלת channel_members
      const { data: membersTest, error: membersError } = await supabase
        .from('channel_members')
        .select('*')
        .limit(1);
      
      console.log('📋 DEBUG: channel_members test:', { membersTest, membersError });
      
      // בדיקת טבלת channels
      const { data: channelsTest, error: channelsError } = await supabase
        .from('channels')
        .select('id, name, image_url, is_private, created_by')
        .limit(1);
      
      console.log('📢 DEBUG: channels test:', { channelsTest, channelsError });
      
      // בדיקת המשתמש הנוכחי
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 DEBUG: current user:', { user: user?.id, userError });
      
    } catch (error) {
      console.error('❌ DEBUG: Database check failed:', error);
    }
  };

  const loadChatGroups = async () => {
    setLoading(true);
    try {
      console.log('🔄 ShareModal: Starting to load chat groups...');
      
      // קבלת המשתמש הנוכחי
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('👤 ShareModal: Current user:', user?.id, 'Error:', userError);
      
      if (!user) {
        console.log('❌ ShareModal: No user found');
        Alert.alert('שגיאה', 'משתמש לא מחובר');
        return;
      }

      // קבלת קבוצות הצ'אט של המשתמש
      console.log('🔍 ShareModal: Fetching channel members for user:', user.id);
      const { data: memberRows, error: memberError } = await supabase
        .from('channel_members')
        .select('channel_id')
        .eq('user_id', user.id);

      console.log('👥 ShareModal: Channel members result:', {
        memberRows,
        memberError,
        count: memberRows?.length || 0
      });

      if (memberError) {
        console.error('❌ ShareModal: Error fetching channel members:', memberError);
        Alert.alert('שגיאה', `לא ניתן לטעון קבוצות: ${memberError.message}`);
        return;
      }

      const channelIds = memberRows?.map(row => row.channel_id) || [];
      console.log('📋 ShareModal: Channel IDs:', channelIds);

      if (channelIds.length > 0) {
        console.log('🔍 ShareModal: Fetching channels data...');
        const { data: channels, error: channelsError } = await supabase
          .from('channels')
          .select('id, name, image_url')
          .in('id', channelIds)
          .order('name');

        console.log('📢 ShareModal: Channels result:', {
          channels,
          channelsError,
          count: channels?.length || 0
        });

        if (channelsError) {
          console.error('❌ ShareModal: Error fetching channels:', channelsError);
          Alert.alert('שגיאה', `לא ניתן לטעון פרטי קבוצות: ${channelsError.message}`);
          return;
        }

        console.log('✅ ShareModal: Successfully loaded channels:', channels);
        setChatGroups(channels || []);
      } else {
        console.log('⚠️ ShareModal: User is not a member of any channels, trying alternative approach...');
        
        // נסיון חלופי - לטעון את כל הערוצים הפומביים
        console.log('🔄 ShareModal: Trying to load all public channels...');
        const { data: publicChannels, error: publicError } = await supabase
          .from('channels')
          .select('id, name, image_url')
          .eq('is_private', false)
          .order('name')
          .limit(10);

        console.log('🌐 ShareModal: Public channels result:', {
          publicChannels,
          publicError,
          count: publicChannels?.length || 0
        });

        if (!publicError && publicChannels && publicChannels.length > 0) {
          console.log('✅ ShareModal: Found public channels, using them as fallback');
          setChatGroups(publicChannels);
        } else {
          console.log('❌ ShareModal: No public channels found either');
          setChatGroups([]);
        }
      }
    } catch (error) {
      console.error('❌ ShareModal: Exception loading chat groups:', error);
      Alert.alert('שגיאה', 'שגיאה בטעינת קבוצות');
    } finally {
      setLoading(false);
      console.log('🏁 ShareModal: Finished loading chat groups');
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
        console.error('Error sharing news to group:', error);
        Alert.alert('שגיאה', 'לא ניתן לשתף לקבוצה');
        return;
      }

      Alert.alert('הצלחה', `החדשה שותפה לקבוצה "${groupName}"`);
      onClose();
    } catch (error) {
      console.error('Error sharing news to group:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף לקבוצה');
    }
  };

  if (!article) return null;

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      index={0}
      snapPoints={snapPoints}
      enablePanDownToClose
      onDismiss={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: '#1C1C1E' }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.3)', width: 40 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      >
        {/* כותרת */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, paddingTop: 8 }}>
          <Text 
            style={{ fontSize: 24, fontWeight: '700', color: '#FFFFFF' }}
          >
            שתף לקבוצה
          </Text>
          <TouchableOpacity 
            onPress={onClose}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: 'rgba(255,255,255,0.08)',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Ionicons 
              name="close" 
              size={20} 
              color="#FFFFFF" 
            />
          </TouchableOpacity>
        </View>

        {/* תצוגה מקדימה של החדשה */}
        <View 
          style={{
            padding: 16,
            borderRadius: 16,
            backgroundColor: 'rgba(255,255,255,0.06)',
            marginBottom: 24,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.08)'
          }}
        >
          <Text 
            style={{ 
              fontSize: 16, 
              fontWeight: '600', 
              color: '#FFFFFF', 
              textAlign: 'right',
              marginBottom: 8
            }}
            numberOfLines={2}
          >
            {article.label || article.title}
          </Text>
          <Text 
            style={{ 
              fontSize: 14, 
              color: '#999999', 
              textAlign: 'right',
              marginBottom: 8,
              lineHeight: 20
            }}
            numberOfLines={2}
          >
            {article.label ? article.title : article.summary}
          </Text>
          <Text 
            style={{ 
              fontSize: 12, 
              color: '#666666', 
              textAlign: 'right' 
            }}
          >
            מאת: {article.source}
          </Text>
        </View>

        {/* רשימת קבוצות */}
        {loading ? (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <ActivityIndicator size="large" color="#00E654" />
            <Text 
              style={{ fontSize: 14, color: '#999999', marginTop: 16 }}
            >
              טוען קבוצות...
            </Text>
          </View>
        ) : chatGroups.length > 0 ? (
          <View>
            <Text 
              style={{ 
                fontSize: 18, 
                fontWeight: '600', 
                color: '#FFFFFF', 
                textAlign: 'right',
                marginBottom: 16
              }}
            >
              בחר קבוצה:
            </Text>
            {chatGroups.map((group) => (
              <TouchableOpacity
                key={group.id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 16,
                  backgroundColor: 'rgba(255,255,255,0.06)',
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.08)'
                }}
                onPress={() => shareToGroup(group.id, group.name)}
              >
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text 
                    style={{ 
                      fontSize: 16, 
                      fontWeight: '600', 
                      color: '#FFFFFF', 
                      textAlign: 'right',
                      marginBottom: 4
                    }}
                  >
                    {group.name}
                  </Text>
                  <Text 
                    style={{ 
                      fontSize: 13, 
                      color: '#666666', 
                      textAlign: 'right' 
                    }}
                  >
                    קבוצת צ'אט
                  </Text>
                </View>
                <View 
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: 'rgba(0, 230, 84, 0.1)',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {group.image_url ? (
                    <Image 
                      source={{ uri: group.image_url }}
                      style={{ width: 48, height: 48, borderRadius: 24 }}
                    />
                  ) : (
                    <Ionicons 
                      name="people" 
                      size={24} 
                      color="#00E654" 
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <View style={{ alignItems: 'center', paddingVertical: 32 }}>
            <Ionicons 
              name="chatbubbles-outline" 
              size={64} 
              color="#666666" 
            />
            <Text 
              style={{ 
                fontSize: 18, 
                fontWeight: '600', 
                color: '#FFFFFF', 
                marginTop: 16 
              }}
            >
              אין קבוצות זמינות
            </Text>
            <Text 
              style={{ 
                fontSize: 14, 
                color: '#999999', 
                marginTop: 8, 
                textAlign: 'center',
                marginBottom: 16
              }}
            >
              הצטרף לקבוצות כדי לשתף חדשות
            </Text>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 24,
                  backgroundColor: '#00E654'
                }}
                onPress={loadChatGroups}
              >
                <Text 
                  style={{ 
                    fontSize: 14, 
                    fontWeight: '600', 
                    color: '#FFFFFF' 
                  }}
                >
                  נסה שוב
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingHorizontal: 24,
                  paddingVertical: 12,
                  borderRadius: 24,
                  backgroundColor: 'rgba(255, 255, 255, 0.08)'
                }}
                onPress={debugDatabase}
              >
                <Text 
                  style={{ 
                    fontSize: 14, 
                    fontWeight: '600', 
                    color: '#999999' 
                  }}
                >
                  בדיקה
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
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
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
        {/* כותרת */}
        <View className="flex-row items-center justify-between p-4 border-b" style={{ borderBottomColor: 'rgba(255, 255, 255, 0.1)' }}>
          <TouchableOpacity onPress={onClose}>
            <Ionicons 
              name="close" 
              size={24} 
              color={DesignTokens.colors.text.primary} 
            />
          </TouchableOpacity>
          <Text 
            className="text-lg font-semibold"
            style={{ color: DesignTokens.colors.text.primary }}
          >
            {article.source ? `חדשה מאת ${article.source}` : 'חדשה'}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}>
          {/* תמונה */}
          {article.image_url && (
            <View className="w-full" style={{ height: 280 }}>
              <Image
                source={{ uri: article.image_url }}
                className="w-full h-full"
                resizeMode="cover"
                style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
              />
            </View>
          )}

          {/* תוכן */}
          <View className="p-4" style={{ paddingTop: 20 }}>
            {/* כותרת - label אם קיים */}
            <Text 
              className="text-xl font-bold mb-3 leading-7"
              style={{ 
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}
            >
              {article.label || article.title}
            </Text>

            {/* מפרסם ותאריך */}
            <View className="flex-row items-center justify-end mb-4">
              <Text 
                className="text-sm"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                {formatNewsDate(article.published_at)}
              </Text>
              <Text 
                className="text-sm mx-2"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                •
              </Text>
              <Text 
                className="text-sm font-medium"
                style={{ color: DesignTokens.colors.text.secondary }}
              >
                {article.source}
              </Text>
            </View>

            {/* תוכן הכתבה */}
            <Text 
              className="text-base leading-6 mb-5"
              style={{ 
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}
            >
              {article.content || article.summary}
            </Text>

            {/* קטגוריה אם קיימת */}
            {article.category && article.category !== 'כללי' && (
              <View 
                className="px-3 py-1.5 rounded-full self-end"
                style={{ backgroundColor: categoryColor + '20' }}
              >
                <Text 
                  className="text-sm font-semibold"
                  style={{ color: categoryColor }}
                >
                  {article.category}
                </Text>
              </View>
            )}
          </View>
        </ScrollView>

        {/* כפתורי פעולה מעל הקו */}
        <View 
          style={{ 
            position: 'absolute',
            bottom: 90,
            left: 0,
            right: 0,
            marginBottom: 50,
            paddingHorizontal: 16
          }}
        >
          <View className="flex-row items-center justify-center" style={{ gap: 12 }}>
            {/* לייק */}
            <TouchableOpacity 
              className="flex-row items-center px-6 py-3 rounded-full"
              style={{ 
                backgroundColor: isLiked 
                  ? 'rgba(255, 59, 92, 0.15)' 
                  : 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: isLiked 
                  ? 'rgba(255, 59, 92, 0.3)' 
                  : 'rgba(255, 255, 255, 0.08)'
              }}
              onPress={() => onLike(article)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name={isLiked ? "heart" : "heart-outline"} 
                size={20} 
                color={isLiked ? "#FF3B5C" : DesignTokens.colors.text.tertiary}
                style={{ marginRight: 8 }}
              />
              <Text 
                className="text-base font-medium"
                style={{ color: isLiked ? "#FF3B5C" : DesignTokens.colors.text.tertiary }}
              >
                {isLiked ? 'אהבתי' : 'לייק'}
              </Text>
            </TouchableOpacity>

            {/* שיתוף */}
            <TouchableOpacity 
              className="flex-row items-center px-6 py-3 rounded-full"
              style={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)'
              }}
              onPress={() => onShare(article)}
              activeOpacity={0.7}
            >
              <Ionicons 
                name="share-outline" 
                size={20} 
                color={DesignTokens.colors.text.tertiary}
                style={{ marginRight: 8 }}
              />
              <Text 
                className="text-base font-medium"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                שיתוף
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* כפתורי ניווט בתחתית המסך */}
        <View 
          style={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: DesignTokens.colors.background.primary,
            borderTopWidth: 1,
            borderTopColor: 'rgba(255, 255, 255, 0.1)',
            paddingHorizontal: 16,
            paddingTop: 16,
            paddingBottom: 24
          }}
        >

          {/* ניווט בין חדשות */}
          {onNext && onPrevious && currentIndex !== undefined && totalArticles !== undefined && (
            <View className="flex-row items-center justify-center" style={{ gap: 16 }}>
              {/* חדשה הבאה - שמאל */}
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center rounded-full"
                style={{ 
                  backgroundColor: currentIndex < totalArticles - 1 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(255, 255, 255, 0.02)',
                  borderWidth: 1,
                  borderColor: currentIndex < totalArticles - 1 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  maxWidth: 160,
                  paddingVertical: 14
                }}
                onPress={onNext}
                disabled={currentIndex >= totalArticles - 1}
              >
                <Ionicons 
                  name="chevron-back-outline" 
                  size={22} 
                  color={DesignTokens.colors.text.tertiary}
                  style={{ marginRight: 8 }}
                />
                <Text 
                  className="text-base font-semibold"
                  style={{ color: DesignTokens.colors.text.tertiary }}
                >
                  הבאה
                </Text>
              </TouchableOpacity>

              {/* חדשה קודמת - ימין */}
              <TouchableOpacity 
                className="flex-1 flex-row items-center justify-center rounded-full"
                style={{ 
                  backgroundColor: currentIndex > 0 
                    ? 'rgba(255, 255, 255, 0.05)' 
                    : 'rgba(255, 255, 255, 0.02)',
                  borderWidth: 1,
                  borderColor: currentIndex > 0 
                    ? 'rgba(255, 255, 255, 0.1)' 
                    : 'rgba(255, 255, 255, 0.05)',
                  maxWidth: 160,
                  paddingVertical: 14
                }}
                onPress={onPrevious}
                disabled={currentIndex === 0}
              >
                <Text 
                  className="text-base font-semibold"
                  style={{ color: DesignTokens.colors.text.tertiary }}
                >
                  קודמת
                </Text>
                <Ionicons 
                  name="chevron-forward-outline" 
                  size={22} 
                  color={DesignTokens.colors.text.tertiary}
                  style={{ marginLeft: 8 }}
                />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const BreakingNewsCard: React.FC<NewsCardProps> = ({ article, onPress, onLike, isLiked }) => {
  const shareBottomSheetRef = useRef<BottomSheetModal | null>(null);
  const categoryColor = getNewsCategoryColor(article.category);
  const categoryIcon = getNewsCategoryIcon(article.category);
  
  const handleSharePress = () => {
    console.log('🔗 Share button pressed, opening bottom sheet...');
    shareBottomSheetRef.current?.present();
  };
  
  const handleShareClose = () => {
    console.log('🔗 Closing bottom sheet...');
    shareBottomSheetRef.current?.dismiss();
  };
  
  // זיהוי אם זה טוויטר או חדשה רגילה
  const isTwitterPost = article.source === 'Twitter' || 
                       article.source === 'Bloomberg' || 
                       article.source === 'Reuters' ||
                       article.source === 'CNN' ||
                       article.source === 'BBC' ||
                       article.source === 'טוויטר' ||
                       article.url?.includes('twitter.com') ||
                       article.source_url?.includes('twitter.com') ||
                       article.id?.length > 15; // טוויטר IDs ארוכים

  return (
    <Pressable
      onPress={() => onPress(article)}
      className="mx-4 py-4"
      style={{
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        paddingBottom: 16,
        marginBottom: 8
      }}
    >
      <View className="flex-row items-start">
        {/* תמונה קטנה */}
        <View className="w-16 h-16 rounded-lg overflow-hidden mr-4 flex-shrink-0">
          {article.image_url ? (
            <Image
              source={{ uri: article.image_url }}
              className="w-full h-full"
              resizeMode="cover"
              style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
            />
          ) : (
            <View 
              className="w-full h-full items-center justify-center"
              style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
            >
              <Ionicons 
                name={isTwitterPost ? "logo-twitter" : "newspaper-outline"} 
                size={24} 
                color={DesignTokens.colors.text.tertiary} 
              />
            </View>
          )}
        </View>

        {/* תוכן */}
        <View className="flex-1">
          {/* כותרת - מציג label אם קיים, אחרת title */}
          <Text 
            className="text-base font-semibold leading-5 mb-2"
            style={{ 
              color: DesignTokens.colors.text.primary,
              textAlign: 'right',
              writingDirection: 'rtl'
            }}
            numberOfLines={2}
          >
            {article.label || article.title}
          </Text>

          {/* תוכן/תיאור - מציג title אם יש label, אחרת summary */}
          {(article.label ? article.title : article.summary) && (
            <Text 
              className="text-sm leading-4 mb-3"
              style={{ 
                color: DesignTokens.colors.text.secondary,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}
              numberOfLines={2}
            >
              {truncateText(article.label ? article.title : article.summary || '', 100)}
            </Text>
          )}

          {/* מידע תחתון */}
          <View className="flex-row items-center justify-between">
            {/* כפתורי פעולה - בצד שמאל */}
            <View className="flex-row items-center">
              {/* לייק */}
              <TouchableOpacity 
                style={{ 
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                
                  justifyContent: 'center',
                  backgroundColor: isLiked 
                    ? 'rgba(255, 59, 92, 0.15)' 
                    : 'transparent',
                  marginRight: 5
                }}
                onPress={() => onLike(article)}
                activeOpacity={0.7}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={16} 
                  color={isLiked ? "#FF3B5C" : DesignTokens.colors.text.secondary} 
                />
              </TouchableOpacity>

              {/* שיתוף */}
              <TouchableOpacity 
                style={{ 
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'transparent'
                }}
                onPress={handleSharePress}
              >
                <Ionicons 
                  name="share-outline" 
                  size={16} 
                  color={DesignTokens.colors.text.secondary} 
                />
              </TouchableOpacity>
            </View>

            {/* מקור וזמן - בצד ימין */}
            <View className="flex-row items-center">
              {/* זמן */}
              <Text 
                className="text-xs"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                {formatNewsDate(article.published_at)}
              </Text>
              
              {/* נקודת הפרדה */}
              <Text 
                className="text-xs mx-2"
                style={{ color: DesignTokens.colors.text.tertiary }}
              >
                •
              </Text>
              
              {/* מקור */}
              <Text 
                className="text-xs font-medium mr-3"
                style={{ color: DesignTokens.colors.text.secondary }}
              >
                {article.source}
              </Text>
            </View>
          </View>

          {/* קטגוריה אם קיימת */}
          {article.category && article.category !== 'כללי' && (
            <View 
              className="px-2 py-1 rounded-full self-start mt-2"
              style={{ backgroundColor: categoryColor + '20' }}
            >
              <Text 
                className="text-xs font-medium"
                style={{ color: categoryColor }}
              >
                {article.category}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* מודל שיתוף */}
      <ShareModal
        article={article}
        onClose={handleShareClose}
        bottomSheetRef={shareBottomSheetRef}
      />
    </Pressable>
  );
};

export default function BreakingNewsTab() {
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

  // טעינת החדשות שאהב המשתמש
  const loadLikedArticles = useCallback(async () => {
    try {
      const likedIds = await LikedArticlesService.getLikedArticleIds();
      setLikedArticles(new Set(likedIds));
      console.log(`✅ BreakingNewsTab: Loaded ${likedIds.length} liked articles`);
    } catch (error) {
      console.error('❌ BreakingNewsTab: Error loading liked articles:', error);
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
      console.error('❌ Error handling like:', error);
      Alert.alert('שגיאה', 'בעיה בשמירת האהבתי');
    }
  }, [likedArticles]);

  // טעינת חדשות מתפרצות
  const loadBreakingNews = useCallback(async () => {
    try {
      console.log('⚡ BreakingNewsTab: Loading breaking news');
      console.log('🔗 BreakingNewsTab: Supabase client:', supabase);
      
      // חיבור ישיר לטבלת app_news
      console.log('🔍 BreakingNewsTab: Attempting to fetch from app_news table...');
      
      // נסה קודם לבדוק אם הטבלה קיימת
      const { data: testData, error: testError } = await supabase
        .from('app_news')
        .select('count')
        .limit(1);
      
      console.log('🧪 BreakingNewsTab: Table test result:', { testData, testError });
      
      // עכשיו נשלוף את הנתונים (ללא מגבלה - יציג את כל החדשות)
      const { data, error } = await supabase
        .from('app_news')
        .select('*')
        .order('id', { ascending: false });
      
      console.log('📊 BreakingNewsTab: Raw database response:', { data, error });
      
      // אם יש נתונים, נבדוק את המבנה
      if (data && data.length > 0) {
        console.log('🔍 BreakingNewsTab: First row structure:', data[0]);
        console.log('🔍 BreakingNewsTab: Available columns:', Object.keys(data[0]));
      }

      if (error) {
        console.error('❌ BreakingNewsTab: Database error:', error);
        console.error('❌ Error details:', error.message, error.code);
        console.error('❌ Full error object:', error);
        
        // ננסה טבלות אחרות
        console.log('🔄 BreakingNewsTab: Trying alternative table names...');
        
        const alternativeTables = ['news', 'articles', 'tweets', 'posts', 'messages'];
        let foundData = null;
        
        for (const tableName of alternativeTables) {
          try {
            console.log(`🔍 BreakingNewsTab: Trying table: ${tableName}`);
            const { data: altData, error: altError } = await supabase
              .from(tableName)
              .select('*')
              .limit(10);
            
            if (!altError && altData && altData.length > 0) {
              console.log(`✅ BreakingNewsTab: Found data in table: ${tableName}`);
              foundData = altData;
              break;
            }
          } catch (altErr) {
            console.log(`❌ BreakingNewsTab: Table ${tableName} failed:`, altErr);
          }
        }
        
        if (foundData) {
          // נשתמש בנתונים מהטבלה החלופית
          console.log('🔄 BreakingNewsTab: Using alternative table data');
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
          console.log('✅ BreakingNewsTab: Loaded', newsArticles.length, 'articles from alternative table');
          return;
        }
        
        // אם לא מצאנו כלום, נציג רשימה ריקה
        setArticles([]);
        Alert.alert(
          'שגיאה בטעינת חדשות', 
          `לא ניתן לטעון חדשות מהמסד: ${error.message}\n\nנסה לבדוק שהטבלה 'app_news' קיימת.`
        );
        return;
      }

      // בדיקה אם יש נתונים
      if (!data || data.length === 0) {
        console.log('📭 BreakingNewsTab: No news articles found in database');
        setArticles([]);
        return;
      }

      // המרת הנתונים מהמסד לפורמט NewsArticle
      const newsArticles: NewsArticle[] = (data || []).map((row: any, index: number) => {
        console.log(`🔍 BreakingNewsTab: Processing row ${index}:`, row);
        
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
        
        // עיבוד תאריך משופר
        const rawDate = row.time || row.published_at || row.created_at || row.date || row.timestamp || row.posted_at;
        console.log(`🕐 BreakingNewsTab: Raw date for article ${index}:`, {
          rawDate,
          type: typeof rawDate,
          rowKeys: Object.keys(row).filter(key => key.includes('time') || key.includes('date') || key.includes('created') || key.includes('posted'))
        });

        // בדיקת תקינות התאריך
        let validatedDate = rawDate;
        if (rawDate) {
          try {
            const testDate = new Date(rawDate);
            if (isNaN(testDate.getTime()) || testDate.getTime() < 0) {
              console.log(`⚠️ BreakingNewsTab: Invalid date for article ${index}, using current time`);
              validatedDate = new Date().toISOString();
            }
          } catch (error) {
            console.log(`❌ BreakingNewsTab: Error validating date for article ${index}:`, error);
            validatedDate = new Date().toISOString();
          }
        } else {
          validatedDate = new Date().toISOString();
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
        
        console.log(`✅ BreakingNewsTab: Mapped article ${index}:`, {
          ...article,
          published_at_formatted: formatNewsDate(article.published_at)
        });
        return article;
      });

      setArticles(newsArticles);
      console.log('✅ BreakingNewsTab: Loaded', newsArticles.length, 'articles');
      console.log('📊 Sample article data:', newsArticles[0]);
    } catch (error) {
      console.error('❌ BreakingNewsTab: Error loading breaking news:', error);
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
    console.log('🔄 BreakingNewsTab: Setting up realtime subscription');
    
    const subscription = supabase
      .channel('app_news_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_news'
        },
        (payload) => {
          console.log('⚡ BreakingNewsTab: New article received via realtime:', payload.new);
          
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
      console.log('🔄 BreakingNewsTab: Unsubscribing from realtime');
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
    console.log('⚡ BreakingNewsTab: Article pressed:', article.title);
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
      console.error('❌ BreakingNewsTab: Error sharing:', error);
      Alert.alert('שגיאה', 'לא ניתן לשתף את הכתבה');
    }
  }, []);

  // רינדור כתבה
  const renderArticle = ({ item }: { item: NewsArticle }) => (
    <BreakingNewsCard
      article={item}
      onPress={handleArticlePress}
      onLike={handleLike}
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
      <View className="flex-1 justify-center items-center py-16">
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
        <Pressable
          onPress={loadBreakingNews}
          className="mt-6 px-6 py-3 rounded-full"
          style={{ backgroundColor: DesignTokens.colors.primary.main }}
        >
          <Text 
            className="text-sm font-medium"
            style={{ color: '#FFFFFF' }}
          >
            רענן
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
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
        contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
      
      {/* מודל מפורט לחדשות */}
      <NewsDetailModal
        visible={detailModalVisible}
        article={selectedArticle}
        isLiked={selectedArticle ? likedArticles.has(selectedArticle.id) : false}
        onClose={handleCloseDetailModal}
        onLike={handleLike}
        onShare={handleShareFromModal}
        currentIndex={selectedArticleIndex}
        totalArticles={articles.length}
        onNext={handleNextArticle}
        onPrevious={handlePreviousArticle}
      />

    </View>
  );
}
