import React, { ReactNode, useCallback } from 'react';
import { View } from 'react-native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useNavigation } from '@react-navigation/native';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';

type Props = {
  title: string;
  children: ReactNode;
  /** כפתור בצד ימין בכותרת (למשל מחיקה במסך כתבות שמורות) */
  headerRight?: ReactNode;
};

/**
 * מעטפת אחידה למסכי חדשות / יומן / דיווחים — מרווח תחתון אחד (בלי כפל עם תוכן פנימי).
 */
export function NewsScreenShell({ title, children, headerRight }: Props) {
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
      <RNSafeAreaView style={{ flex: 1 }} edges={['top']}>
        <MainDrawerScreenHeader title={title} onMenuPress={openMainDrawer} rightAccessory={headerRight} />
        <View
          style={{
            flex: 1,
            minHeight: 0,
            marginBottom: Math.max(0, mainTabsHeight - 12),
          }}
        >
          {children}
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
}
