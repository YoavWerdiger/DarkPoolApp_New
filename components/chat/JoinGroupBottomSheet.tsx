import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import React, { useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, Platform, Dimensions } from 'react-native';
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
import { APP_LAYOUT } from '../ui/appLayout';
import UIButton from '../ui/UIButton';

const AVATAR = 84;
/** גובה התוכן הקבוע (טבעת + שם + חברים + כפתור) — הערכה מדויקת כדי שהשיט ייפתח ישר לגובה הנכון בלי «קפיצה» */
const CONTENT_EST_PX = 8 + (AVATAR + 12) + 16 + 30 + 28 + 56;

/** זהב Premium — כמו תגית מסחר מוקדם */
const PREMIUM_GOLD = '#C7950F';

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
  /** קבוצת פרימיום למשתמש חינמי — השיט משווק Premium במקום הצטרפות */
  premiumLocked?: boolean;
  onUpgrade?: () => void;
}

export default function JoinGroupBottomSheet({
  visible,
  onClose,
  onJoin,
  group: groupProp,
  isJoining = false,
  premiumLocked = false,
  onUpgrade,
}: JoinGroupBottomSheetProps) {
  // שומרים את הקבוצה האחרונה — כדי שהתוכן לא ייעלם באמצע אנימציית הסגירה
  const lastGroup = useRef<GroupInfo | null>(null);
  if (groupProp) lastGroup.current = groupProp;
  const group = groupProp ?? lastGroup.current;
  const DesignTokens = useDesignTokens();
  const { isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const estimate = (CONTENT_EST_PX + sheetBottomPad + 28) / Dimensions.get('window').height;
  const { snapPoint, onContentLayout, contentHeight } = useChatFitContentSnap(
    estimate,
    0.8,
    0.22,
    `${visible}-${group?.id ?? ''}-${premiumLocked ? 'p' : 'j'}`,
  );
  // מודדים את התוכן מחוץ למסך לפני הפתיחה — כך השיט עולה ישר לגובה הסופי, בלי «קפיצה» באמצע האנימציה
  const [measuredId, setMeasuredId] = useState<string | null>(null);
  const ready = !!group && measuredId === group.id && contentHeight != null;
  const sheetVisible = visible && ready;

  const styles = useMemo(() => StyleSheet.create({
    measurer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      opacity: 0,
      transform: [{ translateY: 10000 }],
    },
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
      writingDirection: TEXT_DIR,
    },
    description: {
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      color: DesignTokens.colors.text.secondary,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
      marginTop: APP_LAYOUT.stackGapSmall,
    },
    cta: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.sectionGap,
    },
    lockBadge: {
      position: 'absolute',
      bottom: 2,
      right: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: PREMIUM_GOLD,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: DesignTokens.colors.background.primary,
    },
    premiumTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      height: 26,
      paddingHorizontal: 10,
      borderRadius: 13,
      backgroundColor: `${PREMIUM_GOLD}24`,
      marginBottom: APP_LAYOUT.stackGapSmall,
    },
    premiumTagText: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600',
      color: PREMIUM_GOLD,
    },
    perks: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.componentGap + 4,
      paddingVertical: 4,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      borderRadius: 22,
      backgroundColor: DesignTokens.colors.background.cardSolid,
    },
    perkRow: {
      flexDirection: 'row-reverse',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
    },
    perkDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: DesignTokens.colors.border.divider,
    },
    perkText: {
      flex: 1,
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      color: DesignTokens.colors.text.primary,
      textAlign: 'right',
      writingDirection: TEXT_DIR,
    },
    footnote: {
      ...APP_TYPE.caption,
      marginTop: APP_LAYOUT.stackGapSmall + 4,
      color: DesignTokens.colors.text.tertiary,
      textAlign: 'center',
    },
  }), [DesignTokens]);

  if (!group) return null;

  const avatar = groupAvatarSource(group.name, group.avatar_url, isDarkMode);

  const body = (
        <View style={styles.container}>
      <View style={styles.avatarRing}>
        {avatar ? (
          <Image source={avatar} style={styles.avatar} resizeMode="cover" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="people" size={36} color={DesignTokens.colors.text.primary} />
          </View>
        )}
        {premiumLocked ? (
          <View style={styles.lockBadge}>
            <Ionicons name="lock-closed" size={12} color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      {premiumLocked ? (
        <View style={styles.premiumTag}>
          <Ionicons name="star" size={12} color={PREMIUM_GOLD} />
          <Text style={styles.premiumTagText}>{i18n.t('auto.components__chat__JoinGroupBottomSheet.p1')}</Text>
        </View>
      ) : null}

      <Text style={styles.groupName} numberOfLines={2}>
        {chatGroupDisplayName(group.name)}
      </Text>


      {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

      {premiumLocked ? (
        <>
          {/* מה מקבלים עם Premium — ערך מוחשי לפני הכפתור */}
          <View style={styles.perks}>
            {(['p3', 'p4', 'p5'] as const).map((k, i, arr) => (
              <View key={k} style={[styles.perkRow, i < arr.length - 1 && styles.perkDivider]}>
                <Ionicons name="checkmark-circle" size={20} color={PREMIUM_GOLD} />
                <Text style={styles.perkText}>{i18n.t(`auto.components__chat__JoinGroupBottomSheet.${k}`)}</Text>
              </View>
            ))}
          </View>
          <View style={styles.cta}>
            <UIButton
              title={i18n.t('auto.components__chat__JoinGroupBottomSheet.p2')}
              variant="primary"
              size="lg"
              fullWidth
              onPress={() => onUpgrade?.()}
            />
            <Text style={styles.footnote}>{i18n.t('auto.components__chat__JoinGroupBottomSheet.p6')}</Text>
          </View>
        </>
      ) : (
      <View style={styles.cta}>
        <UIButton
          title={isJoining ? i18n.t('auto.components__chat__JoinGroupBottomSheet.s1') : i18n.t('auto.components__chat__JoinGroupBottomSheet.s2')}
          variant="primary"
          size="lg"
          fullWidth
          loading={isJoining}
          disabled={isJoining}
          onPress={onJoin}
        />
      </View>
      )}
    </View>
  );

  return (
    <>
    {visible && !ready ? (
      // מודד נסתר — אותו תוכן ואותו ריפוד כמו בשיט
      <View
        pointerEvents="none"
        style={styles.measurer}
        onLayout={(e) => {
          onContentLayout(e);
          if (group) setMeasuredId(group.id);
        }}
      >
        <View style={{ paddingBottom: sheetBottomPad }}>{body}</View>
      </View>
    ) : null}
    <ChatBottomSheet
      visible={sheetVisible}
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
        {body}
      </ChatSheetContent>
    </ChatBottomSheet>
    </>
  );
}
