import React, { useState } from 'react';
import { 
  View, 
  Text, 
  Pressable, 
  Modal, 
  FlatList, 
  Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { DesignTokens } from '../ui/DesignTokens';

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
  error = false
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (optionValue: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : [];
      if (currentValues.includes(optionValue)) {
        onChange(currentValues.filter(v => v !== optionValue));
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
        .map(v => options.find(o => o.value === v)?.label)
        .filter(Boolean);
      if (selectedLabels.length > 2) {
        return `${selectedLabels.slice(0, 2).join(', ')} +${selectedLabels.length - 2}`;
      }
      return selectedLabels.join(', ');
    }
    return options.find(o => o.value === value)?.label || placeholder;
  };

  const hasValue = value && (Array.isArray(value) ? value.length > 0 : true);

  return (
    <View style={{ marginBottom: 16 }}>
      {/* Label */}
      <Text style={{ 
        color: DesignTokens.colors.text.primary, 
        fontSize: 14, 
        fontWeight: '600', 
        marginBottom: 8,
        letterSpacing: 0.4,
        textTransform: 'uppercase',
        textAlign: 'right'
      }}>
        {label}
      </Text>

      {/* Dropdown Button */}
      <Pressable
        onPress={() => setIsOpen(true)}
        style={{
          backgroundColor: DesignTokens.colors.background.secondary,
          borderRadius: 14,
          borderWidth: 1.5,
          borderColor: error ? '#F85149' : DesignTokens.colors.border.main,
          paddingHorizontal: 16,
          paddingVertical: 16,
          flexDirection: 'row',
          alignItems: 'center'
        }}
      >
        <Ionicons 
          name="chevron-down" 
          size={20} 
          color={DesignTokens.colors.text.tertiary} 
        />
        <Text 
          style={{ 
            flex: 1,
            color: hasValue 
              ? DesignTokens.colors.text.primary 
              : DesignTokens.colors.text.tertiary,
            fontSize: 16,
            fontWeight: '500',
            textAlign: 'right',
            marginRight: 12
          }}
          numberOfLines={1}
        >
          {getDisplayText()}
        </Text>
      </Pressable>

      {/* Modal */}
      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <Pressable 
            style={{ flex: 1 }} 
            onPress={() => setIsOpen(false)}
          />
          
          <View style={{
            backgroundColor: DesignTokens.colors.background.secondary,
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            paddingTop: 12,
            paddingBottom: 40,
            maxHeight: screenHeight * 0.6
          }}>
            {/* Handle */}
            <View style={{
              width: 40,
              height: 4,
              backgroundColor: 'rgba(255,255,255,0.3)',
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: 16
            }} />

            {/* Title */}
            <Text style={{
              color: DesignTokens.colors.text.primary,
              fontSize: 18,
              fontWeight: '700',
              textAlign: 'center',
              marginBottom: 16
            }}>
              {label}
            </Text>

            {/* Options */}
            <FlatList
              data={options}
              keyExtractor={item => item.value}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => {
                const selected = isSelected(item.value);
                return (
                  <Pressable
                    onPress={() => handleSelect(item.value)}
                    style={{
                      backgroundColor: selected
                        ? 'rgba(5, 209, 87, 0.15)'
                        : 'rgba(255,255,255,0.05)',
                      borderRadius: 12,
                      borderWidth: selected ? 1.5 : 0,
                      borderColor: DesignTokens.colors.primary.main,
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      marginBottom: 8,
                      flexDirection: 'row',
                      alignItems: 'center'
                    }}
                  >
                    {multiple && (
                      <View style={{
                        width: 24,
                        height: 24,
                        borderRadius: 12,
                        backgroundColor: selected ? DesignTokens.colors.primary.main : 'transparent',
                        borderWidth: selected ? 0 : 2,
                        borderColor: DesignTokens.colors.border.main,
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {selected && (
                          <Ionicons name="checkmark" size={16} color="#000" />
                        )}
                      </View>
                    )}
                    <Text style={{
                      color: selected 
                        ? DesignTokens.colors.primary.main 
                        : DesignTokens.colors.text.primary,
                      fontSize: 16,
                      fontWeight: selected ? '600' : '500',
                      textAlign: 'right',
                      flex: 1,
                      marginLeft: multiple ? 12 : 0
                    }}>
                      {item.label}
                    </Text>
                  </Pressable>
                );
              }}
            />

            {/* Done button for multiple selection */}
            {multiple && (
              <View style={{ paddingHorizontal: 16, marginTop: 8 }}>
                <LinearGradient
                  colors={['#00C805', '#00A004', '#008F03']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={{ borderRadius: 14 }}
                >
                  <Pressable
                    onPress={() => setIsOpen(false)}
                    style={{
                      paddingVertical: 16,
                      alignItems: 'center'
                    }}
                  >
                    <Text style={{
                      color: '#000',
                      fontSize: 16,
                      fontWeight: '700'
                    }}>
                      אישור
                    </Text>
                  </Pressable>
                </LinearGradient>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default CustomDropdown;

