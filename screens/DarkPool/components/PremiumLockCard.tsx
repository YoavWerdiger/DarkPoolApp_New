/**
 * PremiumLockCard.tsx
 * -----------------------------------------------------------------------------
 * כרטיס שמופיע מתחת ל-Top-3 free signals — קורא למשתמש לעבור פרימיום.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { APP_TYPE } from '../../../components/ui/appType';
import UIButton from '../../../components/ui/UIButton';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { darkPoolPhysicalRightText } from '../darkPoolLayout';

interface PremiumLockCardProps {
  onPress?: () => void;
  variant?: 'feed' | 'inline';
}

export function PremiumLockCard({ onPress, variant = 'feed' }: PremiumLockCardProps) {
  const tokens = useDesignTokens();
  return (
      <UICard
        variant="soft"
        glassIntensity="medium"
        padding="md"
        style={{
          borderRadius: UI_CARD_RADIUS,
          borderWidth: 0,
          backgroundColor: 'transparent',
        }}
      >
        <View style={styles.row}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: tokens.colors.background.navChrome,
              },
            ]}
          >
            <Ionicons name="lock-closed" size={20} color={tokens.colors.text.primary} />
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
            <UIButton
              title="שדרג לפרימיום"
              variant="primary"
              size="sm"
              icon="arrow-back"
              onPress={onPress}
              style={styles.cta}
            />
          </View>
        </View>
      </UICard>
  );
}

const styles = StyleSheet.create({
  row: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 0,
    marginLeft: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    ...darkPoolPhysicalRightText,
  },
  subtitle: {
    marginTop: APP_LAYOUT.cardTitleToSubtitleGap,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardSubtitle.fontWeight,
    ...darkPoolPhysicalRightText,
  },
  cta: {
    alignSelf: 'flex-start',
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
  },
});
