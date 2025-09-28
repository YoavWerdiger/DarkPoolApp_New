import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
  TouchableOpacity,
  Image,
  Pressable
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ArrowRight, Trash2 } from 'lucide-react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { LikedArticlesService, LikedArticle } from '../../services/likedArticlesService';
import { formatNewsDate } from '../../services/newsService';

interface LikedArticleCardProps {
  article: LikedArticle;
  onPress: (article: LikedArticle) => void;
  onUnlike: (article: LikedArticle) => void;
}

const LikedArticleCard: React.FC<LikedArticleCardProps> = ({ article, onPress, onUnlike }) => {
  return (
    <Pressable
      onPress={() => onPress(article)}
      style={{
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: DesignTokens.colors.background.secondary,
        shadowColor: DesignTokens.colors.primary.main,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4
      }}
    >
      {/* תמונה אם קיימת */}
      {article.article_image_url && (
        <View style={{ position: 'relative', height: 120 }}>
          <Image
            source={{ uri: article.article_image_url }}
            style={{ width: '100%', height: '100%' }}
            resizeMode="cover"
          />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.3)', 'rgba(0,0,0,0.7)']}
            locations={[0, 0.6, 1]}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0
            }}
          />
        </View>
      )}

      {/* תוכן */}
      <View style={{ padding: 16 }}>
        <Text 
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            marginBottom: 8,
            lineHeight: 22,
            color: DesignTokens.colors.text.primary,
            textAlign: 'right'
          }}
          numberOfLines={2}
        >
          {article.article_title}
        </Text>

        {/* מידע תחתון */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginTop: 8
        }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 12, 
              color: DesignTokens.colors.text.secondary,
              marginLeft: 8
            }}>
              {article.article_source}
            </Text>
            <Text style={{ 
              fontSize: 12, 
              color: DesignTokens.colors.text.tertiary 
            }}>
              {formatNewsDate(article.article_published_at)}
            </Text>
          </View>
          
          {/* כפתור הסרת אהבתי */}
          <TouchableOpacity 
            style={{ 
              width: 32,
              height: 32,
              borderRadius: 16,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(255, 59, 92, 0.15)'
            }}
            onPress={() => onUnlike(article)}
            activeOpacity={0.7}
          >
            <Ionicons 
              name="heart" 
              size={16} 
              color="#FF3B5C" 
            />
          </TouchableOpacity>
        </View>
      </View>
    </Pressable>
  );
};

export default function LikedArticlesScreen({ navigation }: any) {
  const [likedArticles, setLikedArticles] = useState<LikedArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // טעינת החדשות שאהב המשתמש
  const loadLikedArticles = useCallback(async () => {
    try {
      console.log('❤️ LikedArticlesScreen: Loading liked articles');
      const articles = await LikedArticlesService.getLikedArticles();
      setLikedArticles(articles);
      console.log(`✅ LikedArticlesScreen: Loaded ${articles.length} liked articles`);
    } catch (error) {
      console.error('❌ LikedArticlesScreen: Error loading liked articles:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את החדשות שאהבת');
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
        // הסרה מהרשימה מיידית
        setLikedArticles(prev => prev.filter(item => item.id !== article.id));
      } else {
        Alert.alert('שגיאה', 'לא ניתן להסיר את האהבתי');
      }
    } catch (error) {
      console.error('❌ LikedArticlesScreen: Error unliking article:', error);
      Alert.alert('שגיאה', 'בעיה בהסרת האהבתי');
    }
  }, []);

  // רענון רשימה
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadLikedArticles();
  }, [loadLikedArticles]);

  // בחירת חדשה
  const handleArticlePress = useCallback((article: LikedArticle) => {
    console.log('❤️ LikedArticlesScreen: Article pressed:', article.article_title);
    // TODO: פתיחת מסך פרטי הכתבה
  }, []);

  // מחיקת כל החדשות שאהב
  const handleClearAll = useCallback(async () => {
    Alert.alert(
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
              setLikedArticles([]);
            } else {
              Alert.alert('שגיאה', 'לא ניתן למחוק את החדשות');
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

  if (loading) {
    return (
      <View style={{ 
        flex: 1, 
        backgroundColor: DesignTokens.colors.background.primary 
      }}>
        <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
        <SafeAreaView style={{ flex: 1 }}>
          {/* Header */}
          <View style={{ 
            flexDirection: 'row', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            paddingHorizontal: 16, 
            paddingVertical: 12 
          }}>
            <TouchableOpacity 
              onPress={() => navigation.goBack()}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
            </TouchableOpacity>
            
            <Text style={{ 
              fontSize: 18, 
              fontWeight: 'bold',
              color: DesignTokens.colors.text.primary
            }}>
              חדשות שאהבתי
            </Text>
            
            <View style={{ width: 40 }} />
          </View>
          
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
            <Text style={{
              marginTop: 16,
              fontSize: 16,
              color: DesignTokens.colors.text.secondary
            }}>
              טוען חדשות שאהבת...
            </Text>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={{ 
      flex: 1, 
      backgroundColor: DesignTokens.colors.background.primary 
    }}>
      <StatusBar style="light" backgroundColor={DesignTokens.colors.background.primary} />
      
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: 16, 
          paddingVertical: 12 
        }}>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ArrowRight size={20} color={DesignTokens.colors.text.primary} strokeWidth={2} />
          </TouchableOpacity>
          
          <View style={{ alignItems: 'center' }}>
            <Text style={{ 
              fontSize: 18, 
              fontWeight: 'bold',
              color: DesignTokens.colors.text.primary
            }}>
              חדשות שאהבתי
            </Text>
            <Text style={{
              fontSize: 12,
              color: DesignTokens.colors.text.secondary
            }}>
              {likedArticles.length} חדשות
            </Text>
          </View>
          
          {likedArticles.length > 0 && (
            <TouchableOpacity 
              onPress={handleClearAll}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: 'rgba(255, 59, 92, 0.1)',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Trash2 size={18} color="#FF3B5C" strokeWidth={2} />
            </TouchableOpacity>
          )}
          
          {likedArticles.length === 0 && <View style={{ width: 40 }} />}
        </View>

        {/* רשימת חדשות */}
        <FlatList
          data={likedArticles}
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
          contentContainerStyle={{ 
            paddingBottom: 100,
            ...(likedArticles.length === 0 && { flex: 1 })
          }}
        />
      </SafeAreaView>
    </View>
  );
}
