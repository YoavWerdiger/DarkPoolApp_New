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
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { supabase } from '../../lib/supabase';
import { HapticFeedback } from '../../utils/hapticFeedback';

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
  const DesignTokens = useDesignTokens();
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
        marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        marginBottom: APP_LAYOUT.cardStackGap,
        borderRadius: UI_CARD_RADIUS,
        paddingVertical: 15,
        paddingHorizontal: APP_LAYOUT.cardPadding,
        backgroundColor: DesignTokens.colors.background.cardSolid,
      }}
    >
      {/* Header - Company & Period */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View>
          <Text
            style={{
              ...APP_TYPE.cardTitle,
              color: DesignTokens.colors.text.primary,
              textAlign: 'right'
            }}
          >
            {getCompanyName(trend.code)}
          </Text>
          <Text
            style={{
              ...APP_TYPE.caption,
              color: DesignTokens.colors.text.tertiary,
              textAlign: 'right',
              marginTop: APP_LAYOUT.cardTitleToSubtitleGap
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
            backgroundColor: `${DesignTokens.colors.success.main}26`
          }}
        >
          <Text style={{ ...APP_TYPE.caption, color: DesignTokens.colors.success.main }}>
            {getPeriodName(trend.period)}
          </Text>
        </View>
      </View>

      {/* EPS & Revenue Estimates */}
      <View style={{ flexDirection: 'row', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ ...APP_TYPE.caption2, color: DesignTokens.colors.text.tertiary, marginBottom: APP_LAYOUT.cardMetricLabelToValueGap, textAlign: 'right' }}>
            EPS צפוי
          </Text>
          <Text style={{ ...APP_TYPE.cardTitle, color: DesignTokens.colors.success.main, textAlign: 'right' }}>
            ${formatNumber(trend.earnings_estimate_avg)}
          </Text>
          {trend.earnings_estimate_growth !== null && (
            <Text style={{ ...APP_TYPE.caption2, color: trend.earnings_estimate_growth >= 0 ? DesignTokens.colors.success.main : DesignTokens.colors.danger.main, marginTop: APP_LAYOUT.cardMetricLabelToValueGap, textAlign: 'right' }}>
              {formatPercent(trend.earnings_estimate_growth)}
            </Text>
          )}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ ...APP_TYPE.caption2, color: DesignTokens.colors.text.tertiary, marginBottom: APP_LAYOUT.cardMetricLabelToValueGap, textAlign: 'right' }}>
            הכנסות צפויות
          </Text>
          <Text style={{ ...APP_TYPE.cardTitle, color: DesignTokens.colors.text.primary, textAlign: 'right' }}>
            ${formatNumber(trend.revenue_estimate_avg)}
          </Text>
          {trend.revenue_estimate_growth !== null && (
            <Text style={{ ...APP_TYPE.caption2, color: trend.revenue_estimate_growth >= 0 ? DesignTokens.colors.success.main : DesignTokens.colors.danger.main, marginTop: APP_LAYOUT.cardMetricLabelToValueGap, textAlign: 'right' }}>
              {formatPercent(trend.revenue_estimate_growth)}
            </Text>
          )}
        </View>
      </View>

      {/* Analyst Insights */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: APP_LAYOUT.cardTitleToBodyGap, borderTopWidth: 1, borderTopColor: DesignTokens.colors.border.divider }}>
        {/* Analysts Count */}
        {trend.earnings_estimate_analysts_count !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...APP_TYPE.caption, color: DesignTokens.colors.text.secondary, marginLeft: 6 }}>
              {trend.earnings_estimate_analysts_count} אנליסטים
            </Text>
            <Users size={14} color={DesignTokens.colors.text.secondary} />
          </View>
        )}

        {/* 7-Day Trend */}
        {epsChange !== null && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...APP_TYPE.caption, color: isPositiveTrend ? DesignTokens.colors.success.main : DesignTokens.colors.danger.main, marginLeft: 6 }}>
              {formatPercent(epsChange)}
            </Text>
            {isPositiveTrend ? (
              <TrendingUp size={14} color={DesignTokens.colors.success.main} strokeWidth={2.5} />
            ) : (
              <TrendingDown size={14} color={DesignTokens.colors.danger.main} strokeWidth={2.5} />
            )}
            <Text style={{ ...APP_TYPE.caption2, color: DesignTokens.colors.text.tertiary, marginLeft: APP_LAYOUT.cardMetricLabelToValueGap }}>
              7 ימים
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
};

export default function EarningsTrendsTab() {
  const DesignTokens = useDesignTokens();
  const [trends, setTrends] = useState<EarningsTrend[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrends = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('earnings_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(100);

      if (error) {
        return;
      }

      if (data) {
        setTrends(data);
      }
    } catch (error) {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadTrends();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadTrends]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <TrendingUp size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ ...APP_TYPE.body, color: DesignTokens.colors.text.secondary, marginTop: APP_LAYOUT.componentGap, textAlign: 'center' }}>
        אין תחזיות זמינות כרגע
      </Text>
      <Text style={{ ...APP_TYPE.cardSubtitle, color: DesignTokens.colors.text.tertiary, marginTop: APP_LAYOUT.groupLabelToContent, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני תחזיות רווחים יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="large" color={DesignTokens.colors.primary.main} />
        <Text style={{ ...APP_TYPE.body, color: DesignTokens.colors.text.secondary, marginTop: APP_LAYOUT.componentGap }}>
          טוען תחזיות...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FlatList
        data={trends}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <TrendCard trend={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DesignTokens.colors.success.main}
            colors={[DesignTokens.colors.success.main]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
      />
    </View>
  );
}


