import React, { useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UICard from '../../../components/ui/UICard';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import { HapticFeedback } from '../../../utils/hapticFeedback';

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
          <UICard
            variant="glass"
            glassIntensity="medium"
            padding="none"
            style={styles.card}
          >
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
                <TouchableOpacity
                  style={[styles.btn, styles.btnPrimary]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    onSubmit();
                  }}
                >
                  <Text style={styles.btnPrimaryText}>
                    {mode === 'rename' ? 'שמור' : 'צור רשימה'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => {
                    void HapticFeedback.selection();
                    onClose();
                  }}
                >
                  <Text style={styles.btnGhostText}>ביטול</Text>
                </TouchableOpacity>
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
          ...StyleSheet.absoluteFillObject,
          backgroundColor: tokens.colors.background.overlayHeavy,
        },
        sheetWrap: {
          paddingHorizontal: 16,
        },
        card: {
          borderRadius: tokens.borderRadius['2xl'],
          overflow: 'hidden',
        },
        body: {
          paddingHorizontal: 20,
          paddingTop: 10,
          paddingBottom: 16,
          gap: 10,
        },
        handle: {
          alignSelf: 'center',
          width: 36,
          height: 4,
          borderRadius: 2,
          backgroundColor: 'rgba(255,255,255,0.18)',
          marginBottom: 8,
        },
        title: {
          color: tokens.colors.text.primary,
          fontSize: 18,
          fontWeight: '800',
          ...tokens.rtlText,
          marginBottom: 4,
        },
        label: {
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          fontWeight: '600',
          ...tokens.rtlText,
        },
        input: {
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderRadius: tokens.borderRadius.xl,
          paddingHorizontal: 14,
          paddingVertical: 13,
          color: tokens.colors.text.primary,
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
          fontSize: 15,
          ...tokens.rtlText,
        },
        actions: {
          flexDirection: 'row-reverse',
          gap: 8,
          marginTop: 4,
        },
        btn: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: 13,
          borderRadius: tokens.borderRadius.button,
        },
        btnPrimary: {
          backgroundColor: tokens.colors.primary.main,
        },
        btnGhost: {
          backgroundColor: 'rgba(255,255,255,0.06)',
          borderWidth: 1,
          borderColor: tokens.colors.border.subtle,
        },
        btnPrimaryText: {
          color: tokens.colors.text.inverse,
          fontSize: 15,
          fontWeight: '800',
        },
        btnGhostText: {
          color: tokens.colors.text.secondary,
          fontSize: 15,
          fontWeight: '600',
        },
      }),
    [tokens]
  );
}
