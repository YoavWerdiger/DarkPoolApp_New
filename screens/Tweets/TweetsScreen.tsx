import React, { useCallback, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { NewsScreenShell } from '../News/NewsScreenShell';
import TweetsFeed, { type TweetsFeedHandle } from './TweetsFeed';
import CreateCommunityPostSheet from './CreateCommunityPostSheet';
import { DayNavBlurButton, DRAWER_MENU_BUTTON_SIZE } from '../../components/ui/DayNavBlurButton';
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

  const createButton = (
    <DayNavBlurButton
      onPress={openCreate}
      glassIntensity="subtle"
      size={DRAWER_MENU_BUTTON_SIZE}
      accessibilityLabel="ציוץ חדש"
    >
      <Ionicons name="add" size={24} color={DesignTokens.colors.text.primary} />
    </DayNavBlurButton>
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
