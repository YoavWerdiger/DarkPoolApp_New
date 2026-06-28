import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { DayNavBlurButton, HEADER_BACK_BTN_SIZE } from '../../../components/ui/DayNavBlurButton';
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

/** Header אחיד לכל מסכי Portfolios – RTL, primary בלחיצת חזרה */
export function PortfolioScreenHeader({
  title,
  subtitle,
  onBack,
  extraAction,
  moreAction,
  rightAction,
}: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const padH = Math.max(16, insets.left, insets.right);
  const edgeAction = moreAction ?? rightAction;
  return (
    <View
      style={[styles.row, { paddingLeft: padH, paddingRight: padH }]}
    >
      <View style={styles.sideEdge}>
        {onBack ? (
          <DayNavBlurButton
            onPress={() => {
              void HapticFeedback.impactLight();
              onBack();
            }}
            size={HEADER_BACK_BTN_SIZE}
            glassIntensity="subtle"
            accessibilityLabel="חזרה"
          >
            <Ionicons
              name="chevron-forward"
              size={22}
              color={tokens.colors.text.primary}
            />
          </DayNavBlurButton>
        ) : null}
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
      <View style={styles.sideEdge}>{edgeAction}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingVertical: 14,
  },
  sideEdge: {
    width: HEADER_BACK_BTN_SIZE,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
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
    paddingHorizontal: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
    textAlign: 'center',
  },
});
