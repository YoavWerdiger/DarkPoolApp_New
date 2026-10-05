import { logger } from '../../utils/logger';
import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChatMessage, ChatReactionGroup } from '../../types/chat.types';
import { chatMessageService } from '../../services/chat';
import {
  ChatSheetEmptyState,
  ChatSheetLoading,
  ChatSheetTopoHeader,
  useChatFitContentSnap,
} from './ChatBottomSheet';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT, UI_CARD_RADIUS } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { formatDistanceToNow } from 'date-fns';
import { he } from 'date-fns/locale';

interface ReactionDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}

function UserReactionAvatar({
  uri,
  name,
  avatarStyle,
  imageStyle,
  textStyle,
}: {
  uri?: string | null;
  name: string;
  avatarStyle: object;
  imageStyle: object;
  textStyle: object;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        source={{ uri }}
        style={imageStyle}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View style={avatarStyle}>
      <Text style={textStyle}>{name.charAt(0).toUpperCase()}</Text>
    </View>
  );
}

const ReactionDetailsModal: React.FC<ReactionDetailsModalProps> = memo(({
  visible,
  onClose,
  message,
}) => {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const [reactionDetails, setReactionDetails] = useState<ChatReactionGroup[]>([]);
  const [selectedTab, setSelectedTab] = useState<'all' | string>('all');
  const [loading, setLoading] = useState(false);

  const sheetBottomPad = useMemo(() => {
    const minBottom = Platform.OS === 'android' ? 16 : 8;
    return Math.max(insets.bottom, minBottom);
  }, [insets.bottom]);

  const { snapPoint, onContentLayout } = useChatFitContentSnap(
    0.5,
    0.85,
    0.48,
    visible ? message?.id : null,
  );

  useEffect(() => {
    if (visible && message?.id) {
      loadReactionDetails();
    } else {
      setReactionDetails([]);
      setSelectedTab('all');
    }
  }, [visible, message?.id]);

  const loadReactionDetails = async () => {
    if (!message?.id) return;

    setLoading(true);
    try {
      const { data, error } = await chatMessageService.getMessageReactionDetails(message.id);
      if (error) {
        logger.error('ReactionDetailsModal', 'Failed to load reaction details', error);
      } else if (data) {
        setReactionDetails(data);
      }
    } catch (error) {
      logger.error('ReactionDetailsModal', 'Unexpected error loading reactions', error);
    } finally {
      setLoading(false);
    }
  };

  const reactionTypes = useMemo(() => reactionDetails.map(r => r.emoji), [reactionDetails]);
  const allReactions = useMemo(
    () =>
      reactionDetails.flatMap(r =>
        r.users.map(user => ({
          emoji: r.emoji,
          userId: user.id,
          userName: user.name,
          profilePicture: user.profile_picture,
          reactedAt: (user as { reacted_at?: string }).reacted_at,
        })),
      ),
    [reactionDetails],
  );

  const filteredReactions = useMemo(
    () =>
      selectedTab === 'all'
        ? allReactions
        : allReactions.filter(r => r.emoji === selectedTab),
    [allReactions, selectedTab],
  );

  const localStyles = useMemo(
    () =>
      StyleSheet.create({
        contentWrap: {
          paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
          direction: 'rtl' as const,
          paddingBottom: sheetBottomPad,
        },
        tabsRow: {
          flexDirection: 'row',
          gap: 8,
          paddingVertical: APP_LAYOUT.cardTitleToBodyGap,
        },
        tab: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          paddingHorizontal: 14,
          height: 36,
          borderRadius: 999,
        },
        tabText: {
          fontSize: APP_TYPE.cardSubtitle.fontSize,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          writingDirection: 'rtl',
        },
        tabEmoji: {
          fontSize: 18,
        },
        card: {
          borderRadius: UI_CARD_RADIUS,
          backgroundColor: tokens.colors.background.cardSolid,
          paddingHorizontal: APP_LAYOUT.cardPadding,
          minHeight: 120,
          maxHeight: 380,
        },
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
        },
        divider: {
          height: StyleSheet.hairlineWidth,
          backgroundColor: tokens.colors.border.divider,
        },
        avatar: {
          width: 40,
          height: 40,
          borderRadius: 20,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.background.tertiary,
        },
        avatarText: {
          fontSize: APP_TYPE.cardTitle.fontSize,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
        },
        info: {
          flex: 1,
        },
        name: {
          fontSize: APP_TYPE.cardTitle.fontSize,
          lineHeight: APP_TYPE.cardTitle.lineHeight,
          fontWeight: APP_TYPE.cardTitle.fontWeight,
          color: tokens.colors.text.primary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        meta: {
          fontSize: APP_TYPE.cardSubtitle.fontSize,
          lineHeight: APP_TYPE.cardSubtitle.lineHeight,
          color: tokens.colors.text.secondary,
          textAlign: 'right',
          writingDirection: 'rtl',
        },
        userEmoji: {
          fontSize: 24,
          flexShrink: 0,
        },
      }),
    [sheetBottomPad, tokens],
  );

  const tabStyle = (active: boolean) => [
    localStyles.tab,
    { backgroundColor: active ? tokens.colors.text.primary : tokens.colors.background.cardSolid },
  ];
  const tabTextColor = (active: boolean) => ({
    color: active ? tokens.colors.text.inverse : tokens.colors.text.primary,
  });

  return (
    // לפי הטופו (כמו 3 הנקודות ביומן): קנבס, כותרת עם שברון, צ׳יפים וכרטיס שורות
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      edgeToEdge
      showHandle
      enablePanDownToClose
      useModal
      showBrandBackground={false}
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
      contentPaddingBottom={0}
    >
      <View style={localStyles.contentWrap} onLayout={onContentLayout}>
        <ChatSheetTopoHeader title="ריאקציות" onClose={onClose} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={localStyles.tabsRow}>
          <Pressable onPress={() => setSelectedTab('all')} style={tabStyle(selectedTab === 'all')}>
            <Text style={[localStyles.tabText, tabTextColor(selectedTab === 'all')]}>
              הכל {allReactions.length}
            </Text>
          </Pressable>
          {reactionTypes.map((emoji) => (
            <Pressable key={emoji} onPress={() => setSelectedTab(emoji)} style={tabStyle(selectedTab === emoji)}>
              <Text style={localStyles.tabEmoji}>{emoji}</Text>
              <Text style={[localStyles.tabText, tabTextColor(selectedTab === emoji)]}>
                {reactionDetails.find((r) => r.emoji === emoji)?.count}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={localStyles.card}>
          {loading ? (
            <ChatSheetLoading />
          ) : filteredReactions.length === 0 ? (
            <ChatSheetEmptyState title="אין ריאקציות" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {filteredReactions.map((item, index) => (
                <View key={`${item.userId}-${item.emoji}-${index}`}>
                  {index > 0 ? <View style={localStyles.divider} /> : null}
                  <View style={localStyles.row}>
                    <UserReactionAvatar
                      uri={item.profilePicture}
                      name={item.userName}
                      avatarStyle={localStyles.avatar}
                      imageStyle={localStyles.avatar}
                      textStyle={localStyles.avatarText}
                    />
                    <View style={localStyles.info}>
                      <Text style={localStyles.name} numberOfLines={1}>{item.userName}</Text>
                      {item.reactedAt ? (
                        <Text style={localStyles.meta}>
                          {formatDistanceToNow(new Date(item.reactedAt), { addSuffix: true, locale: he })}
                        </Text>
                      ) : null}
                    </View>
                    <Text style={localStyles.userEmoji} allowFontScaling={false}>
                      {item.emoji}
                    </Text>
                  </View>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </BottomSheet>
  );
});

export default ReactionDetailsModal;
