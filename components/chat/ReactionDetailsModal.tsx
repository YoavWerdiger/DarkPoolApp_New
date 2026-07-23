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
  ChatBottomSheet,
  ChatSheetEmptyState,
  ChatSheetLoading,
  useChatFitContentSnap,
  useChatSheetStyles,
} from './ChatBottomSheet';
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
  const sheet = useChatSheetStyles();
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
        usersContainer: {
          minHeight: 200,
          maxHeight: 360,
        },
        userEmoji: {
          fontSize: 24,
          flexShrink: 0,
        },
        contentWrap: {
          paddingHorizontal: 16,
          direction: 'rtl' as const,
          paddingBottom: sheetBottomPad,
        },
      }),
    [sheetBottomPad],
  );

  return (
    <ChatBottomSheet
      visible={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      showBrandWatermark={false}
      contentPaddingBottom={0}
    >
      <View style={localStyles.contentWrap} onLayout={onContentLayout}>
        <View style={sheet.header}>
          <Text style={sheet.headerTitlePlain}>ריאקציות</Text>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={sheet.tabsScroll}
          contentContainerStyle={sheet.tabsScrollContent}
        >
          <View style={sheet.tabsContainer}>
            <Pressable
              onPress={() => setSelectedTab('all')}
              style={[
                sheet.tab,
                selectedTab === 'all' ? sheet.tabActive : sheet.tabInactive,
              ]}
            >
              <Text
                style={[
                  sheet.tabText,
                  selectedTab === 'all' ? sheet.tabTextActive : sheet.tabTextInactive,
                ]}
              >
                הכל {allReactions.length}
              </Text>
            </Pressable>

            {reactionTypes.map((emoji) => (
              <Pressable
                key={emoji}
                onPress={() => setSelectedTab(emoji)}
                style={[
                  sheet.tab,
                  selectedTab === emoji ? sheet.tabActive : sheet.tabInactive,
                ]}
              >
                <Text style={sheet.tabEmoji}>{emoji}</Text>
                <Text
                  style={[
                    sheet.tabText,
                    selectedTab === emoji ? sheet.tabTextActive : sheet.tabTextInactive,
                  ]}
                >
                  {reactionDetails.find((r) => r.emoji === emoji)?.count}
                </Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>

        <View style={localStyles.usersContainer}>
          {loading ? (
            <ChatSheetLoading />
          ) : filteredReactions.length === 0 ? (
            <ChatSheetEmptyState title="אין ריאקציות" />
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
              {filteredReactions.map((item, index) => (
                <View key={`${item.userId}-${item.emoji}-${index}`} style={sheet.userRow}>
                  <UserReactionAvatar
                    uri={item.profilePicture}
                    name={item.userName}
                    avatarStyle={sheet.userAvatar}
                    imageStyle={sheet.userAvatarImage}
                    textStyle={sheet.userAvatarText}
                  />
                  <View style={sheet.userInfo}>
                    <Text style={sheet.userName}>{item.userName}</Text>
                    {item.reactedAt ? (
                      <Text style={sheet.userMeta}>
                        {formatDistanceToNow(new Date(item.reactedAt), {
                          addSuffix: true,
                          locale: he,
                        })}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={localStyles.userEmoji} allowFontScaling={false}>
                    {item.emoji}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}
        </View>
      </View>
    </ChatBottomSheet>
  );
});

export default ReactionDetailsModal;
