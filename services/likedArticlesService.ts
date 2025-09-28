import { supabase } from './supabase';
import { NewsArticle } from './newsService';

export interface LikedArticle {
  id: string;
  user_id: string;
  article_id: string;
  article_title: string;
  article_source: string;
  article_image_url: string;
  article_published_at: string;
  created_at: string;
}

export class LikedArticlesService {
  // בדיקה אם המשתמש אהב חדשה מסוימת
  static async isArticleLiked(articleId: string): Promise<boolean> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('❌ LikedArticlesService: No authenticated user');
        return false;
      }

      const { data, error } = await supabase
        .from('liked_articles')
        .select('id')
        .eq('user_id', user.id)
        .eq('article_id', articleId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        console.error('❌ LikedArticlesService: Error checking if article is liked:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('❌ LikedArticlesService: Error in isArticleLiked:', error);
      return false;
    }
  }

  // הוספת חדשה לרשימת האהבתי
  static async likeArticle(article: NewsArticle): Promise<boolean> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('❌ LikedArticlesService: No authenticated user');
        return false;
      }

      const { error } = await supabase
        .from('liked_articles')
        .insert({
          user_id: user.id,
          article_id: article.id,
          article_title: article.title,
          article_source: article.source,
          article_image_url: article.image_url,
          article_published_at: article.published_at
        });

      if (error) {
        // אם זה שגיאת כפילות, זה בסדר - המשתמש כבר אהב את החדשה
        if (error.code === '23505') { // unique_violation
          console.log('ℹ️ LikedArticlesService: Article already liked');
          return true;
        }
        console.error('❌ LikedArticlesService: Error liking article:', error);
        return false;
      }

      console.log('✅ LikedArticlesService: Article liked successfully');
      return true;
    } catch (error) {
      console.error('❌ LikedArticlesService: Error in likeArticle:', error);
      return false;
    }
  }

  // הסרת חדשה מרשימת האהבתי
  static async unlikeArticle(articleId: string): Promise<boolean> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('❌ LikedArticlesService: No authenticated user');
        return false;
      }

      const { error } = await supabase
        .from('liked_articles')
        .delete()
        .eq('user_id', user.id)
        .eq('article_id', articleId);

      if (error) {
        console.error('❌ LikedArticlesService: Error unliking article:', error);
        return false;
      }

      console.log('✅ LikedArticlesService: Article unliked successfully');
      return true;
    } catch (error) {
      console.error('❌ LikedArticlesService: Error in unlikeArticle:', error);
      return false;
    }
  }

  // קבלת כל החדשות שאהב המשתמש
  static async getLikedArticles(): Promise<LikedArticle[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('❌ LikedArticlesService: No authenticated user');
        return [];
      }

      const { data, error } = await supabase
        .from('liked_articles')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ LikedArticlesService: Error getting liked articles:', error);
        return [];
      }

      console.log(`✅ LikedArticlesService: Retrieved ${data?.length || 0} liked articles`);
      return data || [];
    } catch (error) {
      console.error('❌ LikedArticlesService: Error in getLikedArticles:', error);
      return [];
    }
  }

  // קבלת רשימת IDs של חדשות שאהב המשתמש (לביצועים טובים יותר)
  static async getLikedArticleIds(): Promise<string[]> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('❌ LikedArticlesService: No authenticated user');
        return [];
      }

      const { data, error } = await supabase
        .from('liked_articles')
        .select('article_id')
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ LikedArticlesService: Error getting liked article IDs:', error);
        return [];
      }

      return data?.map(item => item.article_id) || [];
    } catch (error) {
      console.error('❌ LikedArticlesService: Error in getLikedArticleIds:', error);
      return [];
    }
  }

  // מחיקת כל החדשות שאהב המשתמש
  static async clearAllLikedArticles(): Promise<boolean> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.log('❌ LikedArticlesService: No authenticated user');
        return false;
      }

      const { error } = await supabase
        .from('liked_articles')
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error('❌ LikedArticlesService: Error clearing liked articles:', error);
        return false;
      }

      console.log('✅ LikedArticlesService: All liked articles cleared successfully');
      return true;
    } catch (error) {
      console.error('❌ LikedArticlesService: Error in clearAllLikedArticles:', error);
      return false;
    }
  }
}
