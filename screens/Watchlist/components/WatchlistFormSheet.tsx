import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../../../components/ui/BottomSheet/BottomSheet';
import UIButton from '../../../components/ui/UIButton';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT } from '../../../components/ui/appLayout';
import { appPhysicalRightText } from '../../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldPlaceholderColor,
  formFieldShellStyle,
} from '../../../components/ui/formControl';
import { ChatSheetTopoHeader, useChatFitContentSnap } from '../../../components/chat/ChatBottomSheet';

type ListSheetProps = {
  visible: boolean;
  mode: 'create' | 'rename';
  value: string;
  onChangeValue: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

/**
 * יצירה / שינוי שם של רשימת מעקב — שיט לפי הטופו (כמו «קבוצה חדשה»):
 * BottomSheet בגובה התוכן, כותרת עם שברון סגירה, שדה טופס וכפתור CTA אחד.
 */
export function WatchlistListNameSheet({
  visible,
  mode,
  value,
  onChangeValue,
  onClose,
  onSubmit,
}: ListSheetProps) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.4, 0.9, 0.2, `${visible}`);
  const canSubmit = value.trim().length > 0;

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
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      avoidKeyboard
      contentPaddingBottom={0}
    >
      <View style={[styles.root, { paddingBottom: Math.max(insets.bottom, 12) }]} onLayout={onContentLayout}>
        <ChatSheetTopoHeader title={mode === 'rename' ? 'שינוי שם' : 'רשימה חדשה'} onClose={onClose} />

        <Text style={formFieldLabelStyle({ tokens, focused })}>שם הרשימה</Text>
        <View style={[formFieldShellStyle({ tokens, focused }), styles.fieldShell]}>
          <TextInput
            value={value}
            onChangeText={onChangeValue}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="לדוגמה: טק · מדדים · מעקב שבועי"
            placeholderTextColor={formFieldPlaceholderColor(tokens)}
            style={[formFieldInputStyle(tokens), appPhysicalRightText, styles.fieldInput]}
            maxLength={60}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canSubmit) onSubmit();
            }}
          />
        </View>

        <View style={styles.footer}>
          <UIButton
            title={mode === 'rename' ? 'שמירה' : 'יצירת רשימה'}
            variant="primary"
            size="lg"
            fullWidth
            disabled={!canSubmit}
            onPress={onSubmit}
          />
        </View>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  root: {
    direction: 'rtl',
    paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
    paddingTop: 4,
  },
  fieldShell: {
    borderRadius: 16,
    paddingHorizontal: APP_LAYOUT.cardPadding,
  },
  fieldInput: {
    alignSelf: 'stretch',
    minHeight: 48,
  },
  footer: {
    marginTop: APP_LAYOUT.componentGap,
  },
});
