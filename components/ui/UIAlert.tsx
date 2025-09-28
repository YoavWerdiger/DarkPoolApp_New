import React, { useEffect, useRef } from 'react';
import { 
  Modal, 
  View, 
  Text, 
  Pressable, 
  Animated, 
  ViewStyle,
  TextStyle,
  StatusBar 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DesignTokens from './DesignTokens';

export type UIAlertType = 'info' | 'success' | 'warning' | 'error';

export interface UIAlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface UIAlertProps {
  visible: boolean;
  title: string;
  message?: string;
  type?: UIAlertType;
  buttons?: UIAlertButton[];
  onClose?: () => void;
  showIcon?: boolean;
}

const UIAlert: React.FC<UIAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'אישור', style: 'default' }],
  onClose,
  showIcon = true,
}) => {
  const { colors, typography, spacing, borderRadius, shadows } = DesignTokens;
  
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.success,
          backgroundColor: colors.surface,
        };
      case 'warning':
        return {
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.warning,
          backgroundColor: colors.surface,
        };
      case 'error':
        return {
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.danger,
          backgroundColor: colors.surface,
        };
      default: // info
        return {
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.info,
          backgroundColor: colors.surface,
        };
    }
  };

  const typeConfig = getTypeConfig();

  const handleButtonPress = (button: UIAlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const backdropStyle: ViewStyle = {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing['2xl'],
  };

  const containerStyle: ViewStyle = {
    backgroundColor: typeConfig.backgroundColor,
    borderRadius: borderRadius.xl,
    padding: spacing['2xl'],
    width: '100%',
    maxWidth: 320,
    ...shadows.lg,
    borderWidth: 0.5,
    borderColor: colors.border,
  };

  const titleStyle: TextStyle = {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: message ? spacing.sm : 0,
  };

  const messageStyle: TextStyle = {
    fontSize: typography.fontSize.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeight.normal,
    marginBottom: spacing.lg,
  };

  const buttonContainerStyle: ViewStyle = {
    flexDirection: buttons.length > 2 ? 'column' : 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  };

  const getButtonStyle = (button: UIAlertButton, index: number): ViewStyle => {
    const baseStyle: ViewStyle = {
      flex: buttons.length > 2 ? 0 : 1,
      paddingVertical: spacing.md,
      paddingHorizontal: spacing.lg,
      borderRadius: borderRadius.md,
      marginHorizontal: buttons.length > 2 ? 0 : (index > 0 ? spacing.sm : 0),
      marginBottom: buttons.length > 2 && index < buttons.length - 1 ? spacing.sm : 0,
    };

    switch (button.style) {
      case 'destructive':
        return {
          ...baseStyle,
          backgroundColor: colors.danger,
        };
      case 'cancel':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: colors.primary,
        };
    }
  };

  const getButtonTextStyle = (button: UIAlertButton): TextStyle => {
    switch (button.style) {
      case 'destructive':
        return {
          color: colors.textPrimary,
          fontWeight: typography.fontWeight.semibold,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
      case 'cancel':
        return {
          color: colors.textSecondary,
          fontWeight: typography.fontWeight.medium,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
      default:
        return {
          color: '#000000',
          fontWeight: typography.fontWeight.semibold,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />
      
      <Animated.View style={[backdropStyle, { opacity: fadeAnim }]}>
        <Animated.View 
          style={[
            containerStyle,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            }
          ]}
        >
          {/* Icon */}
          {showIcon && (
            <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
              <Ionicons 
                name={typeConfig.icon} 
                size={48} 
                color={typeConfig.iconColor} 
              />
            </View>
          )}

          {/* Title */}
          <Text style={titleStyle}>{title}</Text>

          {/* Message */}
          {message && <Text style={messageStyle}>{message}</Text>}

          {/* Buttons */}
          <View style={buttonContainerStyle}>
            {buttons.map((button, index) => (
              <Pressable
                key={index}
                style={({ pressed }) => [
                  getButtonStyle(button, index),
                  pressed && { opacity: 0.8 }
                ]}
                onPress={() => handleButtonPress(button)}
              >
                <Text style={getButtonTextStyle(button)}>
                  {button.text}
                </Text>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

export default UIAlert;

