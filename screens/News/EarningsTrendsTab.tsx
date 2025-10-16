import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { TrendingUp, TrendingDown, Users } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../lib/supabase';

interface EarningsTrend {
  id: string
  code: string
  name?: string
  date: string
  period: string
  earnings_estimate_avg: number | null
  earnings_estimate_growth: number | null
  revenue_estimate_avg: number | null
  revenue_estimate_growth: number | null
  earnings_estimate_analysts_count: number | null
  eps_trend_current: number | null
  eps_trend_7days_ago: number | null
  eps_revisions_up_last_7days: number | null
  eps_revisions_down_last_30days: number | null
}

const TrendCard: React.FC<{ trend: EarningsTrend }> = ({ trend }) => {
  const getCompanyName = (code: string) => {
    const companies: { [key: string]: string } = {
      'AAPL.US': 'Apple',
      'MSFT.US': 'Microsoft',
      'GOOGL.US': 'Google',
      'AMZN.US': 'Amazon',
      'META.US': 'Meta',
      'TSLA.US': 'Tesla',
      'NVDA.US': 'Nvidia',
      'AMD.US': 'AMD'
    };
    return companies[code] || code.replace('.US', '');
  };

  const getPeriodName = (period: string) => {
    const periods: { [key: string]: string } = {
      '0q': 'רבעון נוכחי',
      '+1q': 'רבעון הבא',
      '0y': 'שנה נוכחית',
      '+1y': 'שנה הבאה'
    };
    return periods[period] || period;
  };

  const formatNumber = (num: number | null): string => {
    if (num === null) return 'N/A';
    if (Math.abs(num) >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (Math.abs(num) >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toFixed(2);
  };

  const formatPercent = (num: number | null): string => {
    if (num === null) return 'N/A';
    const sign = num >= 0 ? '+' : '';
    return `${sign}${(num * 100).toFixed(1)}%`;
  };

  const epsChange = trend.eps_trend_current && trend.eps_trend_7days_ago
    ? ((trend.eps_trend_current - trend.eps_trend_7days_ago) / trend.eps_trend_7days_ago)
    : null;

  const isPositiveTrend = epsChange !== null && epsChange >= 0;

  return (
    <Pressable
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: DesignTokens.colors.background.secondary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)'
      }}
    >
      {/* Header - Company & Period */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View>
          <Text 
            style={{ 
              fontSize: 18, 
              fontWeight: '700', 
              color: DesignTokens.colors.text.primary,
              textAlign: 'right'
            }}
          >
            {getCompanyName(trend.code)}
          </Text>
          <Text 
            style={{ 
              fontSize: 12, 
              color: DesignTokens.colors.text.tertiary,
              textAlign: 'right',
              marginTop: 2
            }}
          >
            {trend.code}
          </Text>
        </View>
        
        <View 
          style={{ 
            paddingHorizontal: 12, 
            paddingVertical: 6, 
            borderRadius: 14, 
            backgroundColor: 'rgba(0, 216, 74, 0.15)' 
          }}
        >
          <Text style={{ fontSize: 12, color: '#00D84A', fontWeight: '700' }}>
            {getPeriodName(trend.period)}
          </Text>
        </View>
      </View>

      {/* EPS & Revenue Estimates */}
      <View style={{ flexDirection: 'row-reverse', marginBottom: 12 }}>
        <View style={{ flex: 1, marginLeft: 8, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>
            EPS צפוי
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: '#00D84A' }}>
            ${formatNumber(trend.earnings_estimate_avg)}
          </Text>
          {trend.earnings_estimate_growth !== null && (
            <Text style={{ fontSize: 11, color: trend.earnings_estimate_growth >= 0 ? '#00D84A' : DesignTokens.colors.danger.main, marginTop: 4 }}>
              {formatPercent(trend.earnings_estimate_growth)}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>
            הכנסות צפויות
          </Text>
          <Text style={{ fontSize: 17, fontWeight: '700', color: DesignTokens.colors.text.primary }}>
            ${formatNumber(trend.revenue_estimate_avg)}
          </Text>
          {trend.revenue_estimate_growth !== null && (
            <Text style={{ fontSize: 11, color: trend.revenue_estimate_growth >= 0 ? '#00D84A' : DesignTokens.colors.danger.main, marginTop: 4 }}>
              {formatPercent(trend.revenue_estimate_growth)}
            </Text>
          )}
        </View>
      </View>

      {/* Analyst Insights */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
        {/* Analysts Count */}
        {trend.earnings_estimate_analysts_count !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: DesignTokens.colors.text.secondary, marginRight: 6 }}>
              {trend.earnings_estimate_analysts_count} אנליסטים
            </Text>
            <Users size={14} color={DesignTokens.colors.text.secondary} />
          </View>
        )}

        {/* 7-Day Trend */}
        {epsChange !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: isPositiveTrend ? '#00D84A' : DesignTokens.colors.danger.main, marginRight: 6, fontWeight: '700' }}>
              {formatPercent(epsChange)}
            </Text>
            {isPositiveTrend ? (
              <TrendingUp size={14} color="#00D84A" strokeWidth={2.5} />
            ) : (
              <TrendingDown size={14} color={DesignTokens.colors.danger.main} strokeWidth={2.5} />
            )}
            <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginLeft: 4 }}>
              7 ימים
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default function EarningsTrendsTab() {
  const [trends, setTrends] = useState<EarningsTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrends = useCallback(async () => {
    try {
      console.log('📊 Loading earnings trends from Supabase');
      
      const { data, error } = await supabase
        .from('earnings_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      if (data) {
        console.log(`✅ Loaded ${data.length} trends`);
        setTrends(data);
      }
    } catch (error) {
      console.error('❌ Error loading trends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadTrends();
  };

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <TrendingUp size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ fontSize: 16, color: DesignTokens.colors.text.secondary, marginTop: 16, textAlign: 'center' }}>
        אין תחזיות זמינות כרגע
      </Text>
      <Text style={{ fontSize: 14, color: DesignTokens.colors.text.tertiary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני תחזיות רווחים יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignTokens.colors.background.primary }}>
        <ActivityIndicator size="large" color="#00D84A" />
        <Text style={{ fontSize: 14, color: DesignTokens.colors.text.secondary, marginTop: 16 }}>
          טוען תחזיות...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      <FlatList
        data={trends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TrendCard trend={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#00D84A"
            colors={['#00D84A']}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
      />
    </View>
  );
}


