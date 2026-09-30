import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import {
  followUser,
  isFollowingUser,
  unfollowUser,
} from '../../services/userFollowService';
import { HapticFeedback } from '../../utils/hapticFeedback';
import { legacyAlert } from '../../utils/appDialog';
import { useDesignTokens } from '../ui/DesignTokens';

type Props = {
  userId: string;
  following?: boolean;
  onFollowingChange?: (userId: string, following: boolean) => void;
};

export default function FollowUserButton({
  userId,
  following: followingProp,
  onFollowingChange,
}: Props) {
  const { user } = useAuth();
  const tokens = useDesignTokens();
  const isSelf = !!user && user.id === userId;
  const [following, setFollowing] = useState(!!followingProp);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (followingProp !== undefined) setFollowing(followingProp);
  }, [followingProp]);

  useEffect(() => {
    if (!user || isSelf || followingProp !== undefined || !userId) return;
    let cancelled = false;
    void isFollowingUser(userId).then((value) => {
      if (!cancelled) setFollowing(value);
    });
    return () => {
      cancelled = true;
    };
  }, [followingProp, isSelf, user, userId]);

  const handlePress = useCallback(async () => {
    if (!user) {
      legacyAlert('התחברות', 'יש להתחבר כדי לעקוב אחרי משתמשים');
      return;
    }
    if (busy || isSelf) return;

    const prev = following;
    const next = !prev;
    setBusy(true);
    setFollowing(next);
    onFollowingChange?.(userId, next);
    void HapticFeedback.impactLight();
    try {
      if (next) await followUser(userId);
      else await unfollowUser(userId);
      void HapticFeedback.success();
    } catch {
      setFollowing(prev);
      onFollowingChange?.(userId, prev);
      legacyAlert('שגיאה', 'לא הצלחנו לעדכן את המעקב');
    } finally {
      setBusy(false);
    }
  }, [busy, following, isSelf, onFollowingChange, user, userId]);

  if (!userId || isSelf) return null;

  const labelColor = following
    ? tokens.colors.text.secondary
    : tokens.colors.text.primary;

  return (
    <TouchableOpacity
      onPress={() => {
        void handlePress();
      }}
      disabled={busy}
      hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
      accessibilityRole="button"
      accessibilityLabel={following ? 'הפסק מעקב' : 'עקוב'}
      style={[
        styles.btn,
        {
          backgroundColor: tokens.colors.background.primary,
          borderColor: tokens.colors.border.primary,
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator
          size="small"
          color={labelColor}
          style={styles.spinner}
        />
      ) : (
        <Text style={[styles.label, { color: labelColor }]}>
          {following ? 'עוקב' : 'עקוב'}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 20,
    paddingHorizontal: 7,
    paddingVertical: 0,
    borderRadius: 9999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    alignSelf: 'center',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    writingDirection: 'rtl',
    textAlign: 'center',
  },
  spinner: {
    transform: [{ scale: 0.55 }],
  },
});
