/**
 * עטיפה אחידה לכל bottom sheets בצ'אט — רקע זכוכית, backdrop, כותרות ורשימות.
 */
import React, { useMemo } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  Image,
  TextInput,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { DayNavBlurButton, DAY_NAV_BUTTON_SIZE } from '../ui/DayNavBlurButton';
import { chatPalette, chatRtlRow, chatRtlText } from './chatDesignTokens';

export const CHAT_SHEET_BACKDROP_OPACITY = 0.4;
export const CHAT_SHEET_WATERMARK_SCALE = 0.58;

type ChatBottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  snapPoints?: number[];
  fitContent?: boolean;
  edgeToEdge?: boolean;
  brandWatermarkScale?: number;
  children: React.ReactNode;
};

export function ChatBottomSheet({
  visible,
  onClose,
  snapPoints = [0.5],
  fitContent,
  edgeToEdge = true,
  brandWatermarkScale = CHAT_SHEET_WATERMARK_SCALE,
  children,
}: ChatBottomSheetProps) {
  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={snapPoints}
      showHandle
      enablePanDownToClose
      useModal
      backdropOpacity={CHAT_SHEET_BACKDROP_OPACITY}
      showBrandBackground
      edgeToEdge={edgeToEdge}
      fitContent={fitContent}
      brandWatermarkScale={brandWatermarkScale}
    >
      {children}
    </BottomSheet>
  );
}

export function ChatSheetContent({
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
          backgroundColor: 'transparent',
          paddingHorizontal: tokens.spacing.md,
          direction: 'rtl',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function ChatSheetTitle({ title }: { title: string }) {
  const sheet = useChatSheetStyles();
  return (
    <View style={sheet.header}>
      <View style={sheet.titlePill}>
        <Text style={sheet.titleText}>{title}</Text>
      </View>
    </View>
  );
}

export function ChatSheetNavHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const sheet = useChatSheetStyles();
  const tokens = useDesignTokens();
  return (
    <View style={sheet.navHeaderRow}>
      <DayNavBlurButton
        onPress={onClose}
        size={DAY_NAV_BUTTON_SIZE}
        glassIntensity="subtle"
        accessibilityLabel="חזרה"
      >
        <Ionicons name="chevron-forward" size={22} color={tokens.colors.text.primary} />
      </DayNavBlurButton>
      <View style={sheet.titlePill}>
        <Text style={sheet.titleText}>{title}</Text>
      </View>
      <View style={sheet.navSideSpacer} />
    </View>
  );
}

type ChatSheetSearchBarProps = {
  value: string;
  onChangeText: (text: string) => void;
  onSubmit?: () => void;
  onClear?: () => void;
  placeholder?: string;
  inputRef?: React.RefObject<TextInput | null>;
  loading?: boolean;
  onSearchPress?: () => void;
  searchDisabled?: boolean;
};

export function ChatSheetSearchBar({
  value,
  onChangeText,
  onSubmit,
  onClear,
  placeholder = 'חיפוש...',
  inputRef,
  loading = false,
  onSearchPress,
  searchDisabled,
}: ChatSheetSearchBarProps) {
  const sheet = useChatSheetStyles();
  const tokens = useDesignTokens();
  const canSearch = !searchDisabled && value.trim().length > 0;

  return (
    <View style={sheet.searchRow}>
      <View style={sheet.searchField}>
        <Ionicons name="search" size={18} color={tokens.colors.text.secondary} />
        <TextInput
          ref={inputRef}
          style={sheet.searchInput}
          placeholder={placeholder}
          placeholderTextColor={tokens.colors.text.tertiary}
          value={value}
          onChangeText={onChangeText}
          onSubmitEditing={onSubmit}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="none"
        />
        {value.length > 0 ? (
          <Pressable onPress={onClear} hitSlop={8} style={({ pressed }) => pressed && { opacity: 0.6 }}>
            <Ionicons name="close-circle" size={18} color={tokens.colors.text.tertiary} />
          </Pressable>
        ) : null}
      </View>
      <Pressable
        onPress={onSearchPress ?? onSubmit}
        disabled={!canSearch || loading}
        style={({ pressed }) => [
          sheet.searchAction,
          !canSearch && sheet.searchActionDisabled,
          pressed && canSearch && { opacity: 0.85 },
        ]}
      >
        {loading ? (
          <ActivityIndicator size="small" color={tokens.colors.text.inverse} />
        ) : (
          <Ionicons name="search" size={20} color={tokens.colors.text.inverse} />
        )}
      </Pressable>
    </View>
  );
}

export function ChatSheetCancelButton({
  onPress,
  label = 'ביטול',
}: {
  onPress: () => void;
  label?: string;
}) {
  const sheet = useChatSheetStyles();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [sheet.cancelButton, pressed && { opacity: 0.7 }]}
    >
      <Text style={sheet.cancelButtonText}>{label}</Text>
    </Pressable>
  );
}

export function ChatSheetEmptyState({
  icon,
  title,
  subtitle,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
}) {
  const sheet = useChatSheetStyles();
  const tokens = useDesignTokens();
  return (
    <View style={sheet.emptyState}>
      {icon ? (
        <Ionicons name={icon} size={48} color={tokens.colors.text.tertiary} />
      ) : null}
      <Text style={sheet.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={sheet.emptySubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function ChatSheetLoading({ label = 'טוען...' }: { label?: string }) {
  const sheet = useChatSheetStyles();
  const tokens = useDesignTokens();
  return (
    <View style={sheet.loadingBox}>
      <ActivityIndicator size="large" color={tokens.colors.primary.main} />
      <Text style={sheet.loadingText}>{label}</Text>
    </View>
  );
}

export function ChatSheetUserRow({
  name,
  subtitle,
  meta,
  avatarUri,
  trailing,
}: {
  name: string;
  subtitle?: string;
  meta?: string;
  avatarUri?: string | null;
  trailing?: React.ReactNode;
}) {
  const sheet = useChatSheetStyles();
  const initial = name.charAt(0).toUpperCase();

  return (
    <View style={sheet.userRow}>
      {avatarUri ? (
        <Image source={{ uri: avatarUri }} style={sheet.userAvatarImage} />
      ) : (
        <View style={sheet.userAvatar}>
          <Text style={sheet.userAvatarText}>{initial}</Text>
        </View>
      )}
      <View style={sheet.userInfo}>
        <Text style={sheet.userName} numberOfLines={1}>
          {name}
        </Text>
        {subtitle ? (
          <Text style={sheet.userSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
        {meta ? <Text style={sheet.userMeta}>{meta}</Text> : null}
      </View>
      {trailing ? <View style={sheet.userTrailing}>{trailing}</View> : null}
    </View>
  );
}

export function useChatSheetStyles() {
  const tokens = useDesignTokens();
  return useMemo(
    () =>
      StyleSheet.create({
        header: {
          alignItems: 'center',
          paddingTop: tokens.spacing.xs,
          paddingBottom: tokens.spacing.md,
        },
        navHeaderRow: {
          ...chatRtlRow,
          direction: 'rtl',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: tokens.spacing.xs,
          paddingBottom: tokens.spacing.md,
          gap: tokens.spacing.sm,
        },
        navSideSpacer: {
          width: DAY_NAV_BUTTON_SIZE,
          height: DAY_NAV_BUTTON_SIZE,
        },
        searchRow: {
          ...chatRtlRow,
          direction: 'rtl',
          alignItems: 'center',
          gap: tokens.spacing.sm,
          marginBottom: tokens.spacing.md,
        },
        searchField: {
          flex: 1,
          ...chatRtlRow,
          direction: 'rtl',
          alignItems: 'center',
          gap: 8,
          backgroundColor: chatPalette.glass,
          borderWidth: 1,
          borderColor: chatPalette.glassBorder,
          borderRadius: 14,
          paddingHorizontal: 12,
          minHeight: 46,
        },
        searchInput: {
          flex: 1,
          ...chatRtlText,
          color: tokens.colors.text.primary,
          fontSize: 16,
          paddingVertical: Platform.OS === 'ios' ? 10 : 8,
        },
        searchAction: {
          width: 46,
          height: 46,
          borderRadius: 14,
          backgroundColor: tokens.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
        },
        searchActionDisabled: {
          backgroundColor: tokens.colors.background.tertiary,
          opacity: 0.55,
        },
        resultItem: {
          paddingVertical: 14,
          paddingHorizontal: tokens.spacing.sm,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: chatPalette.glassBorder,
        },
        resultHeader: {
          ...chatRtlRow,
          direction: 'rtl',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 4,
        },
        resultSender: {
          ...chatRtlText,
          fontSize: 14,
          fontWeight: '600',
          color: tokens.colors.text.primary,
        },
        resultDate: {
          fontSize: 12,
          color: tokens.colors.text.tertiary,
        },
        resultBody: {
          ...chatRtlText,
          fontSize: 15,
          lineHeight: 21,
          color: tokens.colors.text.secondary,
        },
        resultHighlight: {
          backgroundColor: tokens.colors.primary.main + '35',
          fontWeight: '700',
          color: tokens.colors.text.primary,
        },
        titlePill: {
          backgroundColor: tokens.colors.background.secondary,
          borderWidth: 1,
          borderColor: chatPalette.glassBorder,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 20,
        },
        titleText: {
          ...chatRtlText,
          color: tokens.colors.text.primary,
          fontSize: 17,
          fontWeight: '600',
        },
        cancelButton: {
          marginTop: tokens.spacing.md,
          backgroundColor: tokens.colors.background.secondary,
          borderWidth: 1,
          borderColor: chatPalette.glassBorder,
          paddingVertical: 14,
          borderRadius: 12,
          alignItems: 'center',
        },
        cancelButtonText: {
          ...chatRtlText,
          color: tokens.colors.text.secondary,
          fontSize: 16,
          fontWeight: '500',
        },
        tabsScroll: {
          marginBottom: tokens.spacing.md,
          flexGrow: 0,
        },
        tabsContainer: {
          ...chatRtlRow,
          direction: 'rtl',
          backgroundColor: tokens.colors.background.secondary,
          borderRadius: 30,
          borderWidth: 1,
          borderColor: chatPalette.glassBorder,
          padding: 4,
          gap: 4,
          alignItems: 'center',
        },
        tab: {
          ...chatRtlRow,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: 14,
          height: 36,
          borderRadius: 18,
          gap: 6,
        },
        tabActive: {
          backgroundColor: tokens.colors.primary.main + '18',
        },
        tabInactive: {
          backgroundColor: 'transparent',
        },
        tabEmoji: {
          fontSize: 16,
        },
        tabText: {
          fontSize: 14,
          ...chatRtlText,
        },
        tabTextActive: {
          fontWeight: '700',
          color: tokens.colors.primary.main,
        },
        tabTextInactive: {
          fontWeight: '600',
          color: tokens.colors.text.secondary,
        },
        userRow: {
          ...chatRtlRow,
          direction: 'rtl',
          alignItems: 'center',
          paddingVertical: 14,
          paddingHorizontal: tokens.spacing.sm,
          gap: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: tokens.colors.border.divider,
        },
        userAvatar: {
          width: 40,
          height: 40,
          backgroundColor: tokens.colors.primary.main + '15',
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        },
        userAvatarImage: {
          width: 40,
          height: 40,
          borderRadius: 20,
          flexShrink: 0,
        },
        userAvatarText: {
          fontSize: 16,
          fontWeight: '600',
          color: tokens.colors.primary.main,
        },
        userInfo: {
          flex: 1,
          minWidth: 0,
          alignItems: 'flex-start',
        },
        userName: {
          color: tokens.colors.text.primary,
          fontSize: 15,
          fontWeight: '600',
          ...chatRtlText,
        },
        userSubtitle: {
          color: tokens.colors.text.secondary,
          fontSize: 13,
          marginTop: 2,
          ...chatRtlText,
        },
        userMeta: {
          color: tokens.colors.text.tertiary,
          fontSize: 12,
          marginTop: 2,
          ...chatRtlText,
        },
        userTrailing: {
          flexShrink: 0,
        },
        emptyState: {
          alignItems: 'center',
          paddingVertical: 32,
          gap: 8,
        },
        emptyTitle: {
          ...chatRtlText,
          color: tokens.colors.text.secondary,
          fontSize: 16,
          fontWeight: '600',
          textAlign: 'center',
        },
        emptySubtitle: {
          ...chatRtlText,
          color: tokens.colors.text.tertiary,
          fontSize: 14,
          textAlign: 'center',
        },
        loadingBox: {
          alignItems: 'center',
          paddingVertical: 32,
        },
        loadingText: {
          color: tokens.colors.text.secondary,
          marginTop: 12,
          fontSize: 15,
          ...chatRtlText,
        },
        emojiGrid: {
          paddingHorizontal: 4,
        },
        emojiRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 10,
        },
        emojiButton: {
          width: 48,
          height: 48,
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 12,
        },
        emojiButtonPressed: {
          backgroundColor: tokens.colors.background.secondary,
          transform: [{ scale: 1.12 }],
        },
        emojiButtonSelected: {
          backgroundColor: tokens.colors.primary.main + '20',
          borderWidth: 2,
          borderColor: tokens.colors.primary.main,
        },
        emoji: {
          fontSize: 28,
        },
        emojiSelectedBadge: {
          position: 'absolute',
          top: 2,
          right: 2,
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: tokens.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
        },
        emojiSelectedBadgeText: {
          color: tokens.colors.text.inverse,
          fontSize: 10,
          fontWeight: '700',
        },
      }),
    [tokens],
  );
}
