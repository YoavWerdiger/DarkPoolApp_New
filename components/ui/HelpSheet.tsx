/**
 * הסבר קצר שעולה מלמטה (שיט זכוכית) — לא דיאלוג ממורכז.
 * כותרת + גוף על משטח השיט עצמו + «הבנתי» כגלולת זכוכית.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  type LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import BottomSheet, {
  BOTTOM_SHEET_EDGE_HANDLE_HEIGHT,
  useBottomSheetClose,
} from './BottomSheet/BottomSheet';
import { SheetActionButton } from './BottomSheet/SheetActionButton';
import { useDesignTokens } from './DesignTokens';
import {
  appBodyTextStyle,
  appSheetTitleStyle,
} from './appType';

const SCREEN_HEIGHT = Dimensions.get('window').height;

export const HELP_SHEET_GOT_IT = 'הבנתי';

export type HelpSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  body: string;
  gotItLabel?: string;
};

function HelpSheetBody({
  title,
  body,
  gotItLabel,
  onClose,
  onLayout,
}: {
  title: string;
  body: string;
  gotItLabel: string;
  onClose: () => void;
  onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const tokens = useDesignTokens();
  const animatedClose = useBottomSheetClose();
  const styles = useMemo(() => createStyles(tokens), [tokens]);

  const dismiss = useCallback(() => {
    if (animatedClose) {
      animatedClose();
      return;
    }
    onClose();
  }, [animatedClose, onClose]);

  return (
    <View onLayout={onLayout} style={styles.wrap}>
      <Text style={[styles.title, { color: tokens.colors.text.primary }]}>{title}</Text>
      <Text style={[styles.body, { color: tokens.colors.text.secondary }]}>{body}</Text>
      <SheetActionButton variant="secondary" label={gotItLabel} onPress={dismiss} />
    </View>
  );
}

export function HelpSheet({
  visible,
  onClose,
  title,
  body,
  gotItLabel = HELP_SHEET_GOT_IT,
}: HelpSheetProps) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);

  useEffect(() => {
    setContentHeight(null);
  }, [title, body]);

  const onContentLayout = useCallback((e: LayoutChangeEvent) => {
    const height = e.nativeEvent.layout.height;
    if (height > 0) {
      setContentHeight((prev) => (prev === height ? prev : height));
    }
  }, []);

  const snapPoint = useMemo(() => {
    if (contentHeight != null && contentHeight > 0) {
      const totalPx = contentHeight + BOTTOM_SHEET_EDGE_HANDLE_HEIGHT + 4;
      return Math.min(0.72, Math.max(0.22, totalPx / SCREEN_HEIGHT));
    }
    return 0.38;
  }, [contentHeight]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
    >
      <HelpSheetBody
        title={title}
        body={body}
        gotItLabel={gotItLabel}
        onClose={onClose}
        onLayout={onContentLayout}
      />
    </BottomSheet>
  );
}

/** כינוי — אותו שיט. */
export const InfoSheet = HelpSheet;

function createStyles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      alignSelf: 'stretch',
      paddingHorizontal: tokens.spacing.md,
      direction: 'rtl',
      gap: tokens.spacing.md,
    },
    title: {
      ...appSheetTitleStyle,
    },
    body: {
      ...appBodyTextStyle,
    },
  });
}
