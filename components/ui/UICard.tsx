import React from 'react';
import { View, Pressable, ViewStyle, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useDesignTokens } from './DesignTokens';

export interface UICardProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined' | 'gradient' | 'blur';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  onPress?: () => void;
  style?: ViewStyle;
  pressable?: boolean;
}

const UICard: React.FC<UICardProps> = ({
  children,
  variant = 'gradient',
  padding = 'md',
  onPress,
  style,
  pressable = false,
}) => {
  const DesignTokens = useDesignTokens();
  const { colors, spacing, borderRadius, shadows } = DesignTokens;

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: colors.background.elevated,
          ...shadows.md,
        };
      case 'outlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: colors.border.primary,
        };
      case 'gradient':
        return {
          backgroundColor: 'transparent',
          ...shadows.md,
        };
      case 'blur':
        return {
          backgroundColor: 'transparent',
          ...shadows.md,
        };
      default:
        return {
          backgroundColor: colors.background.elevated,
          ...shadows.sm,
        };
    }
  };

  const getPaddingStyle = (): ViewStyle => {
    switch (padding) {
      case 'none':
        return {};
      case 'sm':
        return { padding: spacing.sm };
      case 'lg':
        return { padding: spacing['2xl'] };
      default:
        return { padding: spacing.lg };
    }
  };

  const baseStyle: ViewStyle = {
    borderRadius: borderRadius['2xl'], // פינות מעוגלות כמו ב-MainTabs
    overflow: 'hidden',
    ...getVariantStyle(),
    ...getPaddingStyle(),
    ...style,
  };

  // גרדיאנט ירוק כהה-שחור - אזור ירוק רחב באמצע, שחור מלמעלה ומלמטה
  const gradientColors = ['#000000', '#000A04', '#001A0A', '#001A0A', '#000A04', '#000000']; // שחור -> ירוק -> ירוק כהה (אזור רחב) -> ירוק -> שחור

  // חילוץ borderRadius מ-style
  const customBorderRadius = {
    borderRadius: style?.borderRadius || borderRadius['2xl'],
    borderTopLeftRadius: style?.borderTopLeftRadius ?? (style?.borderRadius || borderRadius['2xl']),
    borderTopRightRadius: style?.borderTopRightRadius ?? (style?.borderRadius || borderRadius['2xl']),
    borderBottomLeftRadius: style?.borderBottomLeftRadius ?? (style?.borderRadius || borderRadius['2xl']),
    borderBottomRightRadius: style?.borderBottomRightRadius ?? (style?.borderRadius || borderRadius['2xl']),
  };

  const cardContent = (
    <>
      {variant === 'gradient' ? (
        <>
          {/* גרדיאנט ירוק כהה-שחור אנכי - אזור ירוק רחב יותר בגובה */}
          <LinearGradient
            colors={gradientColors}
            locations={[0, 0.2, 0.35, 0.65, 0.8, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          {/* גבול עדין כמו ב-MainTabs */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                ...customBorderRadius,
              },
            ]}
          />
        </>
      ) : variant === 'blur' ? (
        <>
          {/* Blur effect כמו ב-MainTabs - יותר שקוף ובהיר */}
          {Platform.OS === 'ios' ? (
            <BlurView
              intensity={30}
              tint="dark"
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(15, 15, 15, 0.3)',
                }
              ]}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                {
                  backgroundColor: 'rgba(20, 20, 20, 0.4)',
                },
              ]}
            />
          )}
          {/* גבול עדין כמו ב-MainTabs */}
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.1)',
                ...customBorderRadius,
              },
            ]}
          />
        </>
      ) : null}
      <View style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </View>
    </>
  );

  if (pressable || onPress) {
    return (
      <Pressable
        style={({ pressed }) => [
          baseStyle,
          pressed && {
            opacity: 0.9,
            transform: [{ scale: 0.98 }],
          },
        ]}
        onPress={onPress}
      >
        {cardContent}
      </Pressable>
    );
  }

  return (
    <View style={baseStyle}>
      {cardContent}
    </View>
  );
};

export default UICard;

