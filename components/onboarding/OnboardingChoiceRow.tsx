import React, { useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, type ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../ui/appType';

const ROW_MIN_HEIGHT = 68;
const ICON_TILE = 44;
/** כניסה מדורגת — כל כרטיס 60ms אחרי הקודם */
const STAGGER_MS = 60;

interface OnboardingChoiceRowProps {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Allow tapping a selected row again to clear (useful for optional questions) */
  allowDeselect?: boolean;
  /** Multi-select row: square checkbox indicator, tapping always toggles */
  multiple?: boolean;
  /** אייקון קו (Ionicons) בריבוע מימין */
  icon?: keyof typeof Ionicons.glyphMap;
  /** לוגו מותג (ברוקר) במקום אייקון */
  logo?: ImageSourcePropType | string;
  /** מד רמה 1–4 (עמודות) במקום אייקון — לשאלת ניסיון */
  level?: number;
  /** שורת הסבר משנית מתחת לתווית */
  description?: string;
  /** מיקום ברשימה — לכניסה מדורגת */
  index?: number;
}

/**
 * כרטיס בחירה לשאלוני אונבורדינג (סגנון Cal AI):
 * כרטיס מלא, אימוג'י בריבוע, ובחירה = מילוי הפוך (טקסט ראשי כרקע) עם קפיצה קלה.
 */
const OnboardingChoiceRow: React.FC<OnboardingChoiceRowProps> = ({
  label,
  selected,
  onPress,
  allowDeselect = false,
  multiple = false,
  icon,
  logo,
  level,
  description,
  index = 0,
}) => {
  const tokens = useDesignTokens();
  const scale = useSharedValue(1);
  const fill = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    fill.value = withTiming(selected ? 1 : 0, { duration: 180 });
    if (selected) {
      scale.value = withSpring(1.02, { damping: 12, stiffness: 320 }, () => {
        scale.value = withSpring(1, { damping: 14, stiffness: 260 });
      });
    }
  }, [selected, fill, scale]);

  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));
  const selectedOverlay = useAnimatedStyle(() => ({ opacity: fill.value }));

  const handlePress = () => {
    if (selected && !allowDeselect && !multiple) return;
    void HapticFeedback.selection();
    onPress();
  };

  const labelColor = selected ? tokens.colors.text.inverse : tokens.colors.text.primary;
  const subColor = selected ? tokens.colors.text.inverse : tokens.colors.text.secondary;
  const glyphColor = selected ? tokens.colors.text.inverse : tokens.colors.text.primary;
  const hasLeading = !!icon || !!logo || level != null;

  return (
    <Animated.View entering={FadeInDown.delay(120 + index * STAGGER_MS).duration(360)}>
      <Pressable
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 16, stiffness: 400 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
        accessibilityRole={multiple ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: selected }}
        accessibilityLabel={label}
      >
        <Animated.View
          style={[
            styles.card,
            { backgroundColor: tokens.colors.background.cardSolid },
            cardAnim,
          ]}
        >
          {/* מילוי «נבחר» — דוהה פנימה מעל הכרטיס */}
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: tokens.colors.text.primary, borderRadius: UI_CARD_RADIUS },
              selectedOverlay,
            ]}
          />

          {hasLeading ? (
            <View
              style={[
                styles.iconTile,
                {
                  backgroundColor: selected
                    ? 'rgba(127,127,127,0.22)'
                    : tokens.colors.background.tertiary,
                },
              ]}
            >
              {logo ? (
                <Image
                  source={typeof logo === 'string' ? { uri: logo } : logo}
                  style={styles.logo}
                  contentFit="cover"
                  cachePolicy="memory-disk"
                  transition={120}
                />
              ) : level != null ? (
                <LevelBars level={level} color={glyphColor} />
              ) : icon ? (
                <Ionicons name={icon} size={21} color={glyphColor} />
              ) : null}
            </View>
          ) : null}

          <View style={styles.textCol}>
            <Text style={[styles.label, { color: labelColor }]} numberOfLines={2}>
              {label}
            </Text>
            {description ? (
              <Text style={[styles.description, { color: subColor }]} numberOfLines={2}>
                {description}
              </Text>
            ) : null}
          </View>

          {multiple ? (
            <View
              style={[
                styles.check,
                {
                  borderRadius: 7,
                  borderColor: selected ? tokens.colors.text.inverse : tokens.colors.text.tertiary,
                  backgroundColor: selected ? tokens.colors.text.inverse : 'transparent',
                },
              ]}
            >
              {selected ? (
                <Ionicons name="checkmark" size={15} color={tokens.colors.text.primary} />
              ) : null}
            </View>
          ) : selected ? (
            <Ionicons name="checkmark-circle" size={24} color={tokens.colors.text.inverse} />
          ) : null}
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
};

/** מד רמה בסגנון פס קליטה — 4 עמודות עולות, ממולאות עד level */
const LevelBars: React.FC<{ level: number; color: string }> = ({ level, color }) => (
  <View style={styles.bars}>
    {[1, 2, 3, 4].map((n) => (
      <View
        key={n}
        style={[
          styles.bar,
          { height: 6 + n * 4, backgroundColor: color, opacity: n <= level ? 1 : 0.22 },
        ]}
      />
    ))}
  </View>
);

const styles = StyleSheet.create({
  card: {
    // עץ האפליקציה LTR — row-reverse שם את האימוג'י מימין
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: APP_LAYOUT.stackGapTight,
    minHeight: ROW_MIN_HEIGHT,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: APP_LAYOUT.stackGapTight,
    borderRadius: UI_CARD_RADIUS,
    overflow: 'hidden',
  },
  iconTile: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: 14,
  },
  bars: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    height: 22,
  },
  bar: {
    width: 4,
    borderRadius: 2,
  },
  textCol: {
    flex: 1,
    gap: APP_LAYOUT.cardTitleToSubtitleGap,
  },
  description: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    fontWeight: APP_TYPE.cardSubtitle.fontWeight,
  },
  label: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
  },
  check: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/**
 * קונטיינר לרשימת אופציות בחירה.
 */
export const OnboardingChoiceGroup: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => <View style={{ gap: APP_LAYOUT.stackGapTight }}>{children}</View>;

export default OnboardingChoiceRow;
