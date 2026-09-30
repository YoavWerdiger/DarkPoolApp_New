import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, RefreshControl, ActivityIndicator, Pressable, SectionList } from 'react-native';
import { DollarSign, Calendar } from 'lucide-react-native';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../components/ui/appLayout';
import { APP_TYPE } from '../../components/ui/appType';
import { supabase } from '../../lib/supabase';
import { HapticFeedback } from '../../utils/hapticFeedback';
import UICard from '../../components/ui/UICard';

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
  const tokens = useDesignTokens();
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
    <UICard
      variant="soft"
      padding="none"
      style={{
        marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        marginBottom: APP_LAYOUT.cardStackGap,
        borderRadius: UI_CARD_RADIUS,
      }}
      contentContainerStyle={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 15,
        paddingHorizontal: APP_LAYOUT.cardPadding,
      }}
    >
      {/* Icon */}
      <View 
        style={{ 
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: `${tokens.colors.success.main}26`,
          alignItems: 'center',
          justifyContent: 'center',
          marginLeft: 12
        }}
      >
        <DollarSign size={22} color={tokens.colors.success.main} strokeWidth={2.5} />
      </View>

      {/* Company Info */}
      <View style={{ flex: 1 }}>
        <Text 
          style={{ 
            ...APP_TYPE.cardTitle,
            color: tokens.colors.text.primary,
            textAlign: 'right',
            marginBottom: APP_LAYOUT.cardTitleToSubtitleGap
          }}
          numberOfLines={1}
        >
          {getCompanyName(dividend.symbol)}
        </Text>
        <Text style={{ ...APP_TYPE.caption, color: tokens.colors.text.tertiary, textAlign: 'right' }}>
          {dividend.symbol}
        </Text>
      </View>

      {/* Date Badge */}
      <View 
        style={{ 
          paddingHorizontal: 10, 
          paddingVertical: 6, 
          borderRadius: 12, 
          backgroundColor: `${tokens.colors.success.main}1A`,
        }}
      >
        <Text style={{ ...APP_TYPE.caption2, color: tokens.colors.success.main }}>
          {getShortDate(dividend.date)}
        </Text>
      </View>
    </UICard>
  );
};

export default function DividendsTab() {
  const tokens = useDesignTokens();
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
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('dividends_calendar')
        .select('*')
        .gte('date', todayStr)
        .order('date', { ascending: true })
        .limit(200);
      
      if (error) {
        return;
      }
      
      if (data) {
        setDividends(data);
        setSections(groupDividendsByMonth(data));
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
      await loadDividends();
    } finally {
      void HapticFeedback.impactLight();
    }
  }, [loadDividends]);

  useEffect(() => {
    loadDividends();
  }, [loadDividends]);

  const renderSectionHeader = ({ section }: { section: DividendSection }) => (
    <View 
      style={{ 
        paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, 
        paddingVertical: APP_LAYOUT.groupLabelToContent,
        backgroundColor: 'transparent',
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <Calendar size={16} color={tokens.colors.text.secondary} strokeWidth={2} style={{ marginLeft: APP_LAYOUT.cardTitleToBodyGap }} />
      <Text style={{ ...APP_TYPE.groupLabel, color: tokens.colors.text.secondary }}>
        {section.title}
      </Text>
      <Text style={{ ...APP_TYPE.caption, color: tokens.colors.text.tertiary, marginLeft: APP_LAYOUT.stackGapSmall }}>
        ({section.data.length})
      </Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 }}>
      <DollarSign size={64} color={tokens.colors.text.tertiary} strokeWidth={1.5} />
      <Text style={{ ...APP_TYPE.body, color: tokens.colors.text.secondary, marginTop: APP_LAYOUT.componentGap, textAlign: 'center' }}>
        אין דיבידנדים זמינים כרגע
      </Text>
      <Text style={{ ...APP_TYPE.cardSubtitle, color: tokens.colors.text.tertiary, marginTop: APP_LAYOUT.groupLabelToContent, textAlign: 'center', paddingHorizontal: 40 }}>
        נתוני דיבידנדים יעודכנו בקרוב
      </Text>
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={tokens.colors.primary.main} />
        <Text style={{ ...APP_TYPE.body, color: tokens.colors.text.secondary, marginTop: APP_LAYOUT.componentGap }}>
          טוען דיבידנדים...
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <DividendCard dividend={item} />}
        renderSectionHeader={renderSectionHeader}
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
        contentContainerStyle={{ paddingTop: 8, paddingBottom: 24 }}
      />
    </View>
  );
}


