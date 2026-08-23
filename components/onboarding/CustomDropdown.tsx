import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  Modal,
  FlatList,
  Dimensions,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';
import UICard from '../ui/UICard';
import OnboardingButton from './OnboardingButton';

const { height: screenHeight } = Dimensions.get('window');

interface DropdownOption {
  label: string;
  value: string;
}

interface CustomDropdownProps {
  label: string;
  placeholder: string;
  options: DropdownOption[];
  value: string | string[] | null;
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  error?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  label,
  placeholder,
  options,
  value,
  onChange,
  multiple = false,
  error = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const surface = DesignTokens.onboardingInputSurface;
  const green = DesignTokens.colors.primary.main;

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter((v) => v !== optionValue));
      } else {
        onChange([...currentValues, optionValue]);
      }
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const isSelected = (optionValue: string) => {
    if (multiple && Array.isArray(value)) {
      return value.includes(optionValue);
    }
    return value === optionValue;
  };

  const getDisplayText = () => {
    if (!value || (Array.isArray(value) && value.length === 0)) {
      return placeholder;
    }
    if (multiple && Array.isArray(value)) {
      const selectedLabels = value
        .map((v) => options.find((o) => o.value === v)?.label)
        .filter(Boolean);
      if (selectedLabels.length > 2) {
        return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;
      }
      return selectedLabels.join(', ');
    }
    return options.find((o) => o.value === value)?.label || placeholder;
  };

  const hasValue = !!(value && (Array.isArray(value) ? value.length > 0 : true));

  return (
    <View style={{ marginBottom: 16 }}>
      <Text
        style={{
          color: 'rgba(255,255,255,0.48)',
          fontSize: 13,
          fontWeight: '600',
          marginBottom: 8,
          textAlign: 'right',
          writingDirection: 'rtl',
        }}
      >
        {label}
      </Text>

      <Pressable onPress={() => setIsOpen(true)}>
        <UICard
          variant="inputGlass"
          padding="none"
          style={{
            borderRadius: 16,
            borderWidth: 1,
            borderColor: error ? '#F85149' : surface.borderColor,
            backgroundColor: surface.backgroundColor,
            paddingHorizontal: 14,
            paddingVertical: 15,
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <Ionicons name="chevron-down" size={18} color="rgba(255,255,255,0.38)" />
          <Text
            style={{
              flex: 1,
              color: hasValue ? '#fff' : 'rgba(255,255,255,0.34)',
              fontSize: 16,
              fontWeight: '400',
              textAlign: 'right',
              writingDirection: 'rtl',
              marginRight: 10,
            }}
            numberOfLines={1}
          >
            {getDisplayText()}
          </Text>
        </UICard>
      </Pressable>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' }}>
          <Pressable style={{ flex: 1 }} onPress={() => setIsOpen(false)} />

          <View
            style={{
              backgroundColor: '#121612',
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              borderTopWidth: 1,
              borderColor: 'rgba(255,255,255,0.08)',
              paddingTop: 12,
              paddingBottom: 36,
              maxHeight: screenHeight * 0.6,
            }}
          >
            <View
              style={{
                width: 36,
                height: 4,
                backgroundColor: 'rgba(255,255,255,0.18)',
                borderRadius: 2,
                alignSelf: 'center',
                marginBottom: 14,
              }}
            />

            <Text
              style={{
                color: '#fff',
                fontSize: 17,
                fontWeight: '700',
                textAlign: 'right',
                writingDirection: 'rtl',
                marginBottom: 12,
                paddingHorizontal: 20,
              }}
            >
              {label}
            </Text>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item, index }) => {
                const selected = isSelected(item.value);
                const isLast = index === options.length - 1;
                return (
                  <Pressable
                    onPress={() => handleSelect(item.value)}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      paddingVertical: 14,
                      paddingHorizontal: 14,
                      gap: 12,
                      backgroundColor: selected ? 'rgba(0,200,5,0.07)' : 'transparent',
                      borderBottomWidth: isLast ? 0 : StyleSheet.hairlineWidth,
                      borderBottomColor: 'rgba(255,255,255,0.08)',
                      borderRadius: selected ? 12 : 0,
                    }}
                  >
                    <View
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: multiple ? 6 : 10,
                        borderWidth: 1.5,
                        borderColor: selected ? green : 'rgba(255,255,255,0.22)',
                        backgroundColor: selected && multiple ? green : 'transparent',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {selected && !multiple ? (
                        <View
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: 5,
                            backgroundColor: green,
                          }}
                        />
                      ) : null}
                      {selected && multiple ? (
                        <Ionicons name="checkmark" size={13} color="#000" />
                      ) : null}
                    </View>
                    <Text
                      style={{
                        color: selected ? '#fff' : 'rgba(255,255,255,0.72)',
                        fontSize: 15,
                        fontWeight: selected ? '600' : '400',
                        textAlign: 'right',
                        writingDirection: 'rtl',
                        flex: 1,
                      }}
                    >
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />

            {multiple ? (
              <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                <OnboardingButton title="אישור" onPress={() => setIsOpen(false)} />
              </View>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CustomDropdown;
