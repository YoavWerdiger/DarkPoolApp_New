import React, { useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  Animated,
  ScrollView,
  StyleSheet,
  ViewStyle,
  TextStyle,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { applyAppSystemUI } from '../../lib/androidSystemUI';
import { APP_TYPE, appSheetButtonLabelStyle } from './appType';
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
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const cardWidth = Math.min(340, Math.max(260, windowWidth - spacing.lg * 2));
  const copyWidth = cardWidth - APP_LAYOUT.cardPadding * 2;
  const copyMaxHeight = Math.max(160, windowHeight * 0.5);

  const centeredCopy: TextStyle = {
    width: copyWidth,
    textAlign: 'center',
    writingDirection: 'rtl',
  };
  
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

  const containerStyle: ViewStyle = {
    backgroundColor: colors.background.primary,
    borderRadius: UI_CARD_RADIUS,
    borderWidth: 0,
    padding: APP_LAYOUT.cardPadding,
    width: cardWidth,
    maxHeight: windowHeight - spacing.lg * 2,
    overflow: 'hidden',
    alignItems: 'stretch',
    direction: 'ltr',
  };

  const titleStyle: TextStyle = {
    ...APP_TYPE.sectionTitle,
    color: colors.text.primary,
    marginBottom: message ? APP_LAYOUT.cardTitleToBodyGap : 0,
    ...centeredCopy,
  };

  const messageStyle: TextStyle = {
    ...APP_TYPE.body,
    color: colors.text.secondary,
    marginBottom: spacing.lg,
    ...centeredCopy,
  };

  const buttonContainerStyle: ViewStyle = {
    flexDirection: 'row-reverse',
    direction: 'ltr',
    alignItems: 'stretch',
    alignSelf: 'stretch',
    width: '100%',
    marginTop: spacing.xs,
    gap: APP_LAYOUT.cardStackGap,
  };

  const getButtonStyle = (): ViewStyle => ({
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    borderWidth: 0,
    backgroundColor: colors.background.cardSolid,
  });

  const getButtonTextStyle = (button: UIAlertButton): TextStyle => ({
    ...appSheetButtonLabelStyle,
    flexGrow: 0,
    flexShrink: 0,
    textAlign: 'center',
    color: button.style === 'destructive' ? colors.text.danger : colors.text.primary,
  });

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
          <Animated.View
            style={[containerStyle, { transform: [{ scale: scaleAnim }] }]}
          >
              {showIcon && (
                <View
                  style={{
                    alignItems: 'center',
                    alignSelf: 'center',
                    marginBottom: spacing.lg,
                  }}
                >
                  <View
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 32,
                      backgroundColor: colors.background.secondary,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name={typeConfig.icon} size={32} color={colors.text.secondary} />
                  </View>
                </View>
              )}

              <ScrollView
                style={{ maxHeight: copyMaxHeight, alignSelf: 'stretch' }}
                contentContainerStyle={{ width: '100%', alignItems: 'center' }}
                bounces={false}
                showsVerticalScrollIndicator={false}
              >
                <Text style={titleStyle}>{title}</Text>
                {message ? <Text style={messageStyle}>{message}</Text> : null}
              </ScrollView>

              <View style={buttonContainerStyle}>
                {buttons.map((button, index) => (
                  <View key={index} style={getButtonStyle()}>
                    <Pressable
                      onPress={() => handleButtonPress(button)}
                      style={({ pressed }) => [{ width: '100%', opacity: pressed ? 0.85 : 1 }]}
                    >
                      <View
                        style={{
                          width: '100%',
                          minHeight: 52,
                          paddingVertical: 12,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <View
                          style={{
                            alignSelf: 'center',
                            direction: 'ltr',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          <Text style={getButtonTextStyle(button)}>{button.text}</Text>
                        </View>
                      </View>
                    </Pressable>
                  </View>
                ))}
              </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
};

export default UIAlert;

