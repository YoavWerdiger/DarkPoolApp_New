import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Dimensions,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_TYPE, appPhysicalRightText } from '../../../components/ui/appType';
import { UI_CARD_RADIUS, APP_LAYOUT } from '../../../components/ui/appLayout';
import { SHEET_BACKDROP_OPACITY } from '../../../components/ui/BottomSheet/BottomSheet';
import {
  SHEET_CLOSE_MS,
  SHEET_OPEN_MS,
  SHEET_EASE_IN_BEZIER,
  SHEET_EASE_OUT_BEZIER,
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
 * אותה שפת תנועה כמו BottomSheet — רק בכיוון ההפוך. נסגר בלחיצה על הרקע או בבחירה.
 */
export function PortfolioSwitcher({ portfolios, selectedId, onSelect, onCreate }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [sheetH, setSheetH] = useState(SCREEN_HEIGHT * 0.6);
  const translateY = useRef(new Animated.Value(-SCREEN_HEIGHT)).current;
  const closingRef = useRef(false);

  const selected = portfolios.find((p) => p.id === selectedId);

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

  return (
    <>
      <View style={styles.anchorWrap}>
        <Pressable
          onPress={show}
          hitSlop={8}
          style={styles.anchor}
          accessibilityRole="button"
          accessibilityLabel={`תיק: ${selected?.name ?? ''}. החלפת תיק`}
        >
          <Text
            style={[styles.anchorTitle, { color: tokens.colors.text.primary }]}
            numberOfLines={1}
          >
            {selected?.name ?? ''}
          </Text>
          <Ionicons name="chevron-down" size={20} color={tokens.colors.text.tertiary} />
        </Pressable>
      </View>

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
          onLayout={(e) => setSheetH(e.nativeEvent.layout.height)}
          style={[
            styles.sheet,
            {
              paddingTop: insets.top + 8,
              backgroundColor: tokens.colors.background.primary,
              borderColor: tokens.colors.border.divider,
              transform: [{ translateY }],
            },
          ]}
        >
          <Text style={[styles.sheetTitle, { color: tokens.colors.text.primary }]}>
            התיקים שלי
          </Text>

          <View style={[styles.card, { backgroundColor: tokens.colors.background.cardSolid }]}>
            <ScrollView style={{ maxHeight: LIST_MAX_H }} bounces={false}>
              {portfolios.map((p, i) => {
                const active = p.id === selectedId;
                const last = i === portfolios.length - 1;
                return (
                  <View key={p.id}>
                    <TouchableOpacity
                      onPress={() => {
                        if (!active) void HapticFeedback.selection();
                        hide(active ? undefined : () => onSelect(p.id));
                      }}
                      activeOpacity={0.6}
                      style={styles.row}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                    >
                      <Text
                        style={[styles.rowText, { color: tokens.colors.text.primary }]}
                        numberOfLines={1}
                      >
                        {p.name}
                      </Text>
                      {active ? (
                        <Ionicons name="checkmark" size={20} color={tokens.colors.primary.main} />
                      ) : null}
                    </TouchableOpacity>
                    {last ? null : (
                      <View style={[styles.divider, { backgroundColor: tokens.colors.border.divider }]} />
                    )}
                  </View>
                );
              })}
            </ScrollView>
          </View>

          <TouchableOpacity
            onPress={() => hide(onCreate)}
            activeOpacity={0.6}
            style={[styles.card, styles.row, { backgroundColor: tokens.colors.background.cardSolid }]}
            accessibilityRole="button"
            accessibilityLabel="תיק חדש"
          >
            <Text style={[styles.rowText, { color: tokens.colors.text.primary }]}>תיק חדש</Text>
            <Ionicons name="add" size={22} color={tokens.colors.text.primary} />
          </TouchableOpacity>
        </Animated.View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  // עוגן פיזי לימין (כמו כותרת הדף) — לא תלוי ב-direction של ההורה
  anchorWrap: {
    direction: 'ltr',
    alignItems: 'flex-end',
    alignSelf: 'stretch',
  },
  anchor: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    maxWidth: '100%',
  },
  /** שם תיק = screenTitle (24/700) לפי הטופולוגיה */
  anchorTitle: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.screenTitle.fontSize,
    fontWeight: APP_TYPE.screenTitle.fontWeight,
    lineHeight: APP_TYPE.screenTitle.lineHeight,
    flexShrink: 1,
  },
  sheet: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingBottom: APP_LAYOUT.screenPaddingHorizontal,
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
  /** כותרת מחוץ לכרטיס — sectionTitle 22/700, 12 עד התוכן */
  sheetTitle: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.sectionTitle.fontSize,
    fontWeight: APP_TYPE.sectionTitle.fontWeight,
    lineHeight: APP_TYPE.sectionTitle.lineHeight,
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: 8,
    marginBottom: APP_LAYOUT.cardTitleToBodyGap,
  },
  card: {
    marginHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    marginBottom: APP_LAYOUT.cardStackGap,
    borderRadius: UI_CARD_RADIUS,
    overflow: 'hidden',
  },
  /** שורת תפריט — paddingVertical 15, ריפוד כרטיס 16 */
  row: {
    direction: 'rtl',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: APP_LAYOUT.cardPadding,
    paddingVertical: 15,
  },
  rowText: {
    ...appPhysicalRightText,
    fontSize: APP_TYPE.cardBody.fontSize,
    fontWeight: APP_TYPE.cardBody.fontWeight,
    lineHeight: APP_TYPE.cardBody.lineHeight,
    flex: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: APP_LAYOUT.cardPadding,
  },
});
