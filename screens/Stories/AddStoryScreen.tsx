import React, { useCallback } from 'react';
import { useNavigation } from '@react-navigation/native';
import AddStoryFullScreen from '../../components/chat/AddStoryFullScreen';
import { StoryErrorBoundary } from '../../components/stories/StoryErrorFallback';

/**
 * יצירת סטורי — מסך רגיל בסטאק הראשי (card + slide_from_bottom), לא מודל נייטיב.
 * Modal של RN ו-fullScreenModal נשארו ב-iOS אחרי שיתוף (שקופים, חוסמים נגיעות) — push/pop נסגר באמינות.
 * ההעלאה עצמה רצה ברקע (lib/pendingStories) ולא תלויה במסך.
 */
export default function AddStoryScreen() {
  const navigation = useNavigation();
  const close = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
  }, [navigation]);
  // שגיאה לא צפויה במצלמה/בעורך — מסך שגיאה עם סגירה, לא קריסה של האפליקציה
  return (
    <StoryErrorBoundary onClose={close}>
      <AddStoryFullScreen presentation="screen" visible onClose={close} onAdded={() => {}} />
    </StoryErrorBoundary>
  );
}
