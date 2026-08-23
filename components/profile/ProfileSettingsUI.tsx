import React from 'react';
import {
  View,
  Text,
  Switch,
  TouchableOpacity,
  StyleSheet,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import UICard from '../ui/UICard';
import { getAppVersionLabel } from '../../utils/appMeta';

export const PROFILE_SCREEN_HP = 16;

export function ProfileScreenBody({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const tokens = useDesignTokens();
  return (
    <View
      style={[
        {
          paddingHorizontal: tokens.spacing.base,
          paddingTop: tokens.spacing.md,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Section label — matches OverviewTab section titles (e.g. "שווי תיק…") */
export function SettingsSectionTitle({
  title,
  style,
}: {
  title: string;
  style?: TextStyle;
}) {
  const tokens = useDesignTokens();
  return (
    <Text
      style={[
        {
          fontSize: 15,
          fontWeight: '700',
          color: tokens.colors.text.primary,
          marginBottom: tokens.spacing.sm,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        style,
      ]}
    >
      {title}
    </Text>
  );
}

export function SettingsGlassCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const tokens = useDesignTokens();
  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      style={[{ borderRadius: tokens.borderRadius.lg, marginBottom: tokens.spacing.lg }, style]}
    >
      {children}
    </UICard>
  );
}

type SettingsSwitchRowProps = {
  title: string;
  subtitle: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  showDivider?: boolean;
  danger?: boolean;
};

export function SettingsSwitchRow({
  title,
  subtitle,
  value,
  onValueChange,
  showDivider = true,
  danger,
}: SettingsSwitchRowProps) {
  const tokens = useDesignTokens();
  const { theme } = useTheme();
  const s = styles(tokens);

  return (
    <View>
      <View style={s.row}>
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: theme.switchTrackOff, true: tokens.colors.primary.main }}
          thumbColor={value ? tokens.colors.text.primary : theme.switchThumbOff}
          ios_backgroundColor={theme.switchTrackOff}
          style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
        />
        <View style={s.textCol}>
          <Text style={[s.title, danger && { color: tokens.colors.danger.main }]}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
      </View>
      {showDivider ? <View style={s.divider} /> : null}
    </View>
  );
}

type SettingsActionRowProps = {
  title: string;
  subtitle: string;
  onPress: () => void;
  showDivider?: boolean;
  danger?: boolean;
  trailing?: React.ReactNode;
};

export function SettingsActionRow({
  title,
  subtitle,
  onPress,
  showDivider = true,
  danger,
  trailing,
}: SettingsActionRowProps) {
  const tokens = useDesignTokens();
  const s = styles(tokens);

  return (
    <View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.row}>
        {trailing ?? (
          <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
        )}
        <View style={s.textCol}>
          <Text style={[s.title, danger && { color: tokens.colors.danger.main }]}>{title}</Text>
          <Text style={s.subtitle}>{subtitle}</Text>
        </View>
      </TouchableOpacity>
      {showDivider ? <View style={s.divider} /> : null}
    </View>
  );
}

type ProfileMenuRowProps = {
  title: string;
  subtitle?: string;
  onPress: () => void;
  showDivider?: boolean;
};

export function ProfileMenuRow({
  title,
  subtitle,
  onPress,
  showDivider = true,
}: ProfileMenuRowProps) {
  const tokens = useDesignTokens();
  const s = styles(tokens);

  return (
    <View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.menuRow}>
        <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
        <View style={s.menuTextCol}>
          <Text style={s.title}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
      </TouchableOpacity>
      {showDivider ? <View style={s.menuDivider} /> : null}
    </View>
  );
}

export function SettingsVersionFooter() {
  const tokens = useDesignTokens();
  return (
    <View style={{ alignItems: 'center', marginTop: tokens.spacing.md, marginBottom: tokens.spacing.lg }}>
      <Text style={styles(tokens).versionText}>DarkPool · גרסה {getAppVersionLabel()}</Text>
    </View>
  );
}

function styles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    // App.tsx: direction LTR — chevron/switch ראשונים בעץ → שמאל ויזואלי
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.base,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: tokens.spacing.md,
      paddingHorizontal: tokens.spacing.base,
    },
    textCol: {
      flex: 1,
      marginLeft: tokens.spacing.md,
    },
    menuTextCol: {
      flex: 1,
      marginLeft: tokens.spacing.sm,
      gap: tokens.spacing.micro,
    },
    title: {
      fontSize: tokens.typography.body.size,
      fontWeight: tokens.typography.fontWeight.semibold as '600',
      lineHeight: tokens.typography.body.lineHeight,
      color: tokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    subtitle: {
      fontSize: tokens.typography.bodySmall.size,
      lineHeight: tokens.typography.bodySmall.lineHeight,
      color: tokens.colors.text.tertiary,
      textAlign: 'right',
      writingDirection: 'rtl',
      marginTop: 2,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: tokens.spacing.base,
    },
    menuDivider: {
      height: 1,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: tokens.spacing.base,
    },
    versionText: {
      color: tokens.colors.text.tertiary,
      fontSize: tokens.typography.caption.size,
    },
  });
}
