import React, { useState, useEffect, useCallback } from 'react';
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
  visible: boolean;
  article: NewsArticle | null;
  onClose: () => void;
}

const ShareModal: React.FC<ShareModalProps> = ({ visible, article, onClose }) => {
  const [chatGroups, setChatGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // טעינת קבוצות הצ'אט
  useEffect(() => {
    if (visible) {
      loadChatGroups();
    }
  }, [visible]);

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
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View 
        className="flex-1 justify-end"
        style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}
      >
        <Pressable className="flex-1" onPress={onClose} />
        
        <View 
          className="rounded-t-3xl p-6"
          style={{ backgroundColor: DesignTokens.colors.background.secondary, maxHeight: '80%' }}
        >
          {/* כותרת */}
          <View className="flex-row items-center justify-between mb-6">
            <Text 
              className="text-xl font-bold"
              style={{ color: DesignTokens.colors.text.primary }}
            >
              שתף לקבוצה
            </Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons 
                name="close" 
                size={24} 
                color={DesignTokens.colors.text.secondary} 
              />
            </TouchableOpacity>
          </View>

          {/* תצוגה מקדימה של החדשה */}
          <View 
            className="p-4 rounded-2xl mb-6"
            style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
          >
            <Text 
              className="text-base font-semibold mb-2"
              style={{ color: DesignTokens.colors.text.primary, textAlign: 'right' }}
              numberOfLines={2}
            >
              {article.title}
            </Text>
            <Text 
              className="text-sm mb-2"
              style={{ color: DesignTokens.colors.text.secondary, textAlign: 'right' }}
              numberOfLines={2}
            >
              {article.summary}
            </Text>
            <Text 
              className="text-xs"
              style={{ color: DesignTokens.colors.text.tertiary, textAlign: 'right' }}
            >
              מאת: {article.source}
            </Text>
          </View>

          {/* רשימת קבוצות */}
          {loading ? (
            <View className="items-center py-8">
              <ActivityIndicator size="large" color="#00D84A" />
              <Text 
                className="text-sm mt-4"
                style={{ color: DesignTokens.colors.text.secondary }}
              >
                טוען קבוצות...
              </Text>
            </View>
          ) : chatGroups.length > 0 ? (
            <ScrollView style={{ maxHeight: 300 }} showsVerticalScrollIndicator={false}>
              <Text 
                className="text-lg font-semibold mb-4"
                style={{ color: DesignTokens.colors.text.primary, textAlign: 'right' }}
              >
                בחר קבוצה:
              </Text>
              {chatGroups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  className="flex-row items-center p-4 rounded-2xl mb-3"
                  style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
                  onPress={() => shareToGroup(group.id, group.name)}
                >
                  <View className="flex-1 ml-4">
                    <Text 
                      className="text-base font-semibold"
                      style={{ color: DesignTokens.colors.text.primary, textAlign: 'right' }}
                    >
                      {group.name}
                    </Text>
                    <Text 
                      className="text-sm mt-1"
                      style={{ color: DesignTokens.colors.text.secondary, textAlign: 'right' }}
                    >
                      קבוצת צ'אט
                    </Text>
                  </View>
                  <View 
                    className="w-12 h-12 rounded-full items-center justify-center"
                    style={{ backgroundColor: '#00D84A20' }}
                  >
                    {group.image_url ? (
                      <Image 
                        source={{ uri: group.image_url }}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <Ionicons 
                        name="people" 
                        size={24} 
                        color="#00D84A" 
                      />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : (
            <View className="items-center py-8">
              <Ionicons 
                name="chatbubbles-outline" 
                size={64} 
                color={DesignTokens.colors.text.tertiary} 
              />
              <Text 
                className="text-lg font-semibold mt-4"
                style={{ color: DesignTokens.colors.text.primary }}
              >
                אין קבוצות זמינות
              </Text>
              <Text 
                className="text-sm mt-2 mb-4 text-center"
                style={{ color: DesignTokens.colors.text.secondary }}
              >
                הצטרף לקבוצות כדי לשתף חדשות
              </Text>
              <View className="flex-row">
                <TouchableOpacity
                  className="px-6 py-3 rounded-full"
                  style={{ backgroundColor: '#00D84A' }}
                  onPress={loadChatGroups}
                >
                  <Text 
                    className="text-sm font-semibold"
                    style={{ color: '#FFFFFF' }}
                  >
                    נסה שוב
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  className="px-6 py-3 rounded-full"
                  style={{ backgroundColor: 'rgba(255, 255, 255, 0.1)', marginLeft: 12 }}
                  onPress={debugDatabase}
                >
                  <Text 
                    className="text-sm font-semibold"
                    style={{ color: DesignTokens.colors.text.secondary }}
                  >
                    בדיקה
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* מרווח תחתון */}
          <View className="h-4" />
        </View>
      </View>
    </Modal>
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
}

const NewsDetailModal: React.FC<NewsDetailModalProps> = ({ 
  visible, 
  article, 
  isLiked, 
  onClose, 
  onLike, 
  onShare 
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

        <ScrollView style={{ flex: 1 }}>
          {/* תמונה גדולה */}
          {article.image_url && (
            <View className="w-full h-64">
              <Image
                source={{ uri: article.image_url }}
                className="w-full h-full"
                resizeMode="cover"
                style={{ backgroundColor: DesignTokens.colors.background.tertiary }}
              />
            </View>
          )}

          {/* תוכן */}
          <View className="p-4">
            {/* כותרת */}
            <Text 
              className="text-xl font-bold mb-3 leading-7"
              style={{ 
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}
            >
              {article.title}
            </Text>

            {/* מידע על הכתבה */}
            <View className="flex-row items-center justify-between mb-4">
              <View className="flex-row items-center">
                <Text 
                  className="text-sm font-medium"
                  style={{ color: DesignTokens.colors.text.secondary }}
                >
                  {article.source}
                </Text>
                <Text 
                  className="text-sm ml-3"
                  style={{ color: DesignTokens.colors.text.tertiary }}
                >
                  {formatNewsDate(article.published_at)}
                </Text>
              </View>

              {/* קטגוריה */}
              {article.category && article.category !== 'כללי' && (
                <View 
                  className="px-3 py-1 rounded-full"
                  style={{ backgroundColor: categoryColor + '20' }}
                >
                  <Text 
                    className="text-sm font-medium"
                    style={{ color: categoryColor }}
                  >
                    {article.category}
                  </Text>
                </View>
              )}
            </View>

            {/* תוכן מלא */}
            <Text 
              className="text-base leading-6 mb-6"
              style={{ 
                color: DesignTokens.colors.text.primary,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}
            >
              {article.content || article.summary}
            </Text>

            {/* כפתורי פעולה */}
            <View className="flex-row items-center justify-center space-x-4">
              {/* לייק */}
              <TouchableOpacity 
                className="flex-row items-center px-6 py-3 rounded-full"
                style={{ 
                  backgroundColor: isLiked 
                    ? 'rgba(255, 59, 92, 0.15)' 
                    : 'rgba(255, 255, 255, 0.05)'
                }}
                onPress={() => onLike(article)}
              >
                <Ionicons 
                  name={isLiked ? "heart" : "heart-outline"} 
                  size={20} 
                  color={isLiked ? "#FF3B5C" : DesignTokens.colors.text.secondary}
                  style={{ marginRight: 8 }}
                />
                <Text 
                  className="text-base font-medium"
                  style={{ color: isLiked ? "#FF3B5C" : DesignTokens.colors.text.secondary }}
                >
                  {isLiked ? 'אהבתי' : 'אהבתי'}
                </Text>
              </TouchableOpacity>

              {/* שיתוף */}
              <TouchableOpacity 
                className="flex-row items-center px-6 py-3 rounded-full"
                style={{ backgroundColor: 'rgba(0, 216, 74, 0.15)' }}
                onPress={() => onShare(article)}
              >
                <Ionicons 
                  name="share-outline" 
                  size={20} 
                  color="#00D84A"
                  style={{ marginRight: 8 }}
                />
                <Text 
                  className="text-base font-medium"
                  style={{ color: '#00D84A' }}
                >
                  שתף
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
};

const BreakingNewsCard: React.FC<NewsCardProps> = ({ article, onPress, onLike, isLiked }) => {
  const [shareModalVisible, setShareModalVisible] = useState(false);
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
          {/* כותרת */}
          <Text 
            className="text-base font-semibold leading-5 mb-2"
            style={{ 
              color: DesignTokens.colors.text.primary,
              textAlign: 'right',
              writingDirection: 'rtl'
            }}
            numberOfLines={2}
          >
            {article.title}
          </Text>

          {/* סיכום - מוגבל ל-2 שורות */}
          {article.summary && (
            <Text 
              className="text-sm leading-4 mb-3"
              style={{ 
                color: DesignTokens.colors.text.secondary,
                textAlign: 'right',
                writingDirection: 'rtl'
              }}
              numberOfLines={2}
            >
              {truncateText(article.summary, 100)}
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
                  marginRight: 8
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
                onPress={() => setShareModalVisible(true)}
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
        visible={shareModalVisible}
        article={article}
        onClose={() => setShareModalVisible(false)}
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
      
      // עכשיו נשלוף את הנתונים
      const { data, error } = await supabase
        .from('app_news')
        .select('*')
        .order('id', { ascending: false })
        .limit(50);
      
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
    setSelectedArticle(article);
    setDetailModalVisible(true);
  }, []);

  // סגירת מודל מפורט
  const handleCloseDetailModal = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedArticle(null);
  }, []);

  // שיתוף מהמודל המפורט
  const handleShareFromModal = useCallback((article: NewsArticle) => {
    // TODO: פתיחת מודל שיתוף
    console.log('Sharing article from modal:', article.title);
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
      />
    </View>
  );
}
