import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../../components/ui/UICard';
import UIButton from '../../../components/ui/UIButton';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../../../components/ui/appLayout';
import { appSheetTitleStyle } from '../../../components/ui/appType';
import {
  formFieldInputStyle,
  formFieldLabelStyle,
  formFieldShellStyle,
} from '../../../components/ui/formControl';

type ListSheetProps = {
  visible: boolean;
  mode: 'create' | 'rename';
  value: string;
  onChangeValue: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
};

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
  const styles = useSheetStyles();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheetWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <UICard variant="soft" padding="none" style={styles.card}>
            <View style={styles.body}>
              <View style={styles.handle} />
              <Text style={styles.title}>
                {mode === 'rename' ? 'שינוי שם רשימה' : 'רשימת מעקב חדשה'}
              </Text>
              <Text style={styles.label}>שם הרשימה</Text>
              <TextInput
                style={styles.input}
                value={value}
                onChangeText={onChangeValue}
                placeholder="לדוגמה: טק · מדדים · מעקב שבועי"
                placeholderTextColor={tokens.colors.text.tertiary}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={onSubmit}
              />
              <View style={styles.actions}>
                <View style={styles.actionSlot}>
                  <UIButton
                    title={mode === 'rename' ? 'שמור' : 'צור רשימה'}
                    variant="primary"
                    fullWidth
                    onPress={onSubmit}
                  />
                </View>
                <View style={styles.actionSlot}>
                  <UIButton
                    title="ביטול"
                    variant="secondary"
                    fullWidth
                    onPress={onClose}
                  />
                </View>
              </View>
            </View>
          </UICard>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function useSheetStyles() {
  const tokens = useDesignTokens();
  return useMemo(
    () =>
      StyleSheet.create({
        flex: { flex: 1, justifyContent: 'flex-end' },
        backdrop: {
          ...StyleSheet.absoluteFill,
          backgroundColor: tokens.colors.background.overlayHeavy,
        },
        sheetWrap: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
        },
        card: {
          borderRadius: UI_CARD_RADIUS,
          overflow: 'hidden',
        },
        body: {
          paddingHorizontal: APP_LAYOUT.cardPadding,
          paddingTop: 10,
          paddingBottom: APP_LAYOUT.cardPadding,
        },
        handle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: tokens.colors.border.divider,
          marginBottom: APP_LAYOUT.groupLabelToContent,
        },
        title: {
          ...appSheetTitleStyle,
          color: tokens.colors.text.primary,
          marginBottom: APP_LAYOUT.sectionHeaderToContent,
        },
        label: formFieldLabelStyle({ tokens, focused: false }),
        input: {
          ...formFieldShellStyle({ tokens, focused: false }),
          ...formFieldInputStyle(),
          borderRadius: tokens.borderRadius.md,
          minHeight: 48,
          paddingHorizontal: APP_LAYOUT.cardPadding,
          color: tokens.colors.text.primary,
        },
        actions: {
          flexDirection: 'row-reverse',
          gap: APP_LAYOUT.groupLabelToContent,
          marginTop: APP_LAYOUT.stackGapSmall,
        },
        actionSlot: {
          flex: 1,
        },
      }),
    [tokens]
  );
}
