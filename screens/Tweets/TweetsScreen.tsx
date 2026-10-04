import React, { useCallback, useMemo, useRef, useState } from 'react';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NewsScreenShell } from '../News/NewsScreenShell';
import TweetsFeed, { type TweetsFeedHandle } from './TweetsFeed';
import CreateCommunityPostSheet from './CreateCommunityPostSheet';
import { DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';
import type { CommunityPost } from '../../types/tweets.types';

/**
 * מסך מגירה — ציוצי קהילה (מיקרו-בלוג של חברי האפליקציה).
 * לא מושך חדשות חיצוניות / X API.
 */
export default function TweetsScreen() {
  const DesignTokens = useDesignTokens();
  const [createOpen, setCreateOpen] = useState(false);
  const feedRef = useRef<TweetsFeedHandle | null>(null);

  const openCreate = useCallback(() => {
    void HapticFeedback.impactLight();
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const handleCreated = useCallback((post: CommunityPost) => {
    feedRef.current?.prependPost(post);
  }, []);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        createBtn: {
          width: DRAWER_MENU_BUTTON_SIZE,
          height: DRAWER_MENU_BUTTON_SIZE,
          borderRadius: DRAWER_MENU_BUTTON_SIZE / 2,
          backgroundColor: DesignTokens.colors.primary.main,
          alignItems: 'center',
          justifyContent: 'center',
        },
      }),
    [DesignTokens]
  );

  const createButton = (
    <TouchableOpacity
      style={styles.createBtn}
      onPress={openCreate}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="ציוץ חדש"
    >
      <Ionicons name="add" size={26} color={DesignTokens.colors.text.inverse} />
    </TouchableOpacity>
  );

  return (
    <NewsScreenShell title="ציוצים" headerRight={createButton}>
      <TweetsFeed handleRef={feedRef} />
      <CreateCommunityPostSheet
        visible={createOpen}
        onClose={closeCreate}
        onCreated={handleCreated}
      />
    </NewsScreenShell>
  );
}
