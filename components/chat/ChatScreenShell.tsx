// ============================================
// מעטפת מסכי צ'אט — רקע וכותרת כמו שאר האפליקציה
// ============================================

import React from 'react';
import { View, Text, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import {
  MAIN_SCREEN_HEADER_HP,
  MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT,
  MAIN_SCREEN_HEADER_TITLE_SIZE,
  MAIN_SCREEN_HEADER_TITLE_WEIGHT,
} from '../ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { ChatSessionBackdrop } from './ChatSessionBackdrop';

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
  subtitle?: string;
  onBack: () => void;
  rightSlot?: React.ReactNode;
  /** אייקון חזרה — ברירת מחדל chevron-forward (RTL) */
  backIcon?: keyof typeof Ionicons.glyphMap;
  /** עיצוב נוסף על שורת הכותרת */
  style?: ViewStyle;
  /**
   * מסך בתוך עץ `direction: 'rtl'` (למשל Dark Pool) —
   * משתמש ב-row במקום row-reverse כמו MainDrawerScreenHeader.
   */
  inRtlTree?: boolean;
};

/**
 * כותרת משנה (פרופיל / צ'אט / תשלום / Dark Pool) — אותו פריסת קצה
 * כמו `MainDrawerScreenHeader` (margin על הכפתור, לא padding+slot 72).
 */
export function ChatSubScreenHeader({
  title,
  subtitle,
  onBack,
  rightSlot,
  backIcon = 'chevron-forward',
  style,
  inRtlTree = false,
}: ChatSubScreenHeaderProps) {
  const tokens = useDesignTokens();
  const row = inRtlTree ? styles.subHeaderRowInRtlTree : styles.subHeaderRowApp;
  const backEdge = inRtlTree ? styles.sideBackInRtlTree : styles.sideBackApp;
  const endEdge = inRtlTree ? styles.sideEndInRtlTree : styles.sideEndApp;

  return (
    <View style={[styles.subHeaderRoot, style]}>
      <View style={[styles.subHeaderRow, row]}>
        <View style={[styles.sideSlot, backEdge]}>
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
          {subtitle ? (
            <Text
              style={[styles.subtitleText, { color: tokens.colors.text.secondary }]}
              numberOfLines={2}
            >
              {subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.sideSlot, endEdge]} pointerEvents="box-none">
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
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  subHeaderRowApp: {
    flexDirection: 'row-reverse',
  },
  subHeaderRowInRtlTree: {
    flexDirection: 'row',
  },
  /** כמו appHeaderActionsMenu ב־MainDrawer — מרווח קצה בלבד */
  sideSlot: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideBackApp: {
    marginRight: MAIN_SCREEN_HEADER_HP,
  },
  sideBackInRtlTree: {
    marginLeft: MAIN_SCREEN_HEADER_HP,
  },
  sideEndApp: {
    marginLeft: MAIN_SCREEN_HEADER_HP,
  },
  sideEndInRtlTree: {
    marginRight: MAIN_SCREEN_HEADER_HP,
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
    fontSize: MAIN_SCREEN_HEADER_TITLE_SIZE,
    fontWeight: MAIN_SCREEN_HEADER_TITLE_WEIGHT,
    letterSpacing: -0.35,
    lineHeight: MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  subtitleText: {
    marginTop: 3,
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 17,
    writingDirection: 'rtl',
  },
});
