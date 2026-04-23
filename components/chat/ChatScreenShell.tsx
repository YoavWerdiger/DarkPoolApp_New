// ============================================
// מעטפת מסכי צ'אט — רקע וכותרת כמו שאר האפליקציה
// ============================================

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { MAIN_SCREEN_HEADER_HP } from '../ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { ChatSessionBackdrop } from './ChatSessionBackdrop';

/** כמו רוחב צד ב־MainDrawerScreenHeader — לאזן כותרת ממורכזת */
const SUB_SCREEN_HEADER_SIDE = 72;

type ChatScreenShellProps = {
  children: React.ReactNode;
};

export function ChatScreenShell({ children }: ChatScreenShellProps) {
  const tokens = useDesignTokens();
  return (
    <View style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}>
      <ChatSessionBackdrop />
      {children}
    </View>
  );
}

type ChatSubScreenHeaderProps = {
  title: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  /** אייקון חזרה — ברירת מחדל chevron-forward (RTL) */
  backIcon?: keyof typeof Ionicons.glyphMap;
  /** עיצוב נוסף על שורת הכותרת */
  style?: ViewStyle;
};

/**
 * כותרת משנה (פרופיל / צ'אט / תשלום) — כמו מסכי שורש:
 * כפתור זכוכית עגול בצד, כותרת ממורכזת, מקום סימטרי בצד השני.
 */
export function ChatSubScreenHeader({
  title,
  onBack,
  rightSlot,
  backIcon = 'chevron-forward',
  style,
}: ChatSubScreenHeaderProps) {
  const tokens = useDesignTokens();
  return (
    <View style={[styles.subHeaderRoot, style]}>
      <View style={styles.subHeaderRow}>
        <View style={styles.sideSlot}>
          <DayNavBlurButton
            onPress={onBack}
            size={DRAWER_MENU_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="חזרה"
          >
            <Ionicons name={backIcon} size={24} color={tokens.colors.text.primary} />
          </DayNavBlurButton>
        </View>
        <View style={styles.titleBlock}>
          <Text style={[styles.titleText, { color: tokens.colors.text.primary }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        <View style={[styles.sideSlot, styles.sideSlotEnd]} pointerEvents="box-none">
          {rightSlot ?? <View style={styles.sideSpacer} />}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  subHeaderRoot: {
    width: '100%',
  },
  subHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: MAIN_SCREEN_HEADER_HP,
    paddingVertical: 14,
  },
  sideSlot: {
    minWidth: SUB_SCREEN_HEADER_SIDE,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  sideSlotEnd: {
    justifyContent: 'flex-end',
  },
  sideSpacer: {
    width: DRAWER_MENU_BUTTON_SIZE,
    height: DRAWER_MENU_BUTTON_SIZE,
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
});
