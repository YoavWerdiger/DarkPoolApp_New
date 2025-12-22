import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DesignTokens } from '../ui/DesignTokens';

interface OnboardingInputProps extends TextInputProps {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  error?: string;
  multiline?: boolean;
}

const OnboardingInput: React.FC<OnboardingInputProps> = ({
  label,
  icon,
  error,
  multiline = false,
  ...textInputProps
}) => {
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

      {/* Input Container */}
      <View style={{
        backgroundColor: DesignTokens.colors.background.secondary,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: error ? '#F85149' : '#333333',
        paddingHorizontal: 16,
        paddingVertical: multiline ? 12 : 4,
        flexDirection: 'row',
        alignItems: multiline ? 'flex-start' : 'center'
      }}>
        {icon && (
          <Ionicons 
            name={icon} 
            size={20} 
            color={DesignTokens.colors.text.tertiary} 
            style={{ marginTop: multiline ? 12 : 0 }}
          />
        )}
        <TextInput
          style={{
            flex: 1,
            color: DesignTokens.colors.text.primary,
            paddingHorizontal: icon ? 12 : 0,
            paddingVertical: multiline ? 4 : 16,
            fontSize: 16,
            fontWeight: '500',
            textAlign: 'right',
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? 'top' : 'center'
          }}
          placeholderTextColor={DesignTokens.colors.text.tertiary}
          multiline={multiline}
          {...textInputProps}
        />
      </View>

      {/* Error Message */}
      {error && (
        <View style={{
          backgroundColor: 'rgba(248, 81, 73, 0.1)',
          borderColor: '#F85149',
          borderWidth: 1,
          borderRadius: 12,
          padding: 12,
          marginTop: 8,
          flexDirection: 'row',
          alignItems: 'center'
        }}>
          <Ionicons name="alert-circle" size={20} color="#F85149" style={{ marginLeft: 8 }} />
          <Text style={{ color: '#F85149', fontSize: 14, fontWeight: '500', textAlign: 'right', flex: 1 }}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
};

export default OnboardingInput;
