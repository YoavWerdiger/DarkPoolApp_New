import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StatusBar,
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';

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
  /** ברירת מחדל false — דיאלוג גלובלי יכול להפעיל לסגירה מהירה */
  closeOnBackdropPress?: boolean;
}

const UIAlert: React.FC<UIAlertProps> = ({
  visible,
  title,
  message,
  type = 'info',
  buttons = [{ text: 'אישור', style: 'default' }],
  onClose,
  showIcon = true,
  closeOnBackdropPress = false,
}) => {
  const DesignTokens = useDesignTokens();
  const { colors, typography, spacing, borderRadius, shadows } = DesignTokens;
  
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible) return;
    scaleAnim.setValue(0.92);
    Animated.spring(scaleAnim, {
      toValue: 1,
      tension: 100,
      friction: 8,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  const getTypeConfig = () => {
    switch (type) {
      case 'success':
        return {
          icon: 'checkmark-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.success.main,
          backgroundColor: colors.background.sheet,
        };
      case 'warning':
        return {
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.warning.main,
          backgroundColor: colors.background.sheet,
        };
      case 'error':
        return {
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.danger.main,
          backgroundColor: colors.background.sheet,
        };
      default: // info
        return {
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
          iconColor: colors.info.main,
          backgroundColor: colors.background.sheet,
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

  const rtlCard: ViewStyle = I18nManager.isRTL ? { direction: 'rtl' } : {};

  const containerStyle: ViewStyle = {
    backgroundColor: typeConfig.backgroundColor,
    borderRadius: borderRadius['2xl'],
    padding: spacing.xl,
    width: '100%',
    maxWidth: 320,
    ...shadows.lg,
    borderWidth: 0.5,
    borderColor: colors.border.default,
    ...rtlCard,
  };

  const titleStyle: TextStyle = {
    fontSize: typography.fontSize.lg,
    fontWeight: typography.fontWeight.semibold,
    color: colors.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: message ? spacing.sm : 0,
  };

  const messageStyle: TextStyle = {
    fontSize: typography.fontSize.base,
    color: colors.text.secondary,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: typography.lineHeight.normal * typography.fontSize.base,
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
          backgroundColor: colors.danger.main,
        };
      case 'cancel':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: colors.primary.main,
        };
    }
  };

  const getButtonTextStyle = (button: UIAlertButton): TextStyle => {
    switch (button.style) {
      case 'destructive':
        return {
          color: colors.text.primary,
          fontWeight: typography.fontWeight.semibold,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
      case 'cancel':
        return {
          color: colors.text.secondary,
          fontWeight: typography.fontWeight.medium,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
        default:
        return {
          color: colors.text.inverse,
          fontWeight: typography.fontWeight.semibold,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <StatusBar backgroundColor="rgba(0,0,0,0.6)" barStyle="light-content" />

      <View style={{ flex: 1 }}>
        <Pressable
          style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.overlay }]}
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { justifyContent: 'center', alignItems: 'center', padding: spacing['2xl'] },
          ]}
          pointerEvents="box-none"
        >
          <View>
            <Animated.View
              style={[containerStyle, { transform: [{ scale: scaleAnim }] }]}
            >
              {showIcon && (
                <View style={{ alignItems: 'center', marginBottom: spacing.lg }}>
                  <Ionicons name={typeConfig.icon} size={48} color={typeConfig.iconColor} />
                </View>
              )}

              <Text style={titleStyle}>{title}</Text>

              {message && <Text style={messageStyle}>{message}</Text>}

              <View style={buttonContainerStyle}>
                {buttons.map((button, index) => (
                  <Pressable
                    key={index}
                    style={({ pressed }) => [getButtonStyle(button, index), pressed && { opacity: 0.8 }]}
                    onPress={() => handleButtonPress(button)}
                  >
                    <Text style={getButtonTextStyle(button)}>{button.text}</Text>
                  </Pressable>
                ))}
              </View>
            </Animated.View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default UIAlert;

