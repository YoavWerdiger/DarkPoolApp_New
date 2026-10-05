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
  group: groupProp,
  isJoining = false,
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
    `${visible}-${group?.id ?? ''}`,
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
      writingDirection: 'rtl',
    },
    description: {
      fontSize: APP_TYPE.cardBody.fontSize,
      lineHeight: APP_TYPE.cardBody.lineHeight,
      color: DesignTokens.colors.text.secondary,
      textAlign: 'center',
      writingDirection: 'rtl',
      marginTop: APP_LAYOUT.stackGapSmall,
    },
    cta: {
      alignSelf: 'stretch',
      marginTop: APP_LAYOUT.sectionGap,
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
      </View>

      <Text style={styles.groupName} numberOfLines={2}>
        {chatGroupDisplayName(group.name)}
      </Text>


      {group.description ? <Text style={styles.description}>{group.description}</Text> : null}

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
