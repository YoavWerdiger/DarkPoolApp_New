import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { IS_RTL_UI, UI_DIR } from '../../lib/i18n/direction';
import { appLocale } from '../../lib/i18n/locale';
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
const CONTENT_EST_PX = 8 + (AVATAR + 12) + 16 + 30 + 28 + 36 + 150 + 56;

/** זהב Premium — כמו תגית מסחר מוקדם */
const PREMIUM_GOLD = '#C7950F';

interface GroupInfo {
  id: string;
  name: string;
  description?: string;
  avatar_url?: string;
  members_count?: number;
  messages_count?: number;
  settings?: { is_announcement?: boolean; onlyAdminsCanSend?: boolean } | null;
}

/** יישור טקסט לפי שפת הממשק (עברית / ערבית לימין, אנגלית לשמאל) */
const START_ALIGN = IS_RTL_UI ? 'right' : 'left';

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
      // כל השיט לפי כיוון שפת הממשק — שורות ואייקונים מתהפכים לבד באנגלית
      direction: UI_DIR,
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
      end: 2,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: PREMIUM_GOLD,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: DesignTokens.colors.background.primary,
    },
    // A quiet line under the name, lock after the words (row follows UI_DIR on the container)
    premiumTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 6,
    },
    premiumTagText: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: PREMIUM_GOLD,
    },
    premiumPerks: {
      alignSelf: 'stretch',
      gap: 14,
      marginTop: APP_LAYOUT.componentGap + 8,
      paddingHorizontal: 4,
    },
    premiumPerkRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
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
      flexDirection: 'row',
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
      textAlign: START_ALIGN,
      writingDirection: TEXT_DIR,
    },
    perkTitle: {
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      fontWeight: '600',
      color: DesignTokens.colors.text.primary,
      textAlign: START_ALIGN,
      writingDirection: TEXT_DIR,
    },
    perkSub: {
      ...APP_TYPE.caption,
      color: DesignTokens.colors.text.secondary,
      textAlign: START_ALIGN,
      writingDirection: TEXT_DIR,
      marginTop: 2,
    },
    perkIcon: {
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: DesignTokens.colors.background.tertiary,
    },
    stats: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      marginTop: APP_LAYOUT.stackGapSmall,
    },
    statChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 5,
      height: 28,
      paddingHorizontal: 10,
      borderRadius: 14,
      backgroundColor: DesignTokens.colors.background.cardSolid,
    },
    statText: {
      ...APP_TYPE.caption,
      fontWeight: '600',
      color: DesignTokens.colors.text.secondary,
      fontVariant: ['tabular-nums'],
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
  const isAnnouncement = !!(group.settings?.is_announcement || group.settings?.onlyAdminsCanSend);

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
      </View>

      <Text style={styles.groupName} numberOfLines={2}>
        {chatGroupDisplayName(group.name)}
      </Text>

      {premiumLocked ? (
        <View style={styles.premiumTag}>
          <Text style={styles.premiumTagText}>{i18n.t('auto.components__chat__JoinGroupBottomSheet.p1')}</Text>
          <Ionicons name="lock-closed" size={12} color={PREMIUM_GOLD} />
        </View>
      ) : null}


      {/* חברים / הודעות — שהשיט לא ירגיש ריק כשאין תיאור */}
      {(group.members_count ?? 0) > 0 || (group.messages_count ?? 0) > 0 ? (
        <View style={styles.stats}>
          {(group.members_count ?? 0) > 0 ? (
            <View style={styles.statChip}>
              <Ionicons name="people-outline" size={14} color={DesignTokens.colors.text.secondary} />
              <Text style={styles.statText}>
                {group.members_count === 1
                  ? i18n.t('auto.components__chat__JoinGroupBottomSheet.j8')
                  : i18n.t('auto.components__chat__JoinGroupBottomSheet.j1', {
                      v0: (group.members_count ?? 0).toLocaleString(appLocale()),
                    })}
              </Text>
            </View>
          ) : null}
          {(group.messages_count ?? 0) > 0 ? (
            <View style={styles.statChip}>
              <Ionicons name="chatbubble-outline" size={13} color={DesignTokens.colors.text.secondary} />
              <Text style={styles.statText}>
                {i18n.t('auto.components__chat__JoinGroupBottomSheet.j2', {
                  v0: (group.messages_count ?? 0).toLocaleString(appLocale()),
                })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

      {premiumLocked ? (
        <>
          {/* מה מקבלים עם Premium — ערך מוחשי לפני הכפתור */}
          <View style={styles.premiumPerks}>
            {(['p3', 'p4', 'p5'] as const).map((k) => (
              <View key={k} style={styles.premiumPerkRow}>
                <Ionicons name="checkmark" size={18} color={PREMIUM_GOLD} />
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
              style={{ backgroundColor: PREMIUM_GOLD }}
              textStyle={{ color: '#1A1918' }}
              onPress={() => onUpgrade?.()}
            />
            <Text style={styles.footnote}>{i18n.t('auto.components__chat__JoinGroupBottomSheet.p6')}</Text>
          </View>
        </>
      ) : (
      <>
      {/* מה זה הערוץ הזה — הכרזות או דיון */}
      <View style={styles.perks}>
        {(isAnnouncement
          ? [
              { icon: 'megaphone-outline' as const, title: 'j3', sub: 'j4' },
              { icon: 'notifications-off-outline' as const, title: null, sub: 'j7' },
            ]
          : [
              { icon: 'chatbubbles-outline' as const, title: 'j5', sub: 'j6' },
              { icon: 'notifications-off-outline' as const, title: null, sub: 'j7' },
            ]
        ).map((row, i, arr) => (
          <View key={row.sub} style={[styles.perkRow, i < arr.length - 1 && styles.perkDivider]}>
            <View style={styles.perkIcon}>
              <Ionicons name={row.icon} size={18} color={DesignTokens.colors.text.primary} />
            </View>
            <View style={{ flex: 1 }}>
              {row.title ? (
                <Text style={styles.perkTitle}>{i18n.t(`auto.components__chat__JoinGroupBottomSheet.${row.title}`)}</Text>
              ) : null}
              <Text style={row.title ? styles.perkSub : styles.perkText}>
                {i18n.t(`auto.components__chat__JoinGroupBottomSheet.${row.sub}`)}
              </Text>
            </View>
          </View>
        ))}
      </View>
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
      </>
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
