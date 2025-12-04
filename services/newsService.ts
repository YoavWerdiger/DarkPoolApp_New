import { supabase } from './supabase';
import { DesignTokens } from '../components/ui/DesignTokens';

// טיפוסי נתונים לחדשות
export interface NewsArticle {
  id: string;
  label?: string;              // כותרת קצרה להצגה
  title: string;               // כותרת מלאה/תוכן
  content: string;
  summary?: string;
  source: string;
  source_url?: string;
  url?: string;
  author?: string;
  image_url?: string;
  published_at: string;
  created_at: string;
  updated_at?: string;
  category?: string;
  tags?: string[];
  is_featured?: boolean;
  view_count?: number;
  sentiment?: 'positive' | 'negative' | 'neutral';
  relevance_score?: number;
  reading_time?: number;
}

export interface NewsFilters {
  category?: string;
  source?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
  search_query?: string;
}

export class NewsService {
  private static instance: NewsService;
  private realtimeSubscription: any = null;

  static getInstance(): NewsService {
    if (!NewsService.instance) {
      NewsService.instance = new NewsService();
    }
    return NewsService.instance;
  }

  // קבלת חדשות עם פילטרים
  async getNews(filters: NewsFilters = {}): Promise<NewsArticle[]> {
    try {
      console.log('📰 NewsService: Fetching news with filters:', filters);

      let query = supabase
        .from('app_news_clean')
        .select('*')
        .order('time', { ascending: false });

      // יישום פילטרים
      if (filters.category) {
        query = query.eq('category', filters.category);
      }

      if (filters.source) {
        query = query.eq('source', filters.source);
      }

      if (filters.date_from) {
        query = query.gte('published_at', filters.date_from);
      }

      if (filters.date_to) {
        query = query.lte('published_at', filters.date_to);
      }

      if (filters.search_query) {
        query = query.or(`title.ilike.%${filters.search_query}%,content.ilike.%${filters.search_query}%`);
      }

      if (filters.limit) {
        query = query.limit(filters.limit);
      }

      if (filters.offset) {
        query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
      }

      const { data, error } = await query;

      if (error) {
        console.error('❌ NewsService: Error fetching news:', error);
        throw error;
      }

      console.log('✅ NewsService: Successfully fetched news:', data?.length || 0, 'articles');
      return data || [];
    } catch (error) {
      console.error('❌ NewsService: Exception in getNews:', error);
      throw error;
    }
  }

  // קבלת חדשות מומלצות/חשובות
  async getFeaturedNews(limit: number = 5): Promise<NewsArticle[]> {
    try {
      console.log('⭐ NewsService: Fetching featured news');

      const { data, error } = await supabase
        .from('app_news_clean')
        .select('*')
        .eq('is_featured', true)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ NewsService: Error fetching featured news:', error);
        throw error;
      }

      console.log('✅ NewsService: Successfully fetched featured news:', data?.length || 0, 'articles');
      return data || [];
    } catch (error) {
      console.error('❌ NewsService: Exception in getFeaturedNews:', error);
      throw error;
    }
  }

  // קבלת חדשות לפי קטגוריה
  async getNewsByCategory(category: string, limit: number = 20): Promise<NewsArticle[]> {
    try {
      console.log('📂 NewsService: Fetching news by category:', category);

      const { data, error } = await supabase
        .from('app_news_clean')
        .select('*')
        .eq('category', category)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ NewsService: Error fetching news by category:', error);
        throw error;
      }

      console.log('✅ NewsService: Successfully fetched category news:', data?.length || 0, 'articles');
      return data || [];
    } catch (error) {
      console.error('❌ NewsService: Exception in getNewsByCategory:', error);
      throw error;
    }
  }

  // קבלת קטגוריות זמינות
  async getCategories(): Promise<string[]> {
    try {
      console.log('📂 NewsService: Fetching available categories');

      const { data, error } = await supabase
        .from('app_news_clean')
        .select('category')
        .not('category', 'is', null);

      if (error) {
        console.error('❌ NewsService: Error fetching categories:', error);
        throw error;
      }

      // הסרת כפילויות ומיון
      const categories = [...new Set(data?.map(item => item.category).filter(Boolean))].sort();
      
      console.log('✅ NewsService: Successfully fetched categories:', categories.length, 'categories');
      return categories;
    } catch (error) {
      console.error('❌ NewsService: Exception in getCategories:', error);
      throw error;
    }
  }

  // קבלת מקורות זמינים
  async getSources(): Promise<string[]> {
    try {
      console.log('📰 NewsService: Fetching available sources');

      const { data, error } = await supabase
        .from('app_news_clean')
        .select('source')
        .not('source', 'is', null);

      if (error) {
        console.error('❌ NewsService: Error fetching sources:', error);
        throw error;
      }

      // הסרת כפילויות ומיון
      const sources = [...new Set(data?.map(item => item.source).filter(Boolean))].sort();
      
      console.log('✅ NewsService: Successfully fetched sources:', sources.length, 'sources');
      return sources;
    } catch (error) {
      console.error('❌ NewsService: Exception in getSources:', error);
      throw error;
    }
  }

  // חיפוש חדשות
  async searchNews(query: string, limit: number = 20): Promise<NewsArticle[]> {
    try {
      console.log('🔍 NewsService: Searching news for:', query);

      const { data, error } = await supabase
        .from('app_news_clean')
        .select('*')
        .or(`title.ilike.%${query}%,content.ilike.%${query}%,summary.ilike.%${query}%`)
        .order('published_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ NewsService: Error searching news:', error);
        throw error;
      }

      console.log('✅ NewsService: Successfully searched news:', data?.length || 0, 'results');
      return data || [];
    } catch (error) {
      console.error('❌ NewsService: Exception in searchNews:', error);
      throw error;
    }
  }

  // הגדרת realtime subscription לעדכונים חדשים
  subscribeToNewsUpdates(callback: (newArticle: NewsArticle) => void): () => void {
    console.log('🔄 NewsService: Setting up realtime subscription for news updates');

    // ביטול subscription קיים אם קיים
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
    }

    this.realtimeSubscription = supabase
      .channel('app_news_clean_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'app_news_clean'
        },
        (payload) => {
          console.log('📰 NewsService: New article received via realtime:', payload.new);
          callback(payload.new as NewsArticle);
        }
      )
      .subscribe();

    // פונקציה לביטול ה-subscription
    return () => {
      console.log('🔄 NewsService: Unsubscribing from news updates');
      if (this.realtimeSubscription) {
        this.realtimeSubscription.unsubscribe();
        this.realtimeSubscription = null;
      }
    };
  }

  // קבלת חדשות עם אינסוף גלילה
  async getNewsWithPagination(
    page: number = 1,
    limit: number = 20,
    filters: NewsFilters = {}
  ): Promise<{ articles: NewsArticle[]; hasMore: boolean; total: number }> {
    try {
      console.log('📰 NewsService: Fetching news with pagination:', { page, limit, filters });

      const offset = (page - 1) * limit;
      
      // קבלת המאמרים
      const articles = await this.getNews({
        ...filters,
        limit,
        offset
      });

      // בדיקה אם יש עוד נתונים
      const { count } = await supabase
        .from('app_news_clean')
        .select('*', { count: 'exact', head: true });

      const hasMore = offset + articles.length < (count || 0);

      console.log('✅ NewsService: Pagination result:', {
        articlesCount: articles.length,
        hasMore,
        total: count || 0
      });

      return {
        articles,
        hasMore,
        total: count || 0
      };
    } catch (error) {
      console.error('❌ NewsService: Exception in getNewsWithPagination:', error);
      throw error;
    }
  }

  // עדכון מספר צפיות
  async incrementViewCount(articleId: string): Promise<void> {
    try {
      console.log('👁️ NewsService: Incrementing view count for article:', articleId);

      const { error } = await supabase.rpc('increment_news_view_count', {
        article_id: articleId
      });

      if (error) {
        console.error('❌ NewsService: Error incrementing view count:', error);
        throw error;
      }

      console.log('✅ NewsService: Successfully incremented view count');
    } catch (error) {
      console.error('❌ NewsService: Exception in incrementViewCount:', error);
      throw error;
    }
  }

  // ניקוי משאבים
  cleanup(): void {
    console.log('🧹 NewsService: Cleaning up resources');
    if (this.realtimeSubscription) {
      this.realtimeSubscription.unsubscribe();
      this.realtimeSubscription = null;
    }
  }
}

// יצירת instance גלובלי
export const newsService = NewsService.getInstance();

// פונקציות עזר
export const formatNewsDate = (dateString: string): string => {
  console.log('🕐 formatNewsDate: Input dateString:', dateString);
  
  if (!dateString) {
    console.log('⚠️ formatNewsDate: Empty dateString, returning "תאריך לא זמין"');
    return 'תאריך לא זמין';
  }

  // ניסיון לפרסר את התאריך
  let date: Date;
  
  try {
    // אם זה מספר (timestamp), נמיר אותו
    if (typeof dateString === 'number' || /^\d+$/.test(dateString)) {
      const timestamp = parseInt(dateString);
      // בדיקה אם זה timestamp בשניות או במילישניות
      if (timestamp < 10000000000) { // פחות מ-10 מיליארד = בשניות
        date = new Date(timestamp * 1000);
      } else { // במילישניות
        date = new Date(timestamp);
      }
      console.log('🕐 formatNewsDate: Parsed as Unix timestamp:', date);
    } else {
      date = new Date(dateString);
      console.log('🕐 formatNewsDate: Parsed as date string:', date);
    }

    // בדיקה אם התאריך תקין
    if (isNaN(date.getTime()) || date.getTime() < 0) {
      console.log('❌ formatNewsDate: Invalid date, returning "תאריך לא זמין"');
      return 'תאריך לא זמין';
    }
  } catch (error) {
    console.log('❌ formatNewsDate: Error parsing date, returning "תאריך לא זמין":', error);
    return 'תאריך לא זמין';
  }

  // תצוגת תאריך ושעה לפי שעון ישראל
  try {
    // המרה ישירה לשעון ישראל
    const formatted = date.toLocaleString('he-IL', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
    
    console.log('🕐 formatNewsDate: Formatted date (Israel timezone):', {
      originalDate: dateString,
      formatted: formatted
    });
    
    return formatted;
  } catch (error) {
    console.log('❌ formatNewsDate: Error formatting with timezone, using fallback:', error);
    // נפילה - תצוגה פשוטה
    return date.toLocaleDateString('he-IL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
};

export const truncateText = (text: string, maxLength: number = 150): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
};

export const getNewsCategoryColor = (category?: string): string => {
  const colors: Record<string, string> = {
    'פיננסים': DesignTokens.colors.success.main,
    'כלכלה': DesignTokens.colors.info.main,
    'מטבעות דיגיטליים': DesignTokens.colors.warning.main,
    'בורסה': DesignTokens.colors.primary.main,
    'נדל"ן': DesignTokens.colors.secondary.main,
    'טכנולוגיה': DesignTokens.colors.accent.main,
    'פוליטיקה': DesignTokens.colors.danger.main,
    'כללי': DesignTokens.colors.text.tertiary
  };

  return colors[category || 'כללי'] || colors['כללי'];
};

export const getNewsCategoryIcon = (category?: string): string => {
  const icons: Record<string, string> = {
    'פיננסים': 'trending-up',
    'כלכלה': 'bar-chart',
    'מטבעות דיגיטליים': 'logo-bitcoin',
    'בורסה': 'business',
    'נדל"ן': 'home',
    'טכנולוגיה': 'laptop',
    'פוליטיקה': 'people',
    'כללי': 'newspaper'
  };

  return icons[category || 'כללי'] || icons['כללי'];
};
