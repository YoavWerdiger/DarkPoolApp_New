import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { useDesignTokens } from '../ui/DesignTokens';

type OptionDef = { key: string; label: string; icon: any; danger: boolean };

interface OptionItemProps {
  option: OptionDef;
  index: number;
  isLast: boolean;
  onSelect: (key: string) => void;
}

function OptionItem({ option, index, isLast, onSelect }: OptionItemProps) {
  const tokens = useDesignTokens();
  const handlePress = () => {
    HapticFeedback.selection();
    onSelect(option.key);
  };

  return (
    <View
      style={[
        styles.option,
        { borderBottomColor: tokens.colors.border.divider },
        isLast && styles.lastOption,
      ]}
    >
      <TouchableOpacity
        style={[
          styles.optionTouchable,
          {
            paddingHorizontal: tokens.spacing.xl,
            paddingVertical: tokens.spacing.lg,
            minHeight: tokens.layout.listItemHeight,
          },
        ]}
        onPress={handlePress}
        accessibilityLabel={option.label}
        accessibilityHint={option.label}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.optionLabel,
          {
            fontSize: tokens.typography.fontSize.lg,
            color: tokens.colors.text.primary,
          },
          option.danger && { color: tokens.colors.text.danger },
        ]}>
          {option.label}
        </Text>
        <Ionicons 
          name={option.icon as any} 
          size={tokens.typography.fontSize.xl} 
          color={option.danger ? tokens.colors.text.danger : tokens.colors.text.primary}
          style={[styles.optionIcon, { marginLeft: tokens.spacing.md }]}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function ContextMenu({ onSelect, isAdmin = false, isMe = false, canEdit = true }: { onSelect: (key: string) => void; isAdmin?: boolean; isMe?: boolean; canEdit?: boolean }) {
  const DesignTokens = useDesignTokens();
  const options: OptionDef[] = useMemo(() => {
    const base: OptionDef[] = [
      { key: 'reply', label: 'השב', icon: 'arrow-undo-outline', danger: false },
      { key: 'forward', label: 'העבר', icon: 'arrow-redo-outline', danger: false },
      { key: 'copy', label: 'העתק', icon: 'copy-outline', danger: false },
      // הצג "ערוך" רק אם זו ההודעה של המשתמש ובעלת id אמיתי (לא אופטימיסטית)
      ...(isMe && canEdit ? [{ key: 'edit', label: 'ערוך', icon: 'create-outline', danger: false } as OptionDef] : []),
      { key: 'star', label: 'סמן בכוכב', icon: 'star-outline', danger: false },
      // הצג "הצמד" רק למנהלים
      ...(isAdmin ? [{ key: 'pin', label: 'הצמד', icon: 'pin-outline', danger: false } as OptionDef] : []),
      // מחק רק להודעות שלי, מחק לכולם לאדמין או להודעות שלי
      ...(isMe ? [{ key: 'delete', label: 'מחק אצלי', icon: 'trash-outline', danger: true } as OptionDef] : []),
      // הצג "מחק לכולם" אם זו ההודעה שלי או אם אני אדמין
      ...((isMe || isAdmin) ? [{ key: 'deleteForEveryone', label: 'מחק לכולם', icon: 'people-outline', danger: true } as OptionDef] : []),
    ];
    return base;
  }, [isAdmin, isMe, canEdit]);

  return (
    <View style={styles.dialog}>
      {/* Handle Bar */}
      <View
        style={{
          alignSelf: 'center',
          width: DesignTokens.layout.screenPadding * 2,
          height: DesignTokens.spacing.micro * 2,
          borderRadius: DesignTokens.borderRadius.xs,
          marginBottom: DesignTokens.spacing.sm,
          backgroundColor: DesignTokens.colors.primary.main,
        }}
      />
      
      {/* Options */}
      <View style={styles.optionsContainer}>
        {options.map((opt, index) => (
          <OptionItem
            key={opt.key}
            option={opt}
            index={index}
            isLast={index === options.length - 1}
            onSelect={onSelect}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  dialog: {
    backgroundColor: 'transparent',
    width: '100%',
  },
  optionsContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    paddingBottom: 0,
    position: 'relative',
    zIndex: 1,
  },
  option: {
    borderBottomWidth: 1,
  },
  optionTouchable: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  lastOption: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  optionIcon: {
    width: 20,
  },
  optionLabel: {
    fontWeight: '500',
    flex: 1,
    textAlign: 'right'
  },
});
