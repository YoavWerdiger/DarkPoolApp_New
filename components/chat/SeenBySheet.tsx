import React, { memo, useState, useEffect, useMemo } from 'react';
import { FlatList, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDesignTokens } from '../ui/DesignTokens';
import { supabase } from '../../lib/supabase';
import { logger } from '../../utils/logger';
import {
  ChatBottomSheet,
  ChatSheetContent,
  ChatSheetEmptyState,
  ChatSheetLoading,
  ChatSheetTitle,
  ChatSheetUserRow,
} from './ChatBottomSheet';

interface SeenByUser {
  id: string;
  full_name: string;
  profile_picture: string | null;
  read_at: string;
}

interface MessageViewerRpcRow {
  user_id: string;
  full_name?: string | null;
  profile_picture?: string | null;
  viewed_at?: string | null;
}

interface SeenBySheetProps {
  visible: boolean;
  onClose: () => void;
  messageId: string;
  messageTimestamp: string;
}

function formatTimeAgo(timestamp: string) {
  const now = new Date();
  const messageTime = new Date(timestamp);
  const diffInSeconds = Math.floor((now.getTime() - messageTime.getTime()) / 1000);

  if (diffInSeconds < 60) return 'עכשיו';
  if (diffInSeconds < 3600) return `לפני ${Math.floor(diffInSeconds / 60)} דקות`;
  if (diffInSeconds < 86400) return `לפני ${Math.floor(diffInSeconds / 3600)} שעות`;
  return `לפני ${Math.floor(diffInSeconds / 86400)} ימים`;
}

const SeenBySheet: React.FC<SeenBySheetProps> = memo(({
  visible,
  onClose,
  messageId,
  messageTimestamp,
}) => {
  const [users, setUsers] = useState<SeenByUser[]>([]);
  const [loading, setLoading] = useState(false);
  const insets = useSafeAreaInsets();
  const tokens = useDesignTokens();
  const metaStyles = useMemo(
    () =>
      StyleSheet.create({
        time: {
          color: tokens.colors.text.secondary,
          fontSize: 13,
          fontWeight: '500',
          textAlign: 'left',
        },
        date: {
          color: tokens.colors.text.tertiary,
          fontSize: 11,
          marginTop: 2,
          textAlign: 'left',
        },
      }),
    [tokens],
  );

  useEffect(() => {
    if (!visible) return;
    if (messageId) {
      void loadUsers();
    } else {
      setUsers([]);
      setLoading(false);
    }
  }, [visible, messageId]);

  const loadUsers = async () => {
    if (!messageId) return;

    setLoading(true);
    try {
      const { data: viewersData } = await supabase.rpc('get_message_viewers', {
        message_uuid: messageId,
      });

      if (viewersData && viewersData.length > 0) {
        const usersWithTimestamp: SeenByUser[] = (viewersData as MessageViewerRpcRow[]).map(
          (viewer) => ({
            id: viewer.user_id,
            full_name: viewer.full_name || 'משתמש',
            profile_picture: viewer.profile_picture ?? null,
            read_at: viewer.viewed_at || messageTimestamp,
          }),
        );
        setUsers(usersWithTimestamp);
      } else {
        setUsers([]);
      }
    } catch (error) {
      logger.error('SeenBySheet', 'Failed to load seen-by users', error);
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const renderUser = ({ item }: { item: SeenByUser }) => (
    <ChatSheetUserRow
      name={item.full_name || 'משתמש'}
      subtitle="ראה את ההודעה"
      avatarUri={item.profile_picture}
      trailing={
        <>
          <Text style={metaStyles.time}>{formatTimeAgo(item.read_at)}</Text>
          <Text style={metaStyles.date}>
            {new Date(item.read_at).toLocaleDateString('he-IL', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </Text>
        </>
      }
    />
  );

  return (
    <ChatBottomSheet visible={visible} onClose={onClose} snapPoints={[0.55]} showBrandWatermark={false}>
      <ChatSheetContent style={{ flex: 1, paddingBottom: insets.bottom + 16 }}>
        <ChatSheetTitle title="נראה על ידי" />

        {loading ? (
          <ChatSheetLoading label="טוען משתמשים..." />
        ) : users.length === 0 ? (
          <ChatSheetEmptyState
            icon="eye-off-outline"
            title="אף אחד לא ראה עדיין"
            subtitle="כשמישהו יקרא את ההודעה, הוא יופיע כאן"
          />
        ) : (
          <FlatList
            data={users}
            renderItem={renderUser}
            keyExtractor={(item, index) => `${item.id}-${index}`}
            showsVerticalScrollIndicator={false}
            style={{ flex: 1 }}
          />
        )}
      </ChatSheetContent>
    </ChatBottomSheet>
  );
});

export default SeenBySheet;
