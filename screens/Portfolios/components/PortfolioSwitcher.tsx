import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_TYPE, appScreenTitleStyle } from '../../../components/ui/appType';
import { HapticFeedback } from '../../../utils/hapticFeedback';
import type { Portfolio } from '../portfolioTypes';

const DROPDOWN_MS = 200;
const DROPDOWN_MAX_H = 360;

interface Props {
  portfolios: Portfolio[];
  selectedId: string;
  onSelect: (portfolioId: string) => void;
  onCreate: () => void;
}

/**
 * שם התיק + שברון בכותרת היומן. לחיצה פותחת דרופדאון מלמעלה למעבר בין תיקים.
 */
export function PortfolioSwitcher({ portfolios, selectedId, onSelect, onCreate }: Props) {
  const tokens = useDesignTokens();
  const anchorRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchorBottom, setAnchorBottom] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;

  const selected = portfolios.find((p) => p.id === selectedId);

  useEffect(() => {
    if (!open) return;
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: DROPDOWN_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, progress]);

  const show = useCallback(() => {
    void HapticFeedback.selection();
    anchorRef.current?.measureInWindow((_x, y, _w, h) => {
      setAnchorBottom(y + h + 6);
      setOpen(true);
    });
  }, []);

  const hide = useCallback(
    (after?: () => void) => {
      Animated.timing(progress, {
        toValue: 0,
        duration: DROPDOWN_MS - 40,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setOpen(false);
        after?.();
      });
    },
    [progress],
  );

  const panelStyle = {
    opacity: progress,
    transform: [
      { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) },
      { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] }) },
    ],
  };

  return (
    <>
      <Pressable
        ref={anchorRef}
        onPress={show}
        hitSlop={8}
        style={styles.anchor}
        accessibilityRole="button"
        accessibilityLabel={`תיק: ${selected?.name ?? ''}. החלפת תיק`}
      >
        <Text
          style={[appScreenTitleStyle, styles.anchorTitle, { color: tokens.colors.text.primary }]}
          numberOfLines={1}
        >
          {selected?.name ?? ''}
        </Text>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={tokens.colors.text.secondary}
        />
      </Pressable>

      <Modal visible={open} transparent animationType="none" statusBarTranslucent onRequestClose={() => hide()}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => hide()}>
          <Animated.View
            style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.35)', opacity: progress }]}
          />
        </Pressable>
        <Animated.View
          style={[
            styles.panel,
            {
              top: anchorBottom,
              backgroundColor: tokens.colors.background.cardSolid,
              borderColor: tokens.colors.border.divider,
            },
            panelStyle,
          ]}
        >
          <ScrollView style={{ maxHeight: DROPDOWN_MAX_H }} bounces={false}>
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
                      {
                        color: tokens.colors.text.primary,
                        fontWeight: active ? '600' : '400',
                      },
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
    justifyContent: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  anchorTitle: {
    flexShrink: 1,
  },
  panel: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    direction: 'rtl',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
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
});
