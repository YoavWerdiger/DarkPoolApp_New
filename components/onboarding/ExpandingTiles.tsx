import React, { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { HapticFeedback } from '../../utils/hapticFeedback';

const TILE_H = 300;
const FLEX_ON = 1.9;
const FLEX_OFF = 1;
const SPRING = { damping: 17, stiffness: 190, mass: 0.7 };

type Option = {
  label: string;
  value: string;
  description?: string;
  icon?: React.ComponentProps<typeof Ionicons>['name'];
};

type Props = {
  options: Option[];
  value: string;
  onChange: (v: string) => void;
};

/**
 * עמודות זו לצד זו: הנבחרת מתרחבת (flex מונפש) ומתמלאת הפוך,
 * ובה מופיע ההסבר; האחרות מצטמצמות. RTL — הראשונה מימין.
 */
export function ExpandingTiles({ options, value, onChange }: Props) {
  return (
    <View style={styles.row}>
      {options.map((o, i) => (
        <Tile
          key={o.value}
          option={o}
          index={i}
          selected={o.value === value}
          anySelected={!!value}
          onPress={() => {
            if (o.value === value) return;
            void HapticFeedback.selection();
            onChange(o.value);
          }}
        />
      ))}
    </View>
  );
}

function Tile({
  option,
  index,
  selected,
  anySelected,
  onPress,
}: {
  option: Option;
  index: number;
  selected: boolean;
  anySelected: boolean;
  onPress: () => void;
}) {
  const tokens = useDesignTokens();
  const flex = useSharedValue(selected ? FLEX_ON : FLEX_OFF);
  const on = useSharedValue(selected ? 1 : 0);
  const press = useSharedValue(1);

  useEffect(() => {
    flex.value = withSpring(selected ? FLEX_ON : FLEX_OFF, SPRING);
    on.value = withTiming(selected ? 1 : 0, { duration: 200 });
  }, [selected, flex, on]);

  const bg0 = tokens.colors.background.cardSolid;
  const bg1 = tokens.colors.text.primary;
  const tileStyle = useAnimatedStyle(() => ({
    flex: flex.value,
    backgroundColor: interpolateColor(on.value, [0, 1], [bg0, bg1]),
    transform: [{ scale: press.value }],
    // כשיש בחירה — האחרות קצת דהויות
    opacity: anySelected && on.value < 0.5 ? 0.72 : 1,
  }));

  const fg = selected ? tokens.colors.text.inverse : tokens.colors.text.primary;

  return (
    <Animated.View
      entering={FadeInDown.delay(300 + index * 80).duration(380)}
      style={[styles.tileWrap, tileStyle]}
    >
      <Pressable
        onPress={onPress}
        onPressIn={() => {
          press.value = withSpring(0.96, { damping: 15, stiffness: 400 });
        }}
        onPressOut={() => {
          press.value = withSpring(1, { damping: 14, stiffness: 300 });
        }}
        style={styles.tile}
        accessibilityRole="radio"
        accessibilityState={{ checked: selected }}
        accessibilityLabel={`${option.label}${option.description ? `, ${option.description}` : ''}`}
      >
        {option.icon ? <Ionicons name={option.icon} size={selected ? 40 : 30} color={fg} /> : null}
        <Text style={[styles.label, { color: fg }]} numberOfLines={2}>
          {option.label}
        </Text>
        {selected && option.description ? (
          <Animated.Text
            entering={FadeIn.delay(120).duration(220)}
            style={[styles.desc, { color: fg }]}
            numberOfLines={3}
          >
            {option.description}
          </Animated.Text>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    // row-reverse: האופציה הראשונה מימין (RTL)
    flexDirection: 'row-reverse',
    gap: APP_LAYOUT.stackGapSmall,
    height: TILE_H,
  },
  tileWrap: {
    borderRadius: UI_CARD_RADIUS,
    overflow: 'hidden',
  },
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: APP_LAYOUT.stackGapSmall,
    gap: APP_LAYOUT.stackGapTight,
  },
  label: {
    fontSize: APP_TYPE.cardTitle.fontSize,
    lineHeight: APP_TYPE.cardTitle.lineHeight,
    fontWeight: APP_TYPE.cardTitle.fontWeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  desc: {
    fontSize: APP_TYPE.cardSubtitle.fontSize,
    lineHeight: APP_TYPE.cardSubtitle.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
    opacity: 0.85,
  },
});
