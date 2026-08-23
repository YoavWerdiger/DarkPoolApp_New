import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  MAIN_SCREEN_HEADER_HP,
  MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT,
  MAIN_SCREEN_HEADER_TITLE_SIZE,
  MAIN_SCREEN_HEADER_TITLE_WEIGHT,
} from '../../../components/ui/MainDrawerScreenHeader';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../../components/ui/DayNavBlurButton';
import { HapticFeedback } from '../../../utils/hapticFeedback';

interface Props {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  /** Action פנימי משני בין הכותרת לכפתור הקצה (לדוגמה כפתור "+"). */
  extraAction?: React.ReactNode;
  /** Action קבוע בקצה שמאל, מראה־ראי לכפתור החזרה הימני. */
  moreAction?: React.ReactNode;
  /** תאימות לאחור — אם הועבר, מוצג ב־slot של ה־moreAction. */
  rightAction?: React.ReactNode;
}

/** Header אחיד למסכי Portfolios — אותם מרווחי קצה כמו ChatSubScreenHeader / MainDrawer */
export function PortfolioScreenHeader({
  title,
  subtitle,
  onBack,
  extraAction,
  moreAction,
  rightAction,
}: Props) {
  const tokens = useDesignTokens();
  const edgeAction = moreAction ?? rightAction;
  return (
    <View style={styles.row}>
      <View style={styles.sideBack}>
        {onBack ? (
          <DayNavBlurButton
            onPress={() => {
              void HapticFeedback.impactLight();
              onBack();
            }}
            size={DRAWER_MENU_BUTTON_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="חזרה"
          >
            <Ionicons
              name="chevron-forward"
              size={24}
              color={tokens.colors.text.primary}
            />
          </DayNavBlurButton>
        ) : (
          <View style={styles.sideSpacer} />
        )}
      </View>
      <View style={styles.center} pointerEvents="box-none">
        <Text
          style={[styles.title, { color: tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, { color: tokens.colors.text.tertiary }]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        ) : null}
      </View>
      {extraAction ? <View style={styles.extraSlot}>{extraAction}</View> : null}
      <View style={styles.sideEnd}>{edgeAction ?? <View style={styles.sideSpacer} />}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  sideBack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: MAIN_SCREEN_HEADER_HP,
  },
  sideEnd: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: MAIN_SCREEN_HEADER_HP,
  },
  sideSpacer: {
    width: DRAWER_MENU_BUTTON_SIZE,
    height: DRAWER_MENU_BUTTON_SIZE,
  },
  extraSlot: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  center: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 4,
  },
  title: {
    fontSize: MAIN_SCREEN_HEADER_TITLE_SIZE,
    fontWeight: MAIN_SCREEN_HEADER_TITLE_WEIGHT,
    letterSpacing: -0.35,
    lineHeight: MAIN_SCREEN_HEADER_TITLE_LINE_HEIGHT,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 3,
    textAlign: 'center',
    lineHeight: 17,
  },
});
