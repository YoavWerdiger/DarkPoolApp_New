import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { MarketsErrorBoundary } from './MarketsErrorBoundary';
import { MarketsHeatmapsTab } from './tabs/MarketsHeatmapsTab';

export default function MarketsHeatmapScreen() {
  const navigation = useNavigation();
  const mainTabsHeight = useMainTabsHeight();

  const openMainDrawer = useCallback(() => {
    void triggerDrawerMenuHaptic();
    try {
      dispatchOpenMainDrawer(navigation as unknown as DrawerParentNavigation);
    } catch {
      /* noop */
    }
  }, [navigation]);

  return (
    <ScreenChrome withBrandWatermark>
      <StatusBar style="light" />
      <RNSafeAreaView style={styles.safe} edges={['top']}>
        <MainDrawerScreenHeader title="מפת חום" onMenuPress={openMainDrawer} />
        <View style={[styles.body, { marginBottom: Math.max(0, mainTabsHeight - 12) }]}>
          <MarketsErrorBoundary>
            <MarketsHeatmapsTab />
          </MarketsErrorBoundary>
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  body: {
    flex: 1,
    minHeight: 0,
  },
});
