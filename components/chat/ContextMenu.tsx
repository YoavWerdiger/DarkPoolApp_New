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
  const handlePress = () => {
    HapticFeedback.selection();
    onSelect(option.key);
  };

  return (
    <View
      style={[
        styles.option,
        isLast && styles.lastOption,
      ]}
    >
      <TouchableOpacity
        style={styles.optionTouchable}
        onPress={handlePress}
        accessibilityLabel={option.label}
        accessibilityHint={option.label}
        activeOpacity={0.7}
      >
        <Text style={[
          styles.optionLabel, 
          option.danger && { color: '#FF3B30' }
        ]}>
          {option.label}
        </Text>
        <Ionicons 
          name={option.icon as any} 
          size={20} 
          color={option.danger ? '#FF3B30' : '#FFFFFF'}
          style={styles.optionIcon}
        />
      </TouchableOpacity>
    </View>
  );
}

export default function ContextMenu({ onSelect, isAdmin = false, isMe = false }: { onSelect: (key: string) => void; isAdmin?: boolean; isMe?: boolean }) {
  const DesignTokens = useDesignTokens();
  const options: OptionDef[] = useMemo(() => {
    const base: OptionDef[] = [
      { key: 'reply', label: 'השב', icon: 'arrow-undo-outline', danger: false },
      { key: 'forward', label: 'העבר', icon: 'arrow-redo-outline', danger: false },
      { key: 'copy', label: 'העתק', icon: 'copy-outline', danger: false },
      // הצג "ערוך" רק אם זו ההודעה של המשתמש
      ...(isMe ? [{ key: 'edit', label: 'ערוך', icon: 'create-outline', danger: false } as OptionDef] : []),
      { key: 'star', label: 'סמן בכוכב', icon: 'star-outline', danger: false },
      // הצג "הצמד" רק למנהלים
      ...(isAdmin ? [{ key: 'pin', label: 'הצמד', icon: 'pin-outline', danger: false } as OptionDef] : []),
      { key: 'delete', label: 'מחק', icon: 'trash-outline', danger: true },
    ];
    return base;
  }, [isAdmin, isMe]);

  return (
    <View style={styles.dialog}>
      {/* Handle Bar */}
      <View style={[styles.handleBar, { backgroundColor: DesignTokens.colors.primary.main }]} />
      
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
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  optionTouchable: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 56,
    backgroundColor: 'transparent',
  },
  lastOption: {
    borderBottomWidth: 0,
    marginBottom: 0,
  },
  optionIcon: {
    marginLeft: 12,
    width: 20,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'right'
  },
});
