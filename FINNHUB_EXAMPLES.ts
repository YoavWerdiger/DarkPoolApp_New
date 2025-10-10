/**
 * דוגמאות שימוש ב-Finnhub Service
 * 
 * קובץ זה מכיל דוגמאות מעשיות לשימוש בשירות Finnhub
 * אפשר להעתיק ולהדביק את הקוד לכל מקום באפליקציה
 */

import FinnhubService from './services/finnhubService';
import type { EconomicEvent, FinnhubMarketNews } from './services/finnhubService';

// =====================================
// דוגמה 1: קבלת אירועים כלכליים לשבוע הקרוב
// =====================================
export async function example1_getUpcomingWeekEvents() {
  console.log('📅 Example 1: Getting upcoming week events...');
  
  try {
    const events = await FinnhubService.getUpcomingWeekEvents();
    
    console.log(`✅ Found ${events.length} events for the next week`);
    
    // הצגת 3 האירועים הראשונים
    events.slice(0, 3).forEach(event => {
      console.log(`
        📌 ${event.title}
        🌍 ${event.country} (${event.currency})
        📅 ${event.date} at ${event.time}
        ⚡ Importance: ${event.importance}
        ${event.forecast ? `📊 Forecast: ${event.forecast}` : ''}
      `);
    });
    
    return events;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// =====================================
// דוגמה 2: קבלת רק אירועים בעלי חשיבות גבוהה
// =====================================
export async function example2_getHighImpactEvents() {
  console.log('🔥 Example 2: Getting high impact events only...');
  
  try {
    // קבלת אירועים ל-30 הימים הבאים
    const events = await FinnhubService.getHighImportanceEvents(30);
    
    console.log(`✅ Found ${events.length} high impact events`);
    
    // סינון לפי קטגוריה ספציפית (למשל, ריבית)
    const interestRateEvents = events.filter(e => 
      e.category === 'ריבית' || 
      e.title.toLowerCase().includes('rate') ||
      e.title.toLowerCase().includes('interest')
    );
    
    console.log(`🎯 Found ${interestRateEvents.length} interest rate events`);
    
    interestRateEvents.forEach(event => {
      console.log(`💰 ${event.title} - ${event.date}`);
    });
    
    return events;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// =====================================
// דוגמה 3: קבלת אירועים לטווח תאריכים מותאם אישית
// =====================================
export async function example3_getCustomDateRange() {
  console.log('📆 Example 3: Getting events for custom date range...');
  
  try {
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 14);
    
    const from = today.toISOString().split('T')[0];
    const to = twoWeeksLater.toISOString().split('T')[0];
    
    console.log(`📅 Fetching events from ${from} to ${to}`);
    
    const rawEvents = await FinnhubService.getEconomicCalendar(from, to);
    const events = rawEvents.map(e => FinnhubService.convertToAppFormat(e));
    
    console.log(`✅ Found ${events.length} events`);
    
    // קיבוץ לפי חשיבות
    const byImportance = {
      high: events.filter(e => e.importance === 'high'),
      medium: events.filter(e => e.importance === 'medium'),
      low: events.filter(e => e.importance === 'low')
    };
    
    console.log(`
      🔴 High: ${byImportance.high.length}
      🟡 Medium: ${byImportance.medium.length}
      🟢 Low: ${byImportance.low.length}
    `);
    
    return events;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// =====================================
// דוגמה 4: קבלת חדשות שוק
// =====================================
export async function example4_getMarketNews() {
  console.log('📰 Example 4: Getting market news...');
  
  try {
    // קטגוריות זמינות: general, forex, crypto, merger
    const generalNews = await FinnhubService.getMarketNews('general');
    
    console.log(`✅ Found ${generalNews.length} general news articles`);
    
    // הצגת 5 הכתבות הראשונות
    generalNews.slice(0, 5).forEach(article => {
      const date = new Date(article.datetime * 1000);
      console.log(`
        📰 ${article.headline}
        🏢 Source: ${article.source}
        📅 ${date.toLocaleDateString('he-IL')}
        🔗 ${article.url}
      `);
    });
    
    return generalNews;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// =====================================
// דוגמה 5: קבלת חדשות חברה ספציפית
// =====================================
export async function example5_getCompanyNews(symbol: string = 'AAPL') {
  console.log(`📰 Example 5: Getting news for ${symbol}...`);
  
  try {
    const today = new Date();
    const monthAgo = new Date(today);
    monthAgo.setMonth(today.getMonth() - 1);
    
    const from = monthAgo.toISOString().split('T')[0];
    const to = today.toISOString().split('T')[0];
    
    const news = await FinnhubService.getCompanyNews(symbol, from, to);
    
    console.log(`✅ Found ${news.length} news articles for ${symbol}`);
    
    // הצגת הכתבות האחרונות
    news.slice(0, 3).forEach(article => {
      const date = new Date(article.datetime * 1000);
      console.log(`
        📌 ${article.headline}
        📅 ${date.toLocaleDateString('he-IL')}
        📝 ${article.summary.substring(0, 100)}...
      `);
    });
    
    return news;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// =====================================
// דוגמה 6: ניתוח אירועים לפי מדינה
// =====================================
export async function example6_analyzeByCountry() {
  console.log('🌍 Example 6: Analyzing events by country...');
  
  try {
    const events = await FinnhubService.getUpcomingMonthEvents();
    
    // קיבוץ לפי מדינה
    const byCountry: Record<string, EconomicEvent[]> = {};
    
    events.forEach(event => {
      if (!byCountry[event.country]) {
        byCountry[event.country] = [];
      }
      byCountry[event.country].push(event);
    });
    
    // מיון לפי מספר אירועים
    const sortedCountries = Object.entries(byCountry)
      .sort(([, a], [, b]) => b.length - a.length);
    
    console.log('\n🌍 Events by Country:');
    sortedCountries.forEach(([country, countryEvents]) => {
      const highImpact = countryEvents.filter(e => e.importance === 'high').length;
      console.log(`
        ${country}: ${countryEvents.length} events
        ${highImpact > 0 ? `🔴 ${highImpact} high impact` : ''}
      `);
    });
    
    return byCountry;
  } catch (error) {
    console.error('❌ Error:', error);
    return {};
  }
}

// =====================================
// דוגמה 7: מציאת אירועי GDP
// =====================================
export async function example7_findGDPEvents() {
  console.log('📊 Example 7: Finding GDP events...');
  
  try {
    const events = await FinnhubService.getUpcomingMonthEvents();
    
    // חיפוש אירועי GDP
    const gdpEvents = events.filter(event => 
      event.title.toLowerCase().includes('gdp') ||
      event.category === 'צמיחה'
    );
    
    console.log(`✅ Found ${gdpEvents.length} GDP-related events`);
    
    // מיון לפי תאריך
    gdpEvents.sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    
    gdpEvents.forEach(event => {
      console.log(`
        📊 ${event.title}
        🌍 ${event.country}
        📅 ${event.date} at ${event.time}
        ${event.forecast ? `📈 Forecast: ${event.forecast}${event.unit || ''}` : ''}
      `);
    });
    
    return gdpEvents;
  } catch (error) {
    console.error('❌ Error:', error);
    return [];
  }
}

// =====================================
// דוגמה 8: בדיקת זמינות ה-API
// =====================================
export async function example8_checkAPIHealth() {
  console.log('🔍 Example 8: Checking API health...');
  
  try {
    const isAvailable = await FinnhubService.checkApiAvailability();
    
    if (isAvailable) {
      console.log('✅ Finnhub API is available and working!');
      
      // קבלת סטטיסטיקות cache
      const cacheStats = FinnhubService.getCacheStats();
      console.log(`
        💾 Cache Statistics:
        - Items in cache: ${cacheStats.size}
        - Cache keys: ${cacheStats.keys.join(', ')}
      `);
    } else {
      console.log('❌ Finnhub API is not available');
    }
    
    return isAvailable;
  } catch (error) {
    console.error('❌ Error:', error);
    return false;
  }
}

// =====================================
// דוגמה 9: שימוש ב-React Component
// =====================================
export const Example9_ReactComponent = `
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList } from 'react-native';
import FinnhubService from './services/finnhubService';
import type { EconomicEvent } from './services/finnhubService';

export function EconomicEventsScreen() {
  const [events, setEvents] = useState<EconomicEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const data = await FinnhubService.getUpcomingWeekEvents();
      setEvents(data);
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Text>Loading...</Text>;
  }

  return (
    <FlatList
      data={events}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ padding: 16, borderBottomWidth: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: 'bold' }}>
            {item.title}
          </Text>
          <Text style={{ fontSize: 12, color: 'gray' }}>
            {item.country} • {item.date} {item.time}
          </Text>
          {item.forecast && (
            <Text>Forecast: {item.forecast}</Text>
          )}
        </View>
      )}
    />
  );
}
`;

// =====================================
// דוגמה 10: הרצת כל הדוגמאות
// =====================================
export async function runAllExamples() {
  console.log('\n🚀 Running all Finnhub examples...\n');
  
  await example1_getUpcomingWeekEvents();
  console.log('\n---\n');
  
  await example2_getHighImpactEvents();
  console.log('\n---\n');
  
  await example3_getCustomDateRange();
  console.log('\n---\n');
  
  await example4_getMarketNews();
  console.log('\n---\n');
  
  await example5_getCompanyNews('AAPL');
  console.log('\n---\n');
  
  await example6_analyzeByCountry();
  console.log('\n---\n');
  
  await example7_findGDPEvents();
  console.log('\n---\n');
  
  await example8_checkAPIHealth();
  
  console.log('\n✅ All examples completed!\n');
}

// הרצה אוטומטית (להסיר בייצור)
// runAllExamples().catch(console.error);


