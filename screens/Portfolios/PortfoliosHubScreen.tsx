import React, { useCallback, useMemo } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ScreenChrome } from '../../components/ui/ScreenChrome';
import { MainDrawerScreenHeader } from '../../components/ui/MainDrawerScreenHeader';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import PortfoliosTab from './PortfoliosTab';
import { dispatchOpenMainDrawer, type DrawerParentNavigation } from '../../navigation/mainDrawerNav';
import { HapticFeedback, triggerDrawerMenuHaptic } from '../../utils/hapticFeedback';
import type { PortfoliosStackParamList } from '../../navigation/PortfoliosStack';
import { journalRtlRoot } from '../Journal/journalLayout';

type Nav = NativeStackNavigationProp<PortfoliosStackParamList, 'PortfoliosHub'>;

/**
 * יומן מסחר — רק התיקים האישיים.
 * טופולוגיית זכוכית: ScreenChrome (אורורה) → כותרת → רשימת כרטיסי תיקים.
 * מימין: תפריט מגירה · משמאל: כפתור ירוק + לתיק חדש.
 */
export default function PortfoliosHubScreen() {
  const navigation = useNavigation<Nav>();
  const tokens = useDesignTokens();

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
