import React, { useMemo, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, TouchableWithoutFeedback } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type OptionDef = { key: string; label: string; icon: any; danger: boolean };

interface OptionItemProps {
  option: OptionDef;
  index: number;
  isLast: boolean;
  onSelect: (key: string) => void;
}

function OptionItem({ option, index, isLast, onSelect }: OptionItemProps) {
  const [scaleValue] = useState(new Animated.Value(1));

  const [pressed, setPressed] = useState(false);

  const handlePressIn = () => {
    setPressed(true);
    Animated.spring(scaleValue, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    setPressed(false);
    Animated.spring(scaleValue, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  const handlePress = () => {
    HapticFeedback.selection();
    onSelect(option.key);
  };

  return (
    <Animated.View
      style={[
        styles.option,
        isLast && styles.lastOption,
        { transform: [{ scale: scaleValue }] }
      ]}
    >
      <TouchableOpacity
        style={[
          styles.optionTouchable,
          pressed && styles.optionPressed
        ]}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        accessibilityLabel={option.label}
        accessibilityHint={option.label}
        activeOpacity={1}
      >
        <Ionicons 
          name={option.icon as any} 
          size={24} 
          color={option.danger ? '#FF453A' : '#FFFFFF'}
          style={styles.optionIcon}
        />
        <Text style={[
          styles.optionLabel, 
          option.danger && { color: '#FF453A' }
        ]}>
          {option.label}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function ContextMenu({ onSelect, isAdmin = false }: { onSelect: (key: string) => void; isAdmin?: boolean }) {
  const [dialogScale] = useState(new Animated.Value(1));

  const options: OptionDef[] = useMemo(() => {
    const base: OptionDef[] = [
      { key: 'reply', label: 'השב', icon: 'arrow-undo', danger: false },
      { key: 'forward', label: 'העבר', icon: 'arrow-redo', danger: false },
      { key: 'copy', label: 'העתק', icon: 'copy', danger: false },
      // הצג "מידע" רק למנהלים
      ...(isAdmin ? [{ key: 'info', label: 'מידע', icon: 'information-circle', danger: false } as OptionDef] : []),
      { key: 'star', label: 'סמן בכוכב', icon: 'star', danger: false },
      { key: 'pin', label: 'הצמד', icon: 'pin', danger: false },
      { key: 'delete', label: 'מחק', icon: 'trash', danger: true },
    ];
    return base;
  }, [isAdmin]);

  const handleDialogPressIn = () => {
    Animated.spring(dialogScale, {
      toValue: 0.98,
      useNativeDriver: true,
    }).start();
  };

  const handleDialogPressOut = () => {
    Animated.spring(dialogScale, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <View style={styles.dialog}>
      {/* Handle Bar */}
      <View style={styles.handleBar} />
      
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
    backgroundColor: '#2C2C2E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  handleBar: {
    width: 36,
    height: 5,
    backgroundColor: '#8E8E93',
    borderRadius: 3,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 4,
  },
  optionsContainer: {
    backgroundColor: '#2C2C2E',
  },
  option: {
    borderBottomWidth: 0.5,
    borderBottomColor: '#48484A',
  },
  optionTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    minHeight: 50,
    backgroundColor: '#2C2C2E',
  },
  optionPressed: {
    backgroundColor: '#3A3A3C',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionIcon: {
    marginRight: 12,
    width: 24,
  },
  optionLabel: {
    fontSize: 17,
    fontWeight: '400',
    color: '#FFFFFF',
    flex: 1,
  },
});
