import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Pressable,
  SectionList
} from 'react-native';
import { DollarSign, Calendar } from 'lucide-react-native';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { supabase } from '../../lib/supabase';

interface Dividend {
  id: string
  symbol: string
  date: string
}

interface DividendSection {
  title: string
  data: Dividend[]
}

const DividendCard: React.FC<{ dividend: Dividend }> = ({ dividend }) => {
  const getCompanyName = (symbol: string) => {
    const companies: { [key: string]: string } = {
      'AAPL.US': 'Apple',
      'MSFT.US': 'Microsoft',
      'JPM.US': 'JPMorgan',
      'JNJ.US': 'Johnson & Johnson',
      'PG.US': 'Procter & Gamble',
      'KO.US': 'Coca-Cola',
      'PEP.US': 'PepsiCo',
      'WMT.US': 'Walmart',
      'CVX.US': 'Chevron',
      'XOM.US': 'ExxonMobil',
      'VZ.US': 'Verizon',
      'T.US': 'AT&T',
      'PFE.US': 'Pfizer',
      'ABBV.US': 'AbbVie',
      'MRK.US': 'Merck',
      'IBM.US': 'IBM',
      'INTC.US': 'Intel',
      'CSCO.US': 'Cisco',
      'MCD.US': 'McDonald\'s',
      'BAC.US': 'Bank of America'
    };
    return companies[symbol] || symbol.replace('.US', '');
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  };

  const getShortDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('he-IL', { day: 'numeric', month: 'short' });
  };

  return (
    <Pressable
      style={{
        marginHorizontal: 16,
        marginBottom: 10,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: DesignTokens.colors.background.secondary,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 4,
        borderWidth: 1,
        borderColor: 'rgba(0, 216, 74, 0.15)',
        flexDirection: 'row-reverse',
        alignItems: 'center'
      }}
    >
      {/* Icon */}
      <View 
        style={{ 
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: 'rgba(0, 216, 74, 0.15)',
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 12
        }}
      >
        <DollarSign size={22} color="#00D84A" strokeWidth={2.5} />
      </View>

      {/* Company Info */}
      <View style={{ flex: 1 }}>
        <Text 
          style={{ 
            fontSize: 16, 
            fontWeight: '700', 
            color: DesignTokens.colors.text.primary,
            textAlign: 'right',
            marginBottom: 2
          }}
          numberOfLines={1}
        >
          {getCompanyName(dividend.symbol)}
        </Text>
        <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, textAlign: 'right' }}>
          {dividend.symbol}
        </Text>
      </View>

      {/* Date Badge */}
      <View 
        style={{ 
          paddingHorizontal: 10, 
          paddingVertical: 6, 
          borderRadius: 12, 
          backgroundColor: 'rgba(0, 216, 74, 0.1)',
          borderWidth: 1,
          borderColor: 'rgba(0, 216, 74, 0.3)'
        }}
      >
        <Text style={{ fontSize: 11, color: '#00D84A', fontWeight: '700' }}>
          {getShortDate(dividend.date)}
        </Text>
      </View>
    </Pressable>
  );
};

export default function DividendsTab() {
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [sections, setSections] = useState<DividendSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const groupDividendsByMonth = (dividends: Dividend[]): DividendSection[] => {
    const grouped: { [key: string]: Dividend[] } = {};

    dividends.forEach(dividend => {
      const date = new Date(dividend.date);
      const monthYear = date.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
      
      if (!grouped[monthYear]) {
        grouped[monthYear] = [];
      }
      grouped[monthYear].push(dividend);
    });

    return Object.entries(grouped).map(([title, data]) => ({
      title,
      data: data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    }));
  };

  const loadDividends = useCallback(async () => {
    try {
      console.log('💰 Loading dividends from Supabase');
      
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('dividends_calendar')
        .select('*')
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(200);
      
      if (error) {
        console.error('❌ Supabase error:', error);
        return;
      }
      
      if (data) {
        console.log(`✅ Loaded ${data.length} dividends`);
        setDividends(data);
        setSections(groupDividendsByMonth(data));
      }
    } catch (error) {
      console.error('❌ Error loading dividends:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDividends();
  };

  useEffect(() => {
    loadDividends();
  }, [loadDividends]);

  const renderSectionHeader = ({ section }: { section: DividendSection }) => (
    <View 
      style={{ 
        paddingHorizontal: 16, 
        paddingVertical: 10,
        backgroundColor: DesignTokens.colors.background.primary,
        flexDirection: 'row-reverse',
        alignItems: 'center'
      }}
    >
      <Calendar size={16} color={DesignTokens.colors.text.secondary} strokeWidth={2} style={{ marginLeft: 8 }} />
      <Text style={{ fontSize: 14, fontWeight: '700', color: DesignTokens.colors.text.secondary }}>
        {section.title}
      </Text>
      <Text style={{ fontSize: 12, color: DesignTokens.colors.text.tertiary, marginRight: 8 }}>
        ({section.data.length})
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <DollarSign size={64} color={DesignTokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ fontSize: 16, color: DesignTokens.colors.text.secondary, marginTop: 16, textAlign: 'center' }}>
        אין דיבידנדים זמינים כרגע
      </Text>
      <Text style={{ fontSize: 14, color: DesignTokens.colors.text.tertiary, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני דיבידנדים יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DesignTokens.colors.background.primary }}>
        <ActivityIndicator size="large" color="#00D84A" />
        <Text style={{ fontSize: 14, color: DesignTokens.colors.text.secondary, marginTop: 16 }}>
          טוען דיבידנדים...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: DesignTokens.colors.background.primary }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DividendCard dividend={item} />}
        renderSectionHeader={renderSectionHeader}
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
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      />
    </View>
  );
}


