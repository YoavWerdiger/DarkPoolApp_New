import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Switch,
  TouchableOpacity,
  Pressable,
  StyleSheet,
  type LayoutChangeEvent,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { ChevronLeft, User, type LucideIcon } from 'lucide-react-native';
import { useDesignTokens } from '../ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import UICard from '../ui/UICard';
import { getAppVersionLabel } from '../../utils/appMeta';
import { isolateNumericRuns } from '../../screens/DarkPool/utils/bidi';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { appCardTitleStyle, appCaptionStyle } from '../ui/appType';
import {
  settingsHebrewText,
  settingsGroupLabelStyle,
  settingsCaptionType,
  settingsRowSubtitleStyle,
  settingsButtonLabelStyle,
} from './settingsType';
import type { NotificationAlertScope } from '../../lib/notificationAlertScope';

export const PROFILE_SCREEN_HP = APP_LAYOUT.screenPaddingHorizontal;

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
          paddingHorizontal: tokens.layout.screenPadding,
          paddingTop: tokens.layout.componentGap,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** תווית קבוצה מחוץ לכרטיס — אפורה, 15/500, 8px עד הכרטיס. */
export function SettingsSectionTitle({
  title,
  style,
}: {
  title: string;
  style?: TextStyle;
}) {
  return (
    <Text style={[settingsHebrewText, settingsGroupLabelStyle, style]}>
      {title}
    </Text>
  );
}

/** אותו תפקיד כמו SettingsSectionTitle — קבוצות בהתראות. */
export function SettingsOutsideTitle({
  title,
  style,
}: {
  title: string;
  style?: TextStyle;
}) {
  return (
    <Text style={[settingsHebrewText, settingsGroupLabelStyle, style]}>
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
      variant="soft"
      padding="none"
      style={[
        { borderRadius: UI_CARD_RADIUS, marginBottom: tokens.layout.cardStackGap },
        style,
      ]}
    >
      {children}
    </UICard>
  );
}

type SettingsSwitchRowProps = {
  title: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  showDivider?: boolean;
  danger?: boolean;
  disabled?: boolean;
};

/** שורת מתג כמו שורת תפריט בפרופיל — כותרת בלבד, בלי תת-כותרת. */
export function SettingsSwitchRow({
  title,
  value,
  onValueChange,
  showDivider = true,
  danger,
  disabled,
}: SettingsSwitchRowProps) {
  const tokens = useDesignTokens();
  const { theme } = useTheme();
  const s = styles(tokens);

  return (
    <View>
      <View style={[s.menuRow, disabled && { opacity: 0.45 }]}>
        <Switch
          value={value}
          disabled={disabled}
          onValueChange={onValueChange}
          trackColor={{ false: theme.switchTrackOff, true: tokens.colors.primary.main }}
          thumbColor={value ? tokens.colors.text.primary : theme.switchThumbOff}
          ios_backgroundColor={theme.switchTrackOff}
          style={{ transform: [{ scaleX: 0.82 }, { scaleY: 0.82 }] }}
        />
        <View style={s.menuTextCol}>
          <Text style={[s.title, danger && { color: tokens.colors.danger.main }]}>{title}</Text>
        </View>
      </View>
      {showDivider ? <View style={s.menuDivider} /> : null}
    </View>
  );
}

type SettingsActionRowProps = {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  onPress: () => void;
  showDivider?: boolean;
  danger?: boolean;
  trailing?: React.ReactNode;
};

export function SettingsActionRow({
  title,
  subtitle,
  icon: Icon,
  onPress,
  showDivider = true,
  danger,
  trailing,
}: SettingsActionRowProps) {
  const tokens = useDesignTokens();
  const s = styles(tokens);
  const iconColor = danger ? tokens.colors.danger.main : tokens.colors.text.primary;

  return (
    <View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.menuRow}>
        {trailing ?? (
          <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
        )}
        <View style={s.menuTextCol}>
          <Text style={[s.title, danger && { color: tokens.colors.danger.main }]}>{title}</Text>
          {subtitle ? <Text style={s.subtitle}>{subtitle}</Text> : null}
        </View>
        {Icon ? (
          <View style={s.leadingIcon}>
            <Icon size={20} color={iconColor} strokeWidth={2} />
          </View>
        ) : null}
      </TouchableOpacity>
      {showDivider ? <View style={s.menuDivider} /> : null}
    </View>
  );
}

type ProfileMenuRowProps = {
  title: string;
  icon: LucideIcon;
  onPress: () => void;
  showDivider?: boolean;
  danger?: boolean;
};

export function ProfileMenuRow({
  title,
  icon: Icon,
  onPress,
  showDivider = true,
  danger,
}: ProfileMenuRowProps) {
  const tokens = useDesignTokens();
  const s = styles(tokens);
  const iconColor = danger ? tokens.colors.danger.main : tokens.colors.text.primary;

  return (
    <View>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={s.menuRow}>
        <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
        <View style={s.menuTextCol}>
          <Text style={[s.title, danger && { color: tokens.colors.danger.main }]}>{title}</Text>
        </View>
        <View style={s.leadingIcon}>
          <Icon size={20} color={iconColor} strokeWidth={2} />
        </View>
      </TouchableOpacity>
      {showDivider ? <View style={s.menuDivider} /> : null}
    </View>
  );
}

type ProfileIdentityCardProps = {
  name: string;
  email: string;
  avatarUri?: string | null;
  onPress: () => void;
};

/** כרטיס זהות בראש הפרופיל — אותה שורת תפריט (שברון, כותרת+משנה, אווטאר). */
export function ProfileIdentityCard({
  name,
  email,
  avatarUri,
  onPress,
}: ProfileIdentityCardProps) {
  const tokens = useDesignTokens();
  const s = styles(tokens);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel="עריכת פרופיל"
    >
      <SettingsGlassCard>
        <View style={s.menuRow}>
          <ChevronLeft size={20} color={tokens.colors.text.tertiary} strokeWidth={2} />
          <View style={s.menuTextCol}>
            <Text style={s.title} numberOfLines={1}>
              {name}
            </Text>
            {email ? (
              <Text style={s.email} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </View>
          <View style={s.leadingIcon}>
            <View style={s.identityAvatar}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={s.identityAvatarImage} resizeMode="cover" />
              ) : (
                <User size={26} color={tokens.colors.text.primary} strokeWidth={2} />
              )}
            </View>
          </View>
        </View>
      </SettingsGlassCard>
    </TouchableOpacity>
  );
}

const SCOPE_SLIDE_MS = 280;

/** בחירה קומפקטית בתוך כרטיס: הכול / לפי הבחירה שלי. גלולה עם אגודל מחליק. בלי ירוק — זה לא CTA. */
export function SettingsScopeChoice({
  value,
  onChange,
  disabled,
  showDivider = true,
}: {
  value: NotificationAlertScope;
  onChange: (next: NotificationAlertScope) => void;
  disabled?: boolean;
  showDivider?: boolean;
}) {
  const tokens = useDesignTokens();
  const s = styles(tokens);
  const labelOn = tokens.colors.text.primary;
  const labelOff = tokens.colors.text.secondary;
  const selectedX = useSharedValue(0);
  const allX = useSharedValue(0);
  const thumbX = useSharedValue(0);
  const emphasis = useSharedValue(value === 'all' ? 1 : 0);
  const [thumbWidth, setThumbWidth] = useState(0);
  const measuredRef = useRef({ selected: false, all: false });
  const readyRef = useRef(false);

  const slideTo = useCallback(
    (scope: NotificationAlertScope, animate: boolean) => {
      const x = scope === 'all' ? allX.value : selectedX.value;
      thumbX.value = animate
        ? withTiming(x, { duration: SCOPE_SLIDE_MS, easing: Easing.out(Easing.cubic) })
        : x;
    },
    [allX, selectedX, thumbX],
  );

  useEffect(() => {
    emphasis.value = withTiming(value === 'all' ? 1 : 0, {
      duration: SCOPE_SLIDE_MS,
      easing: Easing.out(Easing.cubic),
    });
    if (!readyRef.current) return;
    slideTo(value, true);
  }, [emphasis, slideTo, value]);

  const onOptionLayout = (scope: NotificationAlertScope) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    if (width <= 0) return;
    if (scope === 'all') allX.value = x;
    else selectedX.value = x;
    measuredRef.current[scope] = true;
    setThumbWidth((prev) => (Math.abs(prev - width) < 0.5 ? prev : width));
    if (!measuredRef.current.selected || !measuredRef.current.all) return;
    if (!readyRef.current) {
      readyRef.current = true;
      slideTo(value, false);
      return;
    }
    if (scope === value) thumbX.value = x;
  };

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: thumbX.value }],
  }));

  const selectedLabelStyle = useAnimatedStyle(
    () => ({
      color: interpolateColor(emphasis.value, [0, 1], [labelOn, labelOff]),
    }),
    [labelOn, labelOff],
  );
  const allLabelStyle = useAnimatedStyle(
    () => ({
      color: interpolateColor(emphasis.value, [0, 1], [labelOff, labelOn]),
    }),
    [labelOn, labelOff],
  );

  const option = (
    scope: NotificationAlertScope,
    label: string,
    labelStyle: TextStyle,
  ) => (
    <Pressable
      key={scope}
      disabled={disabled}
      onPress={() => {
        if (value === scope) return;
        onChange(scope);
      }}
      onLayout={onOptionLayout(scope)}
      style={s.scopeOption}
    >
      <Animated.Text style={[s.scopeLabel, labelStyle]}>{label}</Animated.Text>
    </Pressable>
  );

  return (
    <View style={disabled ? { opacity: 0.45 } : undefined}>
      <View style={s.menuRow}>
        <View style={[s.scopeTrack, { backgroundColor: tokens.colors.background.tertiary }]}>
          <View style={s.scopeInner}>
            <Animated.View
              pointerEvents="none"
              style={[
                s.scopeThumb,
                {
                  width: thumbWidth,
                  backgroundColor: tokens.colors.background.cardSolid,
                },
                thumbStyle,
              ]}
            />
            {option('selected', 'לפי הבחירה שלי', selectedLabelStyle)}
            {option('all', 'הכול', allLabelStyle)}
          </View>
        </View>
      </View>
      {showDivider ? <View style={s.menuDivider} /> : null}
    </View>
  );
}

export function SettingsVersionFooter() {
  const tokens = useDesignTokens();
  return (
    <View style={{ alignItems: 'center', marginTop: tokens.spacing.md, marginBottom: tokens.spacing.lg }}>
      <Text style={styles(tokens).versionText}>
        {isolateNumericRuns(`DarkPool · גרסה ${getAppVersionLabel()}`)}
      </Text>
    </View>
  );
}

function styles(tokens: ReturnType<typeof useDesignTokens>) {
  return StyleSheet.create({
    // App.tsx: direction LTR — chevron/switch ראשונים בעץ → שמאל ויזואלי
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 15,
      paddingHorizontal: tokens.layout.cardPadding,
    },
    menuTextCol: {
      flex: 1,
      minWidth: 0,
    },
    leadingIcon: {
      marginLeft: 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      ...settingsHebrewText,
      ...appCardTitleStyle,
      color: tokens.colors.text.primary,
    },
    subtitle: {
      ...settingsHebrewText,
      ...settingsRowSubtitleStyle,
      color: tokens.colors.text.secondary,
    },
    email: {
      ...settingsHebrewText,
      ...settingsRowSubtitleStyle,
      color: tokens.colors.text.secondary,
      writingDirection: 'ltr',
    },
    identityAvatar: {
      width: 56,
      height: 56,
      borderRadius: 28,
      overflow: 'hidden',
      backgroundColor: tokens.colors.background.tertiary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    identityAvatarImage: {
      width: '100%',
      height: '100%',
    },
    menuDivider: {
      height: 1,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: tokens.layout.cardPadding,
    },
    scopeTrack: {
      flex: 1,
      borderRadius: tokens.borderRadius.full,
      padding: 3,
      overflow: 'hidden',
    },
    scopeInner: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    scopeThumb: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      left: 0,
      borderRadius: tokens.borderRadius.full,
    },
    scopeOption: {
      flex: 1,
      zIndex: 1,
      paddingVertical: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scopeLabel: {
      ...settingsButtonLabelStyle,
      textAlign: 'center',
    },
    versionText: {
      ...settingsHebrewText,
      ...appCaptionStyle,
      color: tokens.colors.text.muted,
    },
  });
}
