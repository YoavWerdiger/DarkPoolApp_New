import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { MAIN_SCREEN_HEADER_HP } from '../../../components/ui/MainDrawerScreenHeader';
import { appScreenSubtitleStyle, appScreenTitleStyle } from '../../../components/ui/appType';
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
            glassIntensity="light"
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
          style={[styles.title, appScreenTitleStyle, { color: tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            style={[styles.subtitle, appScreenSubtitleStyle, { color: tokens.colors.text.tertiary }]}
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
    // עץ RTL של מסך התיק — row (לא row-reverse)
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 8,
    direction: 'rtl',
  },
  sideBack: {
    alignItems: 'center',
    justifyContent: 'center',
    marginStart: MAIN_SCREEN_HEADER_HP,
  },
  sideEnd: {
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: MAIN_SCREEN_HEADER_HP,
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
  title: {},
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 17,
  },
});
