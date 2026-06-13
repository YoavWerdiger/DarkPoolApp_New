/**
 * PremiumLockCard.tsx
 * -----------------------------------------------------------------------------
 * כרטיס שמופיע מתחת ל-Top-3 free signals — קורא למשתמש לעבור פרימיום.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface PremiumLockCardProps {
  onPress?: () => void;
  variant?: 'feed' | 'inline';
}

export function PremiumLockCard({ onPress, variant = 'feed' }: PremiumLockCardProps) {
  const tokens = useDesignTokens();
  return (
    <Pressable
      onPress={
        onPress
          ? () => {
              void HapticFeedback.medium();
              onPress();
            }
          : undefined
      }
    >
      <UICard
        variant="glass"
        glassIntensity="medium"
        padding="md"
        style={{
          borderRadius: tokens.borderRadius.xl,
          borderWidth: 1.5,
          borderColor: tokens.colors.border.accent,
        }}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: tokens.colors.primary.dim,
                borderColor: tokens.colors.border.accent,
              },
            ]}
          >
            <Ionicons name="lock-closed" size={20} color={tokens.colors.primary.main} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
              {variant === 'feed'
                ? 'גלה את כל ה-Dark Pool בזמן אמת'
                : 'תוכן פרימיום נעול'}
            </Text>
            <Text style={[styles.subtitle, { color: tokens.colors.text.secondary }]}>
              משתמשי חינם רואים 3 סיגנלים מובילים עם השהייה של 15 דקות. עבור לפרימיום
              להתראות, היסטוריה מלאה ועדכונים בזמן אמת.
            </Text>
            <View
              style={[
                styles.cta,
                {
                  backgroundColor: tokens.colors.primary.main,
                },
              ]}
            >
              <Text style={[styles.ctaText, { color: tokens.colors.text.inverse }]}>
                שדרג לפרימיום
              </Text>
              <Ionicons
                name="arrow-back"
                size={16}
                color={tokens.colors.text.inverse}
              />
            </View>
          </View>
        </View>
      </UICard>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'left',
    writingDirection: 'rtl',
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
