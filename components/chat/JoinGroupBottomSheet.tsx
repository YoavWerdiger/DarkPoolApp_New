import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import { chatGroupDisplayName, groupAvatarSource } from '../../assets/chatGroups/groupChatIcons';
import {
  ChatBottomSheet,
  ChatSheetContent,
  useChatFitContentSnap,
} from './ChatBottomSheet';
import { APP_TYPE, appSectionTitleStyle } from '../ui/appType';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import UIButton from '../ui/UIButton';

const AVATAR = 84;

const PERKS: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
  { icon: 'chatbubbles-outline', text: 'דיונים חיים עם סוחרים מהקהילה' },
  { icon: 'flash-outline', text: 'עדכונים ורעיונות מסחר בזמן אמת' },
  { icon: 'notifications-outline', text: 'התראות על הודעות ואזכורים' },
];

interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  members_count?: number;
}

interface JoinGroupBottomSheetProps {
  visible: boolean;
  onClose: () => void;
  onJoin: () => void;
  group: GroupInfo | null;
  isJoining?: boolean;
}

export default function JoinGroupBottomSheet({
  visible,
  onClose,
  onJoin,
  group,
  isJoining = false,
}: JoinGroupBottomSheetProps) {
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    0.5,
    0.8,
    0.22,
    `${visible}-${group?.id ?? ''}`,
  );

  const styles = useMemo(() => StyleSheet.create({
    container: {
      alignItems: 'center',
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: APP_LAYOUT.stackGapSmall,
    },
    avatarRing: {
      width: AVATAR + 12,
      height: AVATAR + 12,
      borderRadius: (AVATAR + 12) / 2,
      backgroundColor: DesignTokens.colors.background.cardSolid,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: APP_LAYOUT.componentGap,
    },
    avatar: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
    },
    avatarPlaceholder: {
      width: AVATAR,
      height: AVATAR,
      borderRadius: AVATAR / 2,
      backgroundColor: DesignTokens.colors.background.tertiary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    groupName: {
      ...appSectionTitleStyle,
      color: DesignTokens.colors.text.primary,
      textAlign: 'center',
      writingDirection: 'rtl',
    },
    membersPill: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 6,
      marginTop: APP_LAYOUT.stackGapSmall,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 999,
      backgroundColor: DesignTokens.colors.background.cardSolid,
    },
    membersText: {
      fontSize: APP_TYPE.cardSubtitle.fontSize,
      lineHeight: APP_TYPE.cardSubtitle.lineHeight,
      fontWeight: APP_TYPE.cardTitle.fontWeight,
      color: DesignTokens.colors.text.primary,
      writingDirection: 'rtl',
    },
    description: {
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      color: DesignTokens.colors.text.secondary,
      textAlign: 'center',
      writingDirection: 'rtl',
      marginTop: APP_LAYOUT.componentGap,
    },
    perks: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.sectionGap / 2 + 4,
      borderRadius: UI_CARD_RADIUS,
      backgroundColor: DesignTokens.colors.background.cardSolid,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingVertical: 6,
    },
    perkRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    perkDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: DesignTokens.colors.border.divider,
    },
    perkText: {
      flex: 1,
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      color: DesignTokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    cta: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.sectionGap / 2 + 4,
    },
    footnote: {
      fontSize: APP_TYPE.caption.fontSize,
      lineHeight: APP_TYPE.caption.lineHeight,
      color: DesignTokens.colors.text.tertiary,
      textAlign: 'center',
      writingDirection: 'rtl',
      marginTop: APP_LAYOUT.stackGapSmall + 2,
    },
  }), [DesignTokens]);

  if (!group) return null;

  const avatar = groupAvatarSource(group.name, group.avatar_url, isDarkMode);
  const members = group.members_count || 0;

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      showBrandBackground={false}
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <ChatSheetContent
        onLayout={onContentLayout}
        style={{
          backgroundColor: 'transparent',
          paddingBottom: sheetBottomPad,
        }}
      >
        <View style={styles.container}>
          <View style={styles.avatarRing}>
            {avatar ? (
              <Image source={avatar} style={styles.avatar} resizeMode="cover" />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Ionicons name="people" size={36} color={DesignTokens.colors.text.primary} />
              </View>
            )}
          </View>

          <Text style={styles.groupName} numberOfLines={2}>
            {chatGroupDisplayName(group.name)}
          </Text>

          {members > 0 ? (
            <View style={styles.membersPill}>
              <Ionicons name="people" size={14} color={DesignTokens.colors.text.secondary} />
              <Text style={styles.membersText}>
                {members.toLocaleString('he-IL')} חברים בקבוצה
              </Text>
            </View>
          ) : null}

          {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

          <View style={styles.perks}>
            {PERKS.map((p, i) => (
              <View key={p.text} style={[styles.perkRow, i > 0 && styles.perkDivider]}>
                <Ionicons name={p.icon} size={20} color={DesignTokens.colors.text.primary} />
                <Text style={styles.perkText}>{p.text}</Text>
              </View>
            ))}
          </View>

          <View style={styles.cta}>
            <UIButton
              title={isJoining ? 'מצטרף…' : 'הצטרף לקבוצה'}
              variant="primary"
              size="lg"
              fullWidth
              loading={isJoining}
              disabled={isJoining}
              onPress={onJoin}
            />
          </View>
          <Text style={styles.footnote}>אפשר לצאת מהקבוצה בכל רגע</Text>
        </View>
      </ChatSheetContent>
    </ChatBottomSheet>
  );
}
