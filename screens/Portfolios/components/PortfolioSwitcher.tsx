import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_TYPE } from '../../../components/ui/appType';
import { UI_CARD_RADIUS, APP_LAYOUT } from '../../../components/ui/appLayout';
import { SHEET_BACKDROP_OPACITY } from '../../../components/ui/BottomSheet/BottomSheet';
import {
  SHEET_CLOSE_MS,
  SHEET_OPEN_MS,
  SHEET_EASE_IN_BEZIER,
  SHEET_EASE_OUT_BEZIER,
  SHEET_SNAP_SPRING,
} from '../../../components/ui/BottomSheet/sheetMotion';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { Portfolio } from '../portfolioTypes';

const SCREEN_HEIGHT = Dimensions.get('window').height;
const LIST_MAX_H = SCREEN_HEIGHT * 0.5;
const EASE_OUT = Easing.bezier(
  SHEET_EASE_OUT_BEZIER.x1,
  SHEET_EASE_OUT_BEZIER.y1,
  SHEET_EASE_OUT_BEZIER.x2,
  SHEET_EASE_OUT_BEZIER.y2,
);
const EASE_IN = Easing.bezier(
  SHEET_EASE_IN_BEZIER.x1,
  SHEET_EASE_IN_BEZIER.y1,
  SHEET_EASE_IN_BEZIER.x2,
  SHEET_EASE_IN_BEZIER.y2,
);

interface Props {
  portfolios: Portfolio[];
  selectedId: string;
  onSelect: (portfolioId: string) => void;
  onCreate: () => void;
}

/**
 * שם התיק + שברון בכותרת היומן. לחיצה פותחת שיט עליון (יורד מקצה המסך) למעבר בין תיקים.
 * אותה שפת תנועה כמו BottomSheet — רק בכיוון ההפוך; גרירה למעלה סוגרת.
 */
export function PortfolioSwitcher({ portfolios, selectedId, onSelect, onCreate }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [sheetH, setSheetH] = useState(SCREEN_HEIGHT * 0.6);
  const translateY = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const closingRef = useRef(false);

  const selected = portfolios.find((p) => p.id === selectedId);
  const fill = tokens.colors.background.cardSolid;

  const backdropOpacity = translateY.interpolate({
    inputRange: [-sheetH, 0],
    outputRange: [0, SHEET_BACKDROP_OPACITY],
    extrapolate: 'clamp',
  });

  useEffect(() => {
    if (!open) return;
    closingRef.current = false;
    translateY.setValue(-sheetH);
    Animated.timing(translateY, {
      toValue: 0,
      duration: SHEET_OPEN_MS,
      easing: EASE_OUT,
      useNativeDriver: true,
    }).start();
    // sheetH נמדד אחרי mount — לא מתחילים עלייה שנייה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, translateY]);

  const show = useCallback(() => {
    void HapticFeedback.selection();
    setOpen(true);
  }, []);

  const hide = useCallback(
    (after?: () => void) => {
      if (closingRef.current) return;
      closingRef.current = true;
      Animated.timing(translateY, {
        toValue: -sheetH,
        duration: SHEET_CLOSE_MS,
        easing: EASE_IN,
        useNativeDriver: true,
      }).start(() => {
        setOpen(false);
        after?.();
      });
    },
    [sheetH, translateY],
  );

  const hideRef = useRef(hide);
  hideRef.current = hide;

  const pan = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx),
      onPanResponderMove: (_e, g) => {
        // למעלה — עוקב אחרי האצבע; למטה — התנגדות קלה
        translateY.setValue(g.dy < 0 ? g.dy : g.dy * 0.15);
      },
      onPanResponderRelease: (_e, g) => {
        if (g.dy < -60 || g.vy < -0.5) {
          hideRef.current();
          return;
        }
        Animated.spring(translateY, {
          toValue: 0,
          damping: SHEET_SNAP_SPRING.damping,
          stiffness: SHEET_SNAP_SPRING.stiffness,
          mass: SHEET_SNAP_SPRING.mass,
          overshootClamping: true,
          useNativeDriver: true,
        }).start();
      },
    }),
  ).current;

  return (
    <>
      <Pressable
        onPress={show}
        hitSlop={8}
        style={styles.anchor}
        accessibilityRole="button"
        accessibilityLabel={`תיק: ${selected?.name ?? ''}. החלפת תיק`}
      >
        <Text
          style={[APP_TYPE.cardTitle, styles.anchorTitle, { color: tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          {selected?.name ?? ''}
        </Text>
        <Ionicons name="chevron-down" size={18} color={tokens.colors.text.tertiary} />
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => hide()}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={() => hide()}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
          />
        </Pressable>

        <Animated.View
          {...pan.panHandlers}
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              paddingTop: insets.top + 8,
              backgroundColor: fill,
              borderColor: tokens.colors.border.divider,
              transform: [{ translateY }],
            },
          ]}
        >
          {/* מילוי מעל הקצה — שלא ייראה פס בזמן התנגדות גרירה למטה */}
          <View style={[styles.topOverscroll, { backgroundColor: fill }]} />

          <Text
            style={[APP_TYPE.sectionTitle, styles.sheetTitle, { color: tokens.colors.text.primary }]}
          >
            התיקים שלי
          </Text>

          <ScrollView style={{ maxHeight: LIST_MAX_H }} bounces={false}>
            {portfolios.map((p) => {
              const active = p.id === selectedId;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => {
                    if (!active) void HapticFeedback.selection();
                    hide(active ? undefined : () => onSelect(p.id));
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    { borderBottomColor: tokens.colors.border.divider },
                    pressed ? { opacity: 0.6 } : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      APP_TYPE.body,
                      styles.rowText,
                      { color: tokens.colors.text.primary },
                    ]}
                    numberOfLines={1}
                  >
                    {p.name}
                  </Text>
                  {active ? (
                    <Ionicons name="checkmark" size={20} color={tokens.colors.primary.main} />
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => hide(onCreate)}
            style={({ pressed }) => [styles.row, styles.createRow, pressed ? { opacity: 0.6 } : null]}
            accessibilityRole="button"
            accessibilityLabel="תיק חדש"
          >
            <Text style={[APP_TYPE.body, styles.rowText, { color: tokens.colors.primary.main }]}>
              תיק חדש
            </Text>
            <Ionicons name="add" size={20} color={tokens.colors.primary.main} />
          </Pressable>

          <View style={styles.handleWrap}>
            <View style={[styles.handle, { backgroundColor: tokens.colors.text.tertiary }]} />
          </View>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  anchor: {
    flexDirection: 'row',
    direction: 'rtl',
    alignItems: 'center',
    alignSelf: 'flex-end',
    gap: 4,
    maxWidth: '100%',
  },
  anchorTitle: {
    flexShrink: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    borderBottomLeftRadius: UI_CARD_RADIUS,
    borderBottomRightRadius: UI_CARD_RADIUS,
    borderBottomWidth: StyleSheet.hairlineWidth,
    direction: 'rtl',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 24,
    elevation: 16,
  },
  topOverscroll: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -200,
    height: 200,
  },
  sheetTitle: {
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: 8,
    paddingBottom: 6,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  createRow: {
    borderBottomWidth: 0,
  },
  rowText: {
    flex: 1,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: 4,
    paddingBottom: 10,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    opacity: 0.5,
  },
});
