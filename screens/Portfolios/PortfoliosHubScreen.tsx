import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute, useFocusEffect, type RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import PortfoliosTab from './PortfoliosTab';
import PortfolioDetailScreen from './PortfolioDetailScreen';
import { listPortfolios } from '../../services/portfolios/portfolioService';
import type { Portfolio } from './portfolioTypes';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { journalRtlRoot } from '../Journal/journalLayout';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfoliosHub'>;
type Route = RouteProp<PortfoliosStackParamList, 'PortfoliosHub'>;

const LAST_PORTFOLIO_KEY = 'journal:lastPortfolioId';

/**
 * יומן מסחר — מציג ישירות תיק אחד; שם התיק בכותרת עם שברון פותח דרופדאון למעבר בין תיקים.
 * בלי תיקים: מסך ריק עם יצירת תיק (PortfoliosTab).
 */
export default function PortfoliosHubScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const tokens = useDesignTokens();
  const [portfolios, setPortfolios] = useState<Portfolio[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectPortfolio = useCallback((portfolioId: string) => {
    setSelectedId(portfolioId);
    AsyncStorage.setItem(LAST_PORTFOLIO_KEY, portfolioId).catch(() => {});
  }, []);

  const loadPortfolios = useCallback(async () => {
    try {
      const [list, saved] = await Promise.all([
        listPortfolios(),
        AsyncStorage.getItem(LAST_PORTFOLIO_KEY).catch(() => null),
      ]);
      setPortfolios(list);
      setSelectedId((current) => {
        const valid = (id: string | null) => !!id && list.some((p) => p.id === id);
        if (valid(current)) return current;
        if (valid(saved)) return saved;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      console.error('load portfolios:', e);
      setPortfolios([]);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadPortfolios();
    }, [loadPortfolios])
  );

  // חזרה מיצירת תיק — בוחרים את התיק החדש
  const requestedId = route.params?.selectPortfolioId;
  useEffect(() => {
    if (!requestedId) return;
    selectPortfolio(requestedId);
    navigation.setParams({ selectPortfolioId: undefined });
  }, [requestedId, selectPortfolio, navigation]);

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  const handleCreate = useCallback(() => {
    void HapticFeedback.medium();
    navigation.navigate('CreatePortfolio');
  }, [navigation]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        safeArea: { ...journalRtlRoot, backgroundColor: 'transparent' },
        content: { flex: 1, minHeight: 0, backgroundColor: 'transparent' },
        createBtn: {
          width: DRAWER_MENU_BUTTON_SIZE,
          height: DRAWER_MENU_BUTTON_SIZE,
          borderRadius: DRAWER_MENU_BUTTON_SIZE / 2,
          backgroundColor: tokens.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [tokens]
  );

  if (portfolios === null) {
    return (
      <ScreenChrome>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={tokens.colors.primary.main} />
        </View>
      </ScreenChrome>
    );
  }

  if (portfolios.length > 0 && selectedId) {
    return (
      <PortfolioDetailScreen
        embedded={{
          portfolioId: selectedId,
          portfolios,
          onSelect: selectPortfolio,
          onCreate: handleCreate,
          onMenuPress: openMainDrawer,
          onMissing: loadPortfolios,
        }}
      />
    );
  }

  return (
    <ScreenChrome>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <MainDrawerScreenHeader
          title="יומן מסחר"
          onMenuPress={openMainDrawer}
          inRtlTree
          rightAccessory={
            <TouchableOpacity
              style={styles.createBtn}
              onPress={handleCreate}
              activeOpacity={0.88}
              accessibilityRole="button"
              accessibilityLabel="תיק חדש"
            >
              <Ionicons name="add" size={26} color={tokens.colors.text.inverse} />
            </TouchableOpacity>
          }
        />

        <View style={styles.content}>
          <PortfoliosTab />
        </View>
      </SafeAreaView>
    </ScreenChrome>
  );
}
