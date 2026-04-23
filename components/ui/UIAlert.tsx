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
  const { colors, typography, spacing, borderRadius } = DesignTokens;
  
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
        };
      case 'warning':
        return {
          icon: 'warning' as keyof typeof Ionicons.glyphMap,
        };
      case 'error':
        return {
          icon: 'close-circle' as keyof typeof Ionicons.glyphMap,
        };
      default: // info
        return {
          icon: 'information-circle' as keyof typeof Ionicons.glyphMap,
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

  const glass = DesignTokens.getGlassCardStyle('medium');
  const containerStyle: ViewStyle = {
    ...glass,
    padding: spacing.xl,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    backgroundColor: colors.bubbleOther,
    borderWidth: 0,
    ...rtlCard,
  };

  const titleStyle: TextStyle = {
    fontSize: typography.title2.size,
    fontWeight: typography.title2.weight as TextStyle['fontWeight'],
    letterSpacing: typography.title2.letterSpacing,
    lineHeight: typography.title2.lineHeight,
    color: colors.text.primary,
    textAlign: 'center',
    writingDirection: 'rtl',
    marginBottom: message ? spacing.md : 0,
  };

  const messageStyle: TextStyle = {
    fontSize: typography.body.size,
    fontWeight: typography.body.weight as TextStyle['fontWeight'],
    color: colors.text.secondary,
    textAlign: 'center',
    writingDirection: 'rtl',
    lineHeight: typography.body.lineHeight,
    marginBottom: spacing.lg,
  };

  const twoCol = buttons.length === 2;
  const isSingleButton = buttons.length === 1;
  const buttonContainerStyle: ViewStyle = {
    flexDirection: buttons.length > 2 ? 'column' : twoCol && I18nManager.isRTL ? 'row-reverse' : 'row',
    justifyContent: isSingleButton ? 'center' : 'space-between',
    marginTop: spacing.xs,
    gap: twoCol ? spacing.sm : 0,
  };

  const getButtonStyle = (button: UIAlertButton, index: number): ViewStyle => {
    const baseStyle: ViewStyle = {
      flex: buttons.length > 2 || isSingleButton ? 0 : 1,
      minHeight: 48,
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.base,
      borderRadius: borderRadius.full,
      marginBottom: buttons.length > 2 && index < buttons.length - 1 ? spacing.sm : 0,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: isSingleButton ? 'center' : undefined,
      minWidth: isSingleButton ? 180 : undefined,
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
          backgroundColor: '#FFFFFF',
        };
    }
  };

  const getButtonTextStyle = (button: UIAlertButton): TextStyle => {
    switch (button.style) {
      case 'destructive':
        return {
          color: '#FFFFFF',
          fontWeight: typography.fontWeight.semibold,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
      case 'cancel':
        return {
          color: '#FFFFFF',
          fontWeight: typography.fontWeight.medium,
          textAlign: 'center',
          fontSize: typography.fontSize.base,
        };
        default:
        return {
          color: '#FFFFFF',
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
          style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.background.overlayHeavy }]}
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        <View
          style={[
            StyleSheet.absoluteFillObject,
            { justifyContent: 'center', alignItems: 'center', padding: spacing.lg },
          ]}
          pointerEvents="box-none"
        >
          <View>
            <Animated.View
              style={[containerStyle, { transform: [{ scale: scaleAnim }] }]}
            >
              {showIcon && (
                <View
                  style={{
                    alignItems: 'center',
                    marginBottom: spacing.lg,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: 'rgba(255,255,255,0.08)',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={typeConfig.icon} size={32} color={colors.text.secondary} />
                  </View>
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

