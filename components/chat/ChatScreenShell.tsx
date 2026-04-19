// ============================================
// מעטפת מסכי צ'אט — רקע וכותרת כמו שאר האפליקציה
// ============================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../ui/UICard';
import { useDesignTokens } from '../ui/DesignTokens';
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
  onBack: () => void;
  rightSlot?: React.ReactNode;
  /** אייקון חזרה — ברירת מחדל chevron-forward (RTL) */
  backIcon?: keyof typeof Ionicons.glyphMap;
  cardStyle?: ViewStyle;
};

export function ChatSubScreenHeader({
  title,
  onBack,
  rightSlot,
  backIcon = 'chevron-forward',
  cardStyle,
}: ChatSubScreenHeaderProps) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="inputGlass"
      padding="md"
      style={[
        {
          marginHorizontal: 0,
          marginTop: 0,
          borderTopLeftRadius: 0,
          borderTopRightRadius: 0,
          borderBottomLeftRadius: tokens.borderRadius['2xl'],
          borderBottomRightRadius: tokens.borderRadius['2xl'],
        },
        cardStyle,
      ]}
    >
      <View style={styles.headerRow}>
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="חזרה"
          style={styles.backBtn}
          onPress={onBack}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Ionicons name={backIcon} size={22} color={tokens.colors.text.secondary} />
        </TouchableOpacity>
        <Text
          style={[
            styles.title,
            {
              fontSize: tokens.typography.fontSize.base,
              fontWeight: tokens.typography.fontWeight.semibold as any,
              color: tokens.colors.text.primary,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {rightSlot ?? <View style={styles.rightSpacer} />}
      </View>
    </UICard>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backBtn: {
    padding: 8,
    borderRadius: 50,
  },
  title: {
    flex: 1,
    textAlign: 'center',
  },
  rightSpacer: {
    width: 32,
  },
});
