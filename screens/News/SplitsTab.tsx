import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { Scissors, TrendingUp, TrendingDown, AlertTriangle } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { supabase } from '../../lib/supabase';
import { HapticFeedback } from '../../utils/hapticFeedback';

interface Split {
  id: string
  code: string
  name: string | null
  exchange: string | null
  date: string
  ratio: string
  numerator: number
  denominator: number
  is_reverse: boolean
}

const SplitCard: React.FC<{ split: Split }> = ({ split }) => {
  const tokens = useDesignTokens();
  const getCompanyName = (code: string, name: string | null) => {
    return name || code.replace('.US', '');
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getSplitDescription = () => {
    if (split.is_reverse) {
      return `פיצול הפוך - כל ${split.denominator} מניות יהפכו למניה ${split.numerator}`;
    } else {
      return `פיצול רגיל - כל מניה תהפוך ל-${split.numerator} מניות`;
    }
  };

  return (
    <Pressable
      style={{
        marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        marginBottom: APP_LAYOUT.cardStackGap,
        borderRadius: UI_CARD_RADIUS,
        paddingVertical: 15,
        paddingHorizontal: APP_LAYOUT.cardPadding,
        backgroundColor: tokens.colors.background.cardSolid,
      }}
    >
      {/* Indicator Line */}
      <View 
        style={{ 
          position: 'absolute', 
          right: 0, 
          top: 0, 
          bottom: 0, 
          width: 3, 
          backgroundColor: split.is_reverse ? tokens.colors.danger.main : tokens.colors.success.main,
          borderTopRightRadius: UI_CARD_RADIUS,
          borderBottomRightRadius: UI_CARD_RADIUS
        }} 
      />

      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text 
            style={{ 
              ...APP_TYPE.cardTitle,
              color: tokens.colors.text.primary,
              textAlign: 'right'
            }}
            numberOfLines={1}
          >
            {getCompanyName(split.code, split.name)}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: APP_LAYOUT.cardTitleToSubtitleGap }}>
            <Text style={{ ...APP_TYPE.caption, color: tokens.colors.text.tertiary }}>
              {split.code}
            </Text>
            {split.exchange && (
              <>
                <Text style={{ ...APP_TYPE.caption, color: tokens.colors.text.tertiary, marginHorizontal: 6 }}>•</Text>
                <Text style={{ ...APP_TYPE.caption, color: tokens.colors.text.tertiary }}>
                  {split.exchange}
                </Text>
              </>
            )}
          </View>
        </View>
        
        {split.is_reverse && (
          <View style={{ marginLeft: 8 }}>
            <AlertTriangle size={20} color={tokens.colors.danger.main} strokeWidth={2} />
          </View>
        )}
      </View>

      {/* Split Ratio - Big & Bold */}
      <View 
        style={{ 
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 20,
          borderRadius: 16,
          backgroundColor: split.is_reverse ? 'rgba(239, 68, 68, 0.1)' : `${tokens.colors.success.main}1A`,
          marginBottom: 12
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          {split.is_reverse ? (
            <TrendingDown size={24} color={tokens.colors.danger.main} strokeWidth={2.5} />
          ) : (
            <TrendingUp size={24} color={tokens.colors.success.main} strokeWidth={2.5} />
          )}
          <Text 
            style={{ 
              ...APP_TYPE.cardMetricValue,
              color: split.is_reverse ? tokens.colors.danger.main : tokens.colors.success.main,
              marginHorizontal: APP_LAYOUT.cardTitleToBodyGap
            }}
          >
            {split.ratio}
          </Text>
          <Scissors size={24} color={split.is_reverse ? tokens.colors.danger.main : tokens.colors.success.main} strokeWidth={2.5} />
        </View>
        
        <View 
          style={{ 
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 14, 
            backgroundColor: split.is_reverse ? 'rgba(239, 68, 68, 0.15)' : `${tokens.colors.success.main}26`
          }}
        >
          <Text style={{ ...APP_TYPE.cardSubtitle, color: split.is_reverse ? tokens.colors.danger.main : tokens.colors.success.main, textAlign: 'center' }}>
            {split.is_reverse ? '⚠️ פיצול הפוך' : '✨ פיצול רגיל'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text 
        style={{ 
          ...APP_TYPE.cardSubtitle,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
          marginBottom: APP_LAYOUT.cardTitleToBodyGap
        }}
      >
        {getSplitDescription()}
      </Text>

      {/* Date */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingTop: APP_LAYOUT.cardTitleToBodyGap, borderTopWidth: 1, borderTopColor: tokens.colors.border.divider }}>
        <Text style={{ ...APP_TYPE.caption, color: tokens.colors.text.tertiary }}>
          תאריך אפקטיבי:
        </Text>
        <Text style={{ ...APP_TYPE.cardSubtitle, color: tokens.colors.text.primary, marginLeft: 6 }}>
          {formatDate(split.date)}
        </Text>
      </View>
    </Pressable>
  );
};

export default function SplitsTab() {
  const tokens = useDesignTokens();
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSplits = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('splits_calendar')
        .select('*')
        .order('date', { ascending: true })
        .limit(100);
      
      if (error) {
        return;
      }
      
      if (data) {
        setSplits(data);
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
      await loadSplits();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadSplits]);

  useEffect(() => {
    loadSplits();
  }, [loadSplits]);

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <Scissors size={64} color={tokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ ...APP_TYPE.body, color: tokens.colors.text.secondary, marginTop: APP_LAYOUT.componentGap, textAlign: 'center' }}>
        אין פיצולים זמינים כרגע
      </Text>
      <Text style={{ ...APP_TYPE.cardSubtitle, color: tokens.colors.text.tertiary, marginTop: APP_LAYOUT.groupLabelToContent, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני פיצולי מניות יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }}>
        <ActivityIndicator size="large" color={tokens.colors.primary.main} />
        <Text style={{ ...APP_TYPE.body, color: tokens.colors.text.secondary, marginTop: APP_LAYOUT.componentGap }}>
          טוען פיצולים...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent' }}>
      <FlatList
        data={splits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SplitCard split={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={tokens.colors.primary.main}
            colors={[tokens.colors.primary.main]}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
      />
    </View>
  );
}


