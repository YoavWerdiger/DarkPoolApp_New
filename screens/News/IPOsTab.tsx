import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable
} from 'react-native';
import { Rocket, Calendar, DollarSign } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../lib/supabase';

interface IPO {
  id: string
  code: string
  name: string | null
  exchange: string | null
  currency: string | null
  start_date: string | null
  filing_date: string | null
  amended_date: string | null
  price_from: number
  price_to: number
  offer_price: number
  shares: number
  deal_type: string
}

const IPOCard: React.FC<{ ipo: IPO }> = ({ ipo }) => {
  const getDealTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'priced': return 'DesignTokens.colors.success.main';
      case 'expected': return '#F59E0B';
      case 'filed': return '#3B82F6';
      case 'amended': return '#8B5CF6';
      default: return DesignTokens.colors.text.tertiary;
    }
  };

  const getDealTypeLabel = (type: string) => {
    switch (type.toLowerCase()) {
      case 'priced': return 'נקבע מחיר';
      case 'expected': return 'צפוי';
      case 'filed': return 'הוגש';
      case 'amended': return 'עודכן';
      default: return type;
    }
  };

  const formatDate = (dateStr: string | null): string => {
    if (!dateStr) return 'לא ידוע';
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatShares = (shares: number): string => {
    if (shares === 0) return 'לא ידוע';
    if (shares >= 1e9) return `${(shares / 1e9).toFixed(2)}B`;
    if (shares >= 1e6) return `${(shares / 1e6).toFixed(2)}M`;
    if (shares >= 1e3) return `${(shares / 1e3).toFixed(2)}K`;
    return shares.toString();
  };

  const hasPricing = ipo.price_from > 0 || ipo.price_to > 0 || ipo.offer_price > 0;

  return (
    <Pressable
      style={{
        marginHorizontal: 16,
        marginBottom: 12,
        borderRadius: 18,
        paddingVertical: 14,
        paddingHorizontal: 16,
        backgroundColor: DesignTokens.colors.background.secondary,
        borderColor: 'rgba(255,255,255,0.06)'
      }}
    >
      {/* Header - Company Name & Status */}
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
            {ipo.name || ipo.code}
          </Text>
          <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginTop: 4 }}>
            <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
              {ipo.code}
            </Text>
            {ipo.exchange && (
              <>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginHorizontal: 6 }}>•</Text>
                <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary }}>
                  {ipo.exchange}
                </Text>
              </>
            )}
          </View>
        </View>
        
        <View 
          style={{ 
            paddingHorizontal: 12, 
            paddingVertical: 6, 
            borderRadius: 14, 
            backgroundColor: `${getDealTypeColor(ipo.deal_type)}20`,
            marginLeft: 8
          }}
        >
          <Text style={{ fontSize: 12, color: getDealTypeColor(ipo.deal_type), fontWeight: '700' }}>
            {getDealTypeLabel(ipo.deal_type)}
          </Text>
        </View>
      </View>

      {/* Date Info */}
      {ipo.start_date && (
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
          <Calendar size={14} color="#3B82F6" strokeWidth={2} style={{ marginLeft: 8 }} />
          <Text style={{ fontSize: 13, color: DesignTokens.colors.text.primary, fontWeight: '600' }}>
            תאריך מסחר ראשון:
          </Text>
          <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '700', marginRight: 6 }}>
            {formatDate(ipo.start_date)}
          </Text>
        </View>
      )}

      {/* Pricing & Shares */}
      {(hasPricing || ipo.shares > 0) && (
        <View style={{ flexDirection: 'row-reverse', marginTop: 8 }}>
          {hasPricing && (
              <DollarSign size={16} color={DesignTokens.colors.text.tertiary} strokeWidth={2} style={{ marginBottom: 4 }} />
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>
                {ipo.offer_price > 0 ? 'מחיר הצעה' : 'טווח מחירים'}
              </Text>
              {ipo.offer_price > 0 ? (
                <Text style={{ fontSize: 17, fontWeight: '700', color: 'DesignTokens.colors.success.main' }}>
                  ${ipo.offer_price.toFixed(2)}
                </Text>
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: DesignTokens.colors.text.primary }}>
                  ${ipo.price_from.toFixed(2)} - ${ipo.price_to.toFixed(2)}
                </Text>
              )}
            </View>
          )}

          {ipo.shares > 0 && (
              <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginBottom: 4 }}>
                מניות
              </Text>
              <Text style={{ fontSize: 17, fontWeight: '700', color: DesignTokens.colors.text.primary }}>
                {formatShares(ipo.shares)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Filing Dates */}
      {(ipo.filing_date || ipo.amended_date) && (
        <View style={{ flexDirection: 'row-reverse', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' }}>
          {ipo.filing_date && (
            <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary, marginLeft: 12 }}>
              הוגש: {formatDate(ipo.filing_date)}
            </Text>
          )}
          {ipo.amended_date && (
            <Text style={{ fontSize: 11, color: DesignTokens.colors.text.tertiary }}>
              עודכן: {formatDate(ipo.amended_date)}
            </Text>
          )}
        </View>
      )}
    </Pressable>
  );
};

export default function IPOsTab() {
  const [ipos, setIpos] = useState<IPO[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadIPOs = useCallback(async () => {
    try {
      console.log('🚀 Loading IPOs from Supabase');
      
      const { data, error } = await supabase
        .from('ipos_calendar')
        .select('*')
        .order('start_date', { ascending: true })
        .limit(100);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      if (data) {
        console.log(`✅ Loaded ${data.length} IPOs`);
        setIpos(data);
      }
    } catch (error) {
      console.error('❌ Error loading IPOs:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadIPOs();
  };

  useEffect(() => {
    loadIPOs();
  }, [loadIPOs]);

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <Rocket size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ fontSize: 16, color: DesignTokens.colors.text.secondary, marginTop: 16, textAlign: 'center' }}>
        אין הנפקות זמינות כרגע
      </Text>
      <Text style={{ fontSize: 14, color: DesignTokens.colors.text.tertiary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני הנפקות יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignTokens.colors.background.primary }}>
        <ActivityIndicator size="large" color="DesignTokens.colors.success.main" />
        <Text style={{ fontSize: 14, color: DesignTokens.colors.text.secondary, marginTop: 16 }}>
          טוען הנפקות...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      <FlatList
        data={ipos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <IPOCard ipo={item} />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="DesignTokens.colors.success.main"
            colors={['DesignTokens.colors.success.main']}
          />
        }
        ListEmptyComponent={renderEmptyState}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 16, paddingBottom: 24 }}
      />
    </View>
  );
}


