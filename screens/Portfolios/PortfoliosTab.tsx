import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import {
  listPortfolios,
  loadPortfolioSummary,
  deletePortfolio,
} from '../../services/portfolios';
import type { Portfolio, PortfolioSummary } from './portfolioTypes';
import { PortfolioCard } from './components/PortfolioCard';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfoliosHub'>;

interface PortfolioWithSummary {
  portfolio: Portfolio;
  summary: PortfolioSummary | null;
}

/**
 * רשימת התיקים האישיים — בתוך PortfoliosHub (מגירה → תיקי השקעות).
 */
export default function PortfoliosTab() {
  const tokens = useDesignTokens();
  const navigation = useNavigation<Nav>();
  const mainTabsHeight = useMainTabsHeight();
  const [items, setItems] = useState<PortfolioWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const portfolios = await listPortfolios();
      const enriched = await Promise.all(
        portfolios.map(async (p) => {
          try {
            const summary = await loadPortfolioSummary(p.id, p.currency);
            return { portfolio: p, summary };
          } catch {
            return { portfolio: p, summary: null };
          }
        })
      );
      setItems(enriched);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const handleCreate = useCallback(() => {
    navigation.navigate('CreatePortfolio');
  }, [navigation]);

  const handleOpen = useCallback(
    (portfolioId: string) => {
      navigation.navigate('PortfolioDetail', { portfolioId });
    },
    [navigation]
  );

  const handleDelete = useCallback(
    (p: Portfolio) => {
      Alert.alert(
        'מחיקת תיק',
        `האם למחוק את "${p.name}"? פעולה זו אינה ניתנת לביטול והטרנזקציות יימחקו.`,
        [
          { text: 'ביטול', style: 'cancel' },
          {
            text: 'מחיקה',
            style: 'destructive',
            onPress: async () => {
              try {
                await deletePortfolio(p.id);
                await load();
              } catch (err) {
                Alert.alert('שגיאה', 'לא הצלחנו למחוק את התיק');
              }
            },
          },
        ]
      );
    },
    [load]
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        root: { flex: 1 },
        emptyWrap: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: tokens.layout.screenPadding,
          paddingBottom: mainTabsHeight + 40,
        },
        emptyIconWrap: {
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: 'rgba(0, 200, 5, 0.10)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 18,
        },
        emptyTitle: {
          fontSize: 20,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          textAlign: 'center',
          marginBottom: 8,
        },
        emptyText: {
          fontSize: 14,
          color: tokens.colors.text.secondary,
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: 24,
        },
        emptyBtn: {
          flexDirection: 'row-reverse',
          alignItems: 'center',
          gap: 8,
          paddingHorizontal: 22,
          paddingVertical: 14,
          borderRadius: 28,
          backgroundColor: tokens.colors.primary.main,
        },
        emptyBtnText: {
          fontSize: 16,
          fontWeight: '700',
          color: tokens.colors.text.inverse,
        },
        list: {
          paddingHorizontal: tokens.layout.screenPadding,
          paddingTop: 4,
          paddingBottom: mainTabsHeight + 88,
        },
      }),
    [tokens, mainTabsHeight]
  );

  if (loading) {
    return (
      <View style={[styles.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator color={tokens.colors.primary.main} />
      </View>
    );
  }

  if (items.length === 0) {
    return (
      <View style={styles.root}>
        <View style={styles.emptyWrap}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="briefcase" size={36} color={tokens.colors.primary.main} />
          </View>
          <Text style={styles.emptyTitle}>עוד אין לך תיק השקעות</Text>
          <Text style={styles.emptyText}>
            צור תיק חדש כדי לעקוב אחרי הביצועים, חלוקת הנכסים, ולקבל אנליזה מקצועית של ההשקעות שלך.
          </Text>
          <TouchableOpacity
            style={styles.emptyBtn}
            onPress={handleCreate}
            activeOpacity={0.85}
          >
            <Ionicons name="add" size={22} color={tokens.colors.text.inverse} />
            <Text style={styles.emptyBtnText}>צור תיק חדש</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.portfolio.id}
        renderItem={({ item }) => (
          <PortfolioCard
            portfolio={item.portfolio}
            summary={item.summary}
            onPress={() => handleOpen(item.portfolio.id)}
            onLongPress={() => handleDelete(item.portfolio)}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={tokens.colors.primary.main}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
