import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getGroupMuted,
  hydrateGroupMute,
  setGroupMuted,
  subscribeGroupMutes,
} from '../lib/notificationGroupMute';
import { chatGroupService } from '../services/chat';

export function useGroupNotificationMute(groupId: string, fallbackMuted: boolean) {
  const { user } = useAuth();
  const [muted, setMuted] = useState(() => getGroupMuted(groupId, fallbackMuted));

  useEffect(() => {
    hydrateGroupMute(groupId, fallbackMuted);
    setMuted(getGroupMuted(groupId, fallbackMuted));
  }, [groupId, fallbackMuted]);

  useEffect(
    () =>
      subscribeGroupMutes((id, next) => {
        if (id === groupId) setMuted(next);
      }),
    [groupId],
  );

  const toggleMuted = useCallback(
    async (value: boolean) => {
      if (!user?.id) return { success: false };
      return setGroupMuted(groupId, value, (id, mutedValue) =>
        chatGroupService.toggleGroupMute(id, user.id, mutedValue),
      );
    },
    [groupId, user?.id],
  );

  return { muted, toggleMuted };
}
