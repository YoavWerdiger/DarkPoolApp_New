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
  I18nManager,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { applyAppSystemUI } from '../../lib/androidSystemUI';
import { APP_TYPE, appPhysicalRightText, appSheetButtonLabelStyle } from './appType';
import { APP_LAYOUT, UI_CARD_RADIUS } from './appLayout';

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

const HEBREW_COPY = /[\u0590-\u05FF]/;

function dialogCopyAlign(text?: string): TextStyle {
  if (text && HEBREW_COPY.test(text)) return appPhysicalRightText;
  return { textAlign: 'center', writingDirection: 'auto' };
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
  const { colors, spacing, borderRadius } = DesignTokens;
  
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

  useEffect(() => {
    if (visible) return;
    void applyAppSystemUI();
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
    if (button.style === 'destructive') {
      void HapticFeedback.warning();
    } else if (button.style === 'cancel') {
      void HapticFeedback.selection();
    } else {
      void HapticFeedback.impactLight();
    }
    if (button.onPress) {
      button.onPress();
    }
    if (onClose) {
      onClose();
    }
  };

  const rtlCard: ViewStyle = I18nManager.isRTL ? { direction: 'rtl' } : {};

  const containerStyle: ViewStyle = {
    backgroundColor: colors.background.cardSolid,
    borderRadius: UI_CARD_RADIUS,
    borderWidth: 0,
    padding: APP_LAYOUT.cardPadding,
    width: '100%',
    maxWidth: 340,
    overflow: 'hidden',
    ...rtlCard,
  };

  const titleStyle: TextStyle = {
    ...APP_TYPE.cardTitle,
    color: colors.text.primary,
    width: '100%',
    marginBottom: message ? APP_LAYOUT.cardTitleToBodyGap : 0,
    ...dialogCopyAlign(title),
  };

  const messageStyle: TextStyle = {
    ...APP_TYPE.body,
    color: colors.text.secondary,
    width: '100%',
    marginBottom: spacing.lg,
    ...dialogCopyAlign(message),
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
      borderRadius: borderRadius.button,
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
          borderWidth: 0,
        };
      case 'cancel':
        return {
          ...baseStyle,
          backgroundColor: 'transparent',
          borderWidth: 0,
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: colors.primary.main,
          borderWidth: 0,
        };
    }
  };

  const getButtonTextStyle = (button: UIAlertButton): TextStyle => {
    const label: TextStyle = { ...appSheetButtonLabelStyle };
    switch (button.style) {
      case 'destructive':
        return { ...label, color: '#FFFFFF' };
      case 'cancel':
        return { ...label, color: colors.text.secondary };
      default:
        return { ...label, color: colors.text.inverse };
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
      onDismiss={() => {
        void applyAppSystemUI();
      }}
    >
      <View style={{ flex: 1 }}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.background.overlayHeavy }]}
          onPress={closeOnBackdropPress ? onClose : undefined}
        />
        <View
          style={[
            StyleSheet.absoluteFill,
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

