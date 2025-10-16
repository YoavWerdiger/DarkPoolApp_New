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
import { DesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../lib/supabase';

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
        borderColor: split.is_reverse ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 216, 74, 0.2)'
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
          backgroundColor: split.is_reverse ? DesignTokens.colors.danger.main : '#00D84A',
          borderTopRightRadius: 18,
          borderBottomRightRadius: 18
        }} 
      />

      {/* Header */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <View style={{ flex: 1 }}>
          <Text 
            style={{ 
              fontSize: 18, 
              fontWeight: '700', 
              color: DesignTokens.colors.text.primary,
              textAlign: 'right'
            }}
            numberOfLines={1}
          >
            {getCompanyName(split.code, split.name)}
          </Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
              {split.code}
            </Text>
            {split.exchange && (
              <>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginHorizontal: 6 }}>•</Text>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                  {split.exchange}
                </Text>
              </>
            )}
          </View>
        </View>
        
        {split.is_reverse && (
          <View style={{ marginLeft: 8 }}>
            <AlertTriangle size={20} color={DesignTokens.colors.danger.main} strokeWidth={2} />
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
          backgroundColor: split.is_reverse ? 'rgba(239, 68, 68, 0.1)' : 'rgba(0, 216, 74, 0.1)',
          marginBottom: 12
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
          {split.is_reverse ? (
            <TrendingDown size={24} color={DesignTokens.colors.danger.main} strokeWidth={2.5} />
          ) : (
            <TrendingUp size={24} color="#00D84A" strokeWidth={2.5} />
          )}
          <Text 
            style={{ 
              fontSize: 36, 
              fontWeight: '800', 
              color: split.is_reverse ? DesignTokens.colors.danger.main : '#00D84A',
              marginHorizontal: 12
            }}
          >
            {split.ratio}
          </Text>
          <Scissors size={24} color={split.is_reverse ? DesignTokens.colors.danger.main : '#00D84A'} strokeWidth={2.5} />
        </View>
        
        <View 
          style={{ 
            paddingHorizontal: 16, 
            paddingVertical: 8, 
            borderRadius: 14, 
            backgroundColor: split.is_reverse ? 'rgba(239, 68, 68, 0.15)' : 'rgba(0, 216, 74, 0.15)'
          }}
        >
          <Text style={{ fontSize: 13, color: split.is_reverse ? DesignTokens.colors.danger.main : '#00D84A', fontWeight: '700', textAlign: 'center' }}>
            {split.is_reverse ? '⚠️ פיצול הפוך' : '✨ פיצול רגיל'}
          </Text>
        </View>
      </View>

      {/* Description */}
      <Text 
        style={{ 
          fontSize: 13, 
          color: DesignTokens.colors.text.secondary,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 12
        }}
      >
        {getSplitDescription()}
      </Text>

      {/* Date */}
      <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
        <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
          תאריך אפקטיבי:
        </Text>
        <Text style={{ fontSize: 13, color: DesignTokens.colors.text.primary, fontWeight: '700', marginRight: 6 }}>
          {formatDate(split.date)}
        </Text>
      </View>
    </Pressable>
  );
};

export default function SplitsTab() {
  const [splits, setSplits] = useState<Split[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadSplits = useCallback(async () => {
    try {
      console.log('✂️ Loading splits from Supabase');
      
      const { data, error } = await supabase
        .from('splits_calendar')
        .select('*')
        .order('date', { ascending: true })
        .limit(100);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      if (data) {
        console.log(`✅ Loaded ${data.length} splits`);
        setSplits(data);
      }
    } catch (error) {
      console.error('❌ Error loading splits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadSplits();
  };

  useEffect(() => {
    loadSplits();
  }, [loadSplits]);

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <Scissors size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ fontSize: 16, color: DesignTokens.colors.text.secondary, marginTop: 16, textAlign: 'center' }}>
        אין פיצולים זמינים כרגע
      </Text>
      <Text style={{ fontSize: 14, color: DesignTokens.colors.text.tertiary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני פיצולי מניות יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignTokens.colors.background.primary }}>
        <ActivityIndicator size="large" color="#00D84A" />
        <Text style={{ fontSize: 14, color: DesignTokens.colors.text.secondary, marginTop: 16 }}>
          טוען פיצולים...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      <FlatList
        data={splits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <SplitCard split={item} />}
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


